<script setup lang="ts">
import { chargerCatalogue, filtrer, filtresParDefaut, type Prenom, type Filtres }
  from '~/composables/useCatalogue'
import { marquerListeCourante } from '~/composables/useListeCourante'
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
const mesVetos = ref<{ prenom: string; motif: string | null }[]>([])
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

/** Poser un veto : definitif, limite, et invisible pour les autres. */
async function poserVeto(prenom: string, motif?: string) {
  await $fetch(`/api/groupes/${gid}/veto`, { method: 'POST', body: { prenom, motif } })
  vetos.value = new Set([...vetos.value, prenom])
  await Promise.all([recharger(), rechargerCommuns()])
}

async function retirerVeto(prenom: string) {
  await $fetch(`/api/groupes/${gid}/veto?prenom=${encodeURIComponent(prenom)}`,
    { method: 'DELETE' })
  const s = new Set(vetos.value); s.delete(prenom); vetos.value = s
  await Promise.all([recharger(), rechargerCommuns()])
}

async function basculerFavori(prenom: string) {
  const actif = !favoris.value.has(prenom)
  const s = new Set(favoris.value)
  actif ? s.add(prenom) : s.delete(prenom)
  favoris.value = s
  await $fetch(`/api/groupes/${gid}/favori`, { method: 'POST', body: { prenom, actif } })
    .catch(() => null)
}

async function recharger() {
  const [e] = await Promise.all([
    $fetch<any>(`/api/groupes/${gid}`),
    rechargerVotes(),
    rechargerCommuns()
  ])
  etat.value = e
  if (e.groupe.filtres && Object.keys(e.groupe.filtres).length) {
    // `recherche` n'est plus un filtre qu'on peut voir ni changer (la loupe
    // l'a remplace) : un mot reste enregistre viderait la pile sans qu'on
    // sache pourquoi. On l'oublie.
    filtres.value = { ...filtresParDefaut(), ...e.groupe.filtres, recherche: '' }
  }
  vetos.value = new Set(e.vetos)
  mesVetos.value = e.mes_vetos ?? []
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

/**
 * L'offre se voit depuis trois endroits (le tri, les reglages, la fiche) et
 * ne doit exister qu'une fois. Ouvrir l'offre ferme la fiche : on quitte la
 * question « ce prenom » pour la question « cette liste », et empiler deux
 * feuilles ne laisse plus rien fermer au doigt.
 */
const debloquerOuvert = ref(false)
function ouvrirDebloquer() { fiche.value = null; debloquerOuvert.value = true }

/** Combien de prénoms passent les filtres en cours — affiché dans le panneau. */
const nbFiltres = computed(() =>
  catalogue.value.length ? filtrer(catalogue.value, filtres.value).length : 0)

/** Combien de prénoms la bascule « très rares » ouvrirait, filtres en cours
 *  mis à part elle. On l'annonce : « + 4 210 » veut dire quelque chose,
 *  « inclure les rares » ne veut rien dire. */
const nbRares = computed(() => {
  if (!catalogue.value.length) return 0
  const f = filtres.value
  return filtrer(catalogue.value, { ...f, inclure_rares: true }).length
       - filtrer(catalogue.value, { ...f, inclure_rares: false }).length
})

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

/**
 * Le titre de la page suit l'onglet (RGAA 8.6). Nuxt l'annonce a chaque
 * changement (NuxtRouteAnnouncer, dans app.vue) : c'est ce qui dit a un
 * lecteur d'ecran qu'on est passe de « Swipe » a « Classement », puisque le
 * glissement entre onglets ne change pas de route.
 */
useHead({
  title: computed(() => {
    const nom = etat.value?.groupe?.nom
    const onglet = ONGLETS[index.value]?.t ?? ''
    return nom ? `${onglet} — ${nom}` : onglet
  })
})

/**
 * Les fleches ne doivent pas faire defiler le pager d'un onglet a l'autre :
 * au clavier, les onglets se choisissent dans la barre du bas, et sur l'onglet
 * de tri les fleches votent. Dans un champ, elles restent au champ.
 */
function flechesPager(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const cible = e.target as HTMLElement | null
  if (cible?.closest('input, textarea, select, [contenteditable="true"]')) return
  e.preventDefault()
}

const partage: EtatGroupe = {
  gid, etat, catalogue, parNom, origines, filtres, dejaVotes, aimes, vetos,
  mesVetos, poserVeto, retirerVeto, favoris, basculerFavori,
  communs, rechargerCommuns, votes, rechargerVotes, voter,
  pret, recharger, ouvrirFiche, ouvrirFiltres, allerA, ouvrirDebloquer
}
provide(CLE_GROUPE, partage)

// --- pastille des accords -------------------------------------------------
// « Il y a du nouveau en commun » doit se voir sans ouvrir l'onglet. On retient
// le nombre deja vu ; la pastille ne parle que de ce qui est arrive depuis.
const cleVus = `communs-vus:${gid}`
const vus = ref(0)
onMounted(() => {
  vus.value = Number(localStorage.getItem(cleVus) ?? 0)
  // C'est cette liste qu'on trie : l'accueil doit la mettre en avant, pas la
  // ranger parmi « mes autres listes ».
  marquerListeCourante(gid)
})
const nouveaux = computed(() => Math.max(0, communs.value.length - vus.value))
function marquerVus() {
  vus.value = communs.value.length
  try { localStorage.setItem(cleVus, String(vus.value)) } catch { /* mode prive */ }
}
watch([index, segment, communs], ([i, s]) => {
  if (ONGLETS[i as number]?.id === 'classement' && s === 'communs') marquerVus()
})

// --- navigation -----------------------------------------------------------
/**
 * Un onglet choisi l'est tout de suite, pas a la fin du glissement.
 *
 * L'index suivait le defilement : pendant les 300 ms de l'animation, le volet
 * vise restait inerte (voir le gabarit), l'onglet n'etait pas encore marque
 * courant et le titre annonce etait l'ancien. Un champ touche juste apres
 * l'onglet ne recevait rien. On pose donc l'index au clic, et on ignore les
 * positions intermediaires du glissement jusqu'a l'arrivee.
 */
let cibleGlisse: number | null = null
let finGlisse: any = null
function glisserVers(i: number) {
  vues.value = new Set([...vues.value, i])
  index.value = i
  cibleGlisse = i
  clearTimeout(finGlisse)
  // Filet : un doigt qui reprend la main pendant l'animation ne doit pas
  // laisser l'index fige sur une cible jamais atteinte.
  finGlisse = setTimeout(() => { cibleGlisse = null }, 900)
  history.replaceState(history.state, '', `/g/${gid}/${ONGLETS[i]!.id}`)
  const el = pager.value
  if (!el) return
  el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
}

let minuteur: any = null
function auDefilement() {
  const el = pager.value
  if (!el || !el.clientWidth) return
  const i = Math.round(el.scrollLeft / el.clientWidth)
  if (cibleGlisse !== null) {
    if (i !== cibleGlisse) return
    cibleGlisse = null
  }
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
  attendrePaiement()
})

