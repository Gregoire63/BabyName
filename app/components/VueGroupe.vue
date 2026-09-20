<script setup lang="ts">
import { chargerCatalogue, filtrer, filtresParDefaut, type Prenom, type Filtres }
  from '~/composables/useCatalogue'
import { CLE_GROUPE, type EtatGroupe } from '~/composables/etatGroupe'

const props = defineProps<{ depart?: string; segmentDepart?: string }>()

/**
 * Trois onglets dans la liste, plus une porte de sortie.
 *
 * La barre du bas n'existe QUE dans une liste : c'est ce qui dit qu'on y est.
 * Hors liste, sur l'accueil, il n'y a pas de barre — donc pas d'ambiguite sur
 * ce que reglent les reglages. Accueil n'est pas un quatrieme onglet mais un
 * bouton qui sort : dupliquer l'accueil en volet donnait deux pages identiques
 * dont une seule portait la barre, et personne ne savait laquelle etait quoi.
 *
 * Communs, Duels et Top etaient trois onglets alors qu'ils forment un seul
 * geste. Ils sont devenus les volets de Classement, ou duels et classement
 * pondere ont depuis cede la place a « A revoir » et « Mes choix ».
 *
 * « La liste » plutot que « Parametres » : ces reglages-la sont ceux de CETTE
 * liste. Ce qui concerne le compte vit sur l'accueil, sous son propre nom.
 */
const ONGLETS = [
  { id: 'swipe', t: 'Swipe' },
  { id: 'classement', t: 'Classement' },
  { id: 'reglages', t: 'La liste' }
]

const gid = useRoute().params.id as string
const pager = ref<HTMLElement>()
const index = ref(Math.max(0, ONGLETS.findIndex(o => o.id === (props.depart ?? 'swipe'))))
const vues = ref<Set<number>>(new Set([index.value]))
const segment = ref(props.segmentDepart ?? 'communs')

const etat = ref<any>(null)
const catalogue = ref<Prenom[]>([])
const origines = ref<string[]>([])
const filtres = ref<Filtres>(filtresParDefaut())
const dejaVotes = ref<Set<string>>(new Set())
const aimes = ref<Prenom[]>([])
const vetos = ref<Set<string>>(new Set())
const favoris = ref<Set<string>>(new Set())
const communs = ref<any[]>([])
const votes = ref<any[]>([])
const pret = ref(false)
const fiche = ref<Prenom | null>(null)
// Le panneau de filtres vit ici, pas dans l'onglet de tri : on doit pouvoir
// l'ouvrir aussi depuis les reglages de la liste.
const filtresOuverts = ref(false)

const parNom = computed(() => new Map(catalogue.value.map(p => [p.l, p])))

async function rechargerCommuns() {
  communs.value = await $fetch<any[]>(`/api/groupes/${gid}/communs`).catch(() => [])
}

async function rechargerVotes() {
  const r = await $fetch<any>(`/api/groupes/${gid}/votes`).catch(() => null)
  votes.value = r?.votes ?? []
}

/**
 * Changer mon vote depuis n'importe quel ecran — le tri, « A revoir », « Mes
 * choix ». Un seul chemin : la regle du balayage et celle du vote aveugle sont
 * cote serveur, on ne les rejoue pas ici.
 */
async function voter(prenom: string, valeur: 0 | 1 | 2) {
  await $fetch(`/api/groupes/${gid}/vote`, { method: 'POST', body: { prenom, valeur } })
  const s = new Set(dejaVotes.value); s.add(prenom); dejaVotes.value = s
  await Promise.all([rechargerVotes(), rechargerCommuns()])
}

async function recharger() {
  const [e] = await Promise.all([
    $fetch<any>(`/api/groupes/${gid}`),
    rechargerVotes(),
    rechargerCommuns()
  ])
  etat.value = e
  if (e.groupe.filtres && Object.keys(e.groupe.filtres).length) {
    filtres.value = { ...filtresParDefaut(), ...e.groupe.filtres }
  }
  vetos.value = new Set(e.vetos.map((v: any) => v.prenom))
  favoris.value = new Set(e.mes_favoris)

  const moiId = e.moi.user_id
  const miens = votes.value.filter((v: any) => v.user_id === moiId)
  dejaVotes.value = new Set(miens.map((v: any) => v.prenom))
  aimes.value = miens.filter((v: any) => v.valeur === 2)
    .map((v: any) => parNom.value.get(v.prenom)!).filter(Boolean)
}

function ouvrirFiche(nom: string) {
  fiche.value = parNom.value.get(nom) ?? null
}

function ouvrirFiltres() { filtresOuverts.value = true }

/** Combien de prénoms passent les filtres en cours — affiché dans le panneau. */
const nbFiltres = computed(() =>
  catalogue.value.length ? filtrer(catalogue.value, filtres.value).length : 0)

async function fermerFiltres() {
  filtresOuverts.value = false
  await $fetch(`/api/groupes/${gid}/filtres`,
    { method: 'PUT', body: filtres.value }).catch(() => null)
}

