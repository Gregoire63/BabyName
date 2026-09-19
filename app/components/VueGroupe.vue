<script setup lang="ts">
import { chargerCatalogue, filtresParDefaut, type Prenom, type Filtres } from '~/composables/useCatalogue'
import { CLE_GROUPE } from '~/composables/etatGroupe'

const props = defineProps<{ depart?: string }>()

const ONGLETS = [
  { id: 'swipe', t: 'Trier' },
  { id: 'communs', t: 'Communs' },
  { id: 'duels', t: 'Duels' },
  { id: 'classement', t: 'Top' },
  { id: 'groupe', t: 'Liste' }
]

const gid = useRoute().params.id as string
const pager = ref<HTMLElement>()
const index = ref(Math.max(0, ONGLETS.findIndex(o => o.id === (props.depart ?? 'swipe'))))
const vues = ref<Set<number>>(new Set([index.value]))

const etat = ref<any>(null)
const catalogue = ref<Prenom[]>([])
const origines = ref<string[]>([])
const filtres = ref<Filtres>(filtresParDefaut())
const dejaVotes = ref<Set<string>>(new Set())
const aimes = ref<Prenom[]>([])
const vetos = ref<Set<string>>(new Set())
const favoris = ref<Set<string>>(new Set())
const pret = ref(false)
const fiche = ref<Prenom | null>(null)

const parNom = computed(() => new Map(catalogue.value.map(p => [p.l, p])))

async function recharger() {
  const [e, mesVotes] = await Promise.all([
    $fetch<any>(`/api/groupes/${gid}`),
    $fetch<any>(`/api/groupes/${gid}/votes`)
  ])
  etat.value = e
  if (e.groupe.filtres && Object.keys(e.groupe.filtres).length) {
    filtres.value = { ...filtresParDefaut(), ...e.groupe.filtres }
  }
  vetos.value = new Set(e.vetos.map((v: any) => v.prenom))
  favoris.value = new Set(e.mes_favoris)

  const moiId = e.moi.user_id
  const miens = (mesVotes?.votes ?? []).filter((v: any) => v.user_id === moiId)
  dejaVotes.value = new Set(miens.map((v: any) => v.prenom))
  aimes.value = miens.filter((v: any) => v.valeur === 2)
    .map((v: any) => parNom.value.get(v.prenom)!).filter(Boolean)
}

function ouvrirFiche(nom: string) {
  fiche.value = parNom.value.get(nom) ?? null
}

function allerA(onglet: string) {
  const i = ONGLETS.findIndex(o => o.id === onglet)
  if (i >= 0) glisserVers(i)
}

provide(CLE_GROUPE, {
  gid, etat, catalogue, parNom, origines, filtres,
  dejaVotes, aimes, vetos, favoris, pret, recharger, ouvrirFiche, allerA
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
      <section><SectionCommuns v-if="vues.has(1)" :actif="index === 1" /></section>
      <section><SectionDuels v-if="vues.has(2)" :actif="index === 2" /></section>
      <section><SectionClassement v-if="vues.has(3)" :actif="index === 3" /></section>
      <section><SectionListe v-if="vues.has(4)" :actif="index === 4" /></section>
    </div>

    <nav class="onglets">
      <button v-for="(o, i) in ONGLETS" :key="o.id" :class="{ on: index === i }"
              @click="glisserVers(i)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <template v-if="o.id === 'swipe'">
            <rect x="4" y="3" width="16" height="18" rx="3" />
            <path d="M8 16h8" />
          </template>
          <template v-else-if="o.id === 'communs'">
            <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z" />
          </template>
          <template v-else-if="o.id === 'duels'">
            <path d="M12 4v16M6 8l-2 2 2 2M18 8l2 2-2 2" />
          </template>
          <template v-else-if="o.id === 'classement'">
            <path d="M5 19V9M12 19V5M19 19v-6" />
          </template>
          <template v-else>
            <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.3" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 19a4 4 0 0 1 5-3.3" />
          </template>
        </svg>
        {{ o.t }}
      </button>
    </nav>

    <FichePrenom v-if="fiche" :p="fiche" @fermer="fiche = null" />
  </div>
</template>

<style scoped>
.cadre { height: 100%; }
</style>