/**
 * Le retour de Stripe.
 *
 * Stripe renvoie le navigateur sur `?paye=1` ET appelle le webhook, dans cet
 * ordre-la mais pas forcement dans ce delai : le webhook peut arriver une ou
 * deux secondes apres. Sans cette attente, quelqu'un qui vient de payer
 * retombe sur une liste bloquee et croit avoir paye pour rien.
 *
 * On n'ecrit RIEN ici — `?paye=1` ne prouve rien, il se tape dans la barre
 * d'adresse. On se contente de recharger jusqu'a ce que le serveur, lui, dise
 * que c'est paye.
 */
const confirmation = ref<'attente' | 'ok' | 'lent' | null>(null)

async function attendrePaiement() {
  const route = useRoute()
  if (route.query.paye !== '1') return
  const session = typeof route.query.session_id === 'string' ? route.query.session_id : ''
  history.replaceState(history.state, '', `/g/${gid}/${ONGLETS[index.value]!.id}`)
  if (etat.value?.groupe?.paye) { confirmation.value = 'ok'; return }

  confirmation.value = 'attente'
  // D'abord demander au serveur de relire la session chez Stripe : si le
  // webhook est en retard — ou mal configure — c'est ce qui debloque.
  if (session) {
    try {
      const r = await $fetch<any>(`/api/groupes/${gid}/confirmer-paiement`,
        { method: 'POST', body: { session_id: session } })
      if (r?.paye) { await recharger(); confirmation.value = 'ok'; return }
    } catch { /* le webhook prendra le relais */ }
  }
  for (const pause of [900, 1200, 1800, 2500, 4000]) {
    await new Promise(r => setTimeout(r, pause))
    try { await recharger() } catch { /* on reessaie */ }
    if (etat.value?.groupe?.paye) { confirmation.value = 'ok'; return }
  }
  confirmation.value = 'lent'
}
</script>