function allerA(onglet: string, seg?: string) {
  if (onglet === 'accueil') { navigateTo('/'); return }
  // Les anciens noms d'onglets restent valides : ils designent maintenant un
  // volet de Classement. Un lien ou un bouton d'avant n'a pas a le savoir.
  // « duels » et « top » n'existent plus : les anciens noms ouvrent le volet
  // qui a pris leur place, pour qu'aucun lien deja partage ne tombe a cote.
  const volets: Record<string, string> =
    { communs: 'communs', duels: 'revoir', revoir: 'revoir', choix: 'choix', top: 'communs' }
  let cible = onglet
  if (volets[onglet]) { cible = 'classement'; seg = volets[onglet] }
  if (onglet === 'groupe') cible = 'reglages'
  if (seg) segment.value = seg
  const i = ONGLETS.findIndex(o => o.id === cible)
  if (i >= 0) glisserVers(i)
}

const partage: EtatGroupe = {
  gid, etat, catalogue, parNom, origines, filtres, dejaVotes, aimes, vetos,
  favoris, communs, rechargerCommuns, votes, rechargerVotes, voter,
  pret, recharger, ouvrirFiche, ouvrirFiltres, allerA
}
provide(CLE_GROUPE, partage)

// --- pastille des accords -------------------------------------------------
// « Il y a du nouveau en commun » doit se voir sans ouvrir l'onglet. On retient
// le nombre deja vu ; la pastille ne parle que de ce qui est arrive depuis.
const cleVus = `communs-vus:${gid}`
const vus = ref(0)
onMounted(() => { vus.value = Number(localStorage.getItem(cleVus) ?? 0) })
const nouveaux = computed(() => Math.max(0, communs.value.length - vus.value))
function marquerVus() {
  vus.value = communs.value.length
  try { localStorage.setItem(cleVus, String(vus.value)) } catch { /* mode prive */ }
}
watch([index, segment, communs], ([i, s]) => {
  if (ONGLETS[i as number]?.id === 'classement' && s === 'communs') marquerVus()
})

// --- navigation -----------------------------------------------------------
function glisserVers(i: number) {
  vues.value = new Set([...vues.value, i])
  const el = pager.value
  if (!el) return
  el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
}

let minuteur: any = null
function auDefilement() {
  const el = pager.value
  if (!el || !el.clientWidth) return
  const i = Math.round(el.scrollLeft / el.clientWidth)
  if (i === index.value) return
  index.value = i
  vues.value = new Set([...vues.value, i])
  clearTimeout(minuteur)
  minuteur = setTimeout(() => {
    history.replaceState(history.state, '', `/g/${gid}/${ONGLETS[i]!.id}`)
  }, 120)
}

onMounted(async () => {
  // position de depart sans animation, avant la premiere peinture visible
  await nextTick()
  const el = pager.value
  if (el) el.scrollLeft = index.value * el.clientWidth

  const c = await chargerCatalogue()
  catalogue.value = c!.liste
  origines.value = c!.origines
  try { await recharger() } catch { return navigateTo('/') }
  pret.value = true
})
</script>

<template>
  <div class="cadre">
    <div ref="pager" class="pager" @scroll.passive="auDefilement">
      <section><SectionTrier v-if="vues.has(0)" :actif="index === 0" /></section>
      <section>
        <SectionClassement v-if="vues.has(1)" :actif="index === 1"
                           :segment="segment" @segment="segment = $event" />
      </section>
      <section><SectionReglages v-if="vues.has(2)" :actif="index === 2" /></section>
    </div>

    <nav class="onglets">
      <!-- la sortie, pas un onglet : elle quitte la liste -->
      <NuxtLink to="/" class="sortie">
        <span class="picto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11 12 4l8 7M6.5 9.6V19h11V9.6" />
          </svg>
        </span>
        Accueil
      </NuxtLink>

      <button v-for="(o, i) in ONGLETS" :key="o.id" :class="{ on: index === i }"
              @click="glisserVers(i)">
        <span class="picto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <template v-if="o.id === 'swipe'">
              <rect x="4" y="3" width="16" height="18" rx="3" />
              <path d="M8 16h8" />
            </template>
            <template v-else-if="o.id === 'classement'">
              <path d="M5 19V9M12 19V5M19 19v-6" />
            </template>
            <template v-else>
              <!-- curseurs de reglage : une roue dentee a 21 px et 2,4 de
                   trait devient un soleil, ce qui ne veut plus rien dire -->
              <path d="M4 7h4M12 7h8M4 12h10M18 12h2M4 17h2M10 17h10" />
              <circle cx="10" cy="7" r="2" /><circle cx="16" cy="12" r="2" />
              <circle cx="8" cy="17" r="2" />
            </template>
          </svg>
          <i v-if="o.id === 'classement' && nouveaux" class="pastille">{{ nouveaux }}</i>
        </span>
        {{ o.t }}
      </button>
    </nav>

    <FichePrenom v-if="fiche" :p="fiche" @fermer="fiche = null" />

    <FiltresPanneau v-if="filtresOuverts" v-model="filtres" :origines="origines"
                    :nb="nbFiltres" @fermer="fermerFiltres" />
  </div>
</template>

<style scoped>
.cadre { height: 100%; }
.picto { position: relative; display: block; line-height: 0; }
.pastille { position: absolute; top: -5px; left: 50%; margin-left: 4px;
  min-width: 15px; height: 15px; padding: 0 4px; border-radius: 999px;
  background: var(--peche); color: var(--encre); font-size: .58rem;
  font-weight: 800; font-style: normal; line-height: 15px; text-align: center;
  font-variant-numeric: tabular-nums; }
</style>