<template>
  <div class="cadre">
    <!-- Les trois volets sont dans le DOM en meme temps (on glisse de l'un a
         l'autre) : ceux qu'on ne regarde pas sont inertes, sinon un lecteur
         d'ecran les lit a la suite et la tabulation s'y perd. -->
    <main id="contenu" ref="pager" class="pager" tabindex="-1"
          @scroll.passive="auDefilement" @keydown="flechesPager">
      <section :aria-label="ONGLETS[0]!.t" :inert="index !== 0 || undefined">
        <SectionTrier v-if="vues.has(0)" :actif="index === 0" />
      </section>
      <section :aria-label="ONGLETS[1]!.t" :inert="index !== 1 || undefined">
        <SectionClassement v-if="vues.has(1)" :actif="index === 1"
                           :segment="segment" @segment="segment = $event" />
      </section>
      <section :aria-label="ONGLETS[2]!.t" :inert="index !== 2 || undefined">
        <SectionReglages v-if="vues.has(2)" :actif="index === 2" />
      </section>
    </main>

    <nav class="onglets" aria-label="Navigation dans la liste">
      <!-- la sortie, pas un onglet : elle quitte la liste -->
      <NuxtLink to="/" class="sortie">
        <span class="picto">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11 12 4l8 7M6.5 9.6V19h11V9.6" />
          </svg>
        </span>
        Accueil
      </NuxtLink>

      <!-- La pastille des nouveaux accords est un dessin : son sens passe dans
           le nom accessible, qui commence par le libelle visible (WCAG 2.5.3). -->
      <button v-for="(o, i) in ONGLETS" :key="o.id" type="button" :class="{ on: index === i }"
              :aria-current="index === i ? 'page' : undefined"
              :aria-label="o.id === 'classement' && nouveaux
                ? `${o.t}, ${nouveaux > 1 ? `${nouveaux} nouveaux accords` : '1 nouvel accord'}`
                : undefined"
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
          <i v-if="o.id === 'classement' && nouveaux" class="pastille" aria-hidden="true">{{ nouveaux }}</i>
        </span>
        {{ o.t }}
      </button>
    </nav>

    <FichePrenom v-if="fiche" :p="fiche" @fermer="fiche = null" />

    <FiltresPanneau v-if="filtresOuverts" v-model="filtres" :origines="origines"
                    :nb="nbFiltres" :nb-rares="nbRares" @fermer="fermerFiltres" />

    <FeuilleDebloquer v-if="debloquerOuvert" @fermer="debloquerOuvert = false" />

    <div v-if="confirmation" class="paiement" :class="confirmation"
         role="status" aria-live="polite" @click="confirmation = null">
      <template v-if="confirmation === 'attente'">
        Paiement reçu — on débloque la liste…
      </template>
      <template v-else-if="confirmation === 'ok'">
        C’est débloqué, pour vous et pour tout le monde sur cette liste.
      </template>
      <template v-else>
        Le paiement est passé, mais la confirmation tarde. Rechargez la page
        dans une minute ; si rien ne change, écrivez-nous, rien n’est perdu.
      </template>
    </div>
  </div>
</template>

<style scoped>
.pager:focus { outline: none; }
.cadre { height: 100%; }
.paiement { position: fixed; left: 12px; right: 12px; bottom: 76px; z-index: 70;
  padding: 13px 16px; border-radius: 15px; background: var(--carte);
  border: 1px solid var(--trait); box-shadow: var(--ombre); font-size: .9rem;
  animation: monte-paiement .22s cubic-bezier(.2,.8,.3,1); }
.paiement.ok { background: color-mix(in srgb, var(--menthe) 45%, var(--carte));
  color: var(--encre); }
.paiement.lent { background: color-mix(in srgb, var(--peche) 45%, var(--carte));
  color: var(--encre); }
@keyframes monte-paiement { from { transform: translateY(10px); opacity: 0 } }
.picto { position: relative; display: block; line-height: 0; }
.pastille { position: absolute; top: -5px; left: 50%; margin-left: 4px;
  min-width: 15px; height: 15px; padding: 0 4px; border-radius: 999px;
  background: var(--peche); color: var(--encre); font-size: .58rem;
  font-weight: 800; font-style: normal; line-height: 15px; text-align: center;
  font-variant-numeric: tabular-nums; }
</style>
