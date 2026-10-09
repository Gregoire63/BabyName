<script setup lang="ts">
import { chargerCatalogue, pourcentAn, PAYS_DEFAUT, type Prenom, type ChiffreFx } from '~/composables/useCatalogue'
import { useGroupeSiPresent } from '~/composables/etatGroupe'
import { chargerIndexPays, chargerPays, chargerTousLesPays, chiffre, indexPays, totalPour, type Pays } from '~/composables/usePays'

/**
 * Le prénom dans chaque pays dont on a les chiffres.
 *
 * D'abord les pays de la liste (déjà chargés), puis, à la demande, tous les
 * autres : les États-Unis seuls pèsent 270 Ko, on ne les fait pas venir pour
 * qui ne regarde pas. Chaque ligne porte son badge de source : ces chiffres
 * ne viennent pas tous du même endroit, ne se comptent pas pareil (seuils,
 * accents, sexes confondus au Québec) et renvoient à leur jeu d'origine.
 */
const props = defineProps<{ p: Prenom }>()
const g = useGroupeSiPresent()
const tout = ref(false)
const charge = ref(false)
const enCours = ref(false)
const version = ref(0)

// Les pays de la liste, et la francophonie toujours : le reste à la demande.
const choisis = computed<string[]>(() => {
  const c = g?.filtres?.value?.pays
  return [...new Set([...(c?.length ? c : PAYS_DEFAUT), 'fr', 'be', 'ch', 'qc'])]
})

// Les pays de la liste sont d'ordinaire déjà chargés ; depuis l'accueil, non.
const pret = ref(false)
onMounted(async () => {
  try {
    await chargerIndexPays()
    const c = await chargerCatalogue()
    await chargerPays(c!.liste, choisis.value)
  } catch { /* la fiche reste lisible sans cette section */ }
  pret.value = true
  version.value++
})

async function voirTout() {
  tout.value = true
  if (charge.value) return
  enCours.value = true
  try {
    const c = await chargerCatalogue()
    await chargerTousLesPays(c!.liste)
    charge.value = true
    version.value++
  } finally { enCours.value = false }
}

interface Ligne { pays: Pays; v: ChiffreFx | null; part: number }
const lignes = computed<Ligne[]>(() => {
  void version.value
  const montres = indexPays().filter(x => tout.value || choisis.value.includes(x.code))
  return montres.map(pays => {
    const v = chiffre(props.p, pays.code)
    return { pays, v, part: v ? v.n / totalPour(pays, props.p.sexe) : 0 }
  }).sort((a, b) => (b.v ? 1 : 0) - (a.v ? 1 : 0) || b.part - a.part)
})
const presents = computed(() => lignes.value.filter(l => l.v))
const absents = computed(() => lignes.value.filter(l => !l.v))
const autres = computed(() => Math.max(0, indexPays().length - choisis.value.length))

function rang(pays: Pays, r: number | null): string | null {
  if (!r || r > 2000) return null
  const ord = r === 1 ? '1er' : `${r}e`
  const sx = props.p.sexe
  if (!pays.par_sexe || sx === 'fm') return `${ord} prénom`
  return `${ord} prénom de ${sx === 'f' ? 'fille' : 'garçon'}`
}
function unSur(pays: Pays, n: number): string {
  const sx = props.p.sexe
  const qui = !pays.par_sexe || sx === 'fm' ? 'bébé' : sx === 'f' ? 'fille' : 'garçon'
  return `1 ${qui} sur ${Math.round(totalPour(pays, sx) / n).toLocaleString('fr-FR')}`
}
const court = (pays: Pays) => pays.sigle || pays.organisme
const titre = (pays: Pays) =>
  `${pays.organisme} — ${pays.jeu}, ${pays.annees[0]}-${pays.annees[1]}. Licence : ${pays.licence}.`
</script>

<template>
  <section v-if="pret && indexPays().length" class="monde">
    <h3>Dans le monde</h3>
    <ul>
      <li v-for="{ pays, v } in presents" :key="pays.code" class="pays">
        <div class="tete">
          <b>{{ pays.nom }}</b>
          <a class="badge" :href="pays.url" target="_blank" rel="noopener" :title="titre(pays)"
             :aria-label="`Source : ${titre(pays)}`">{{ court(pays) }} · {{ pays.annees[0] }}-{{ String(pays.annees[1]).slice(2) }}</a>
        </div>
        <p class="valeur">
          <span v-if="rang(pays, v!.rang)" class="fort">{{ rang(pays, v!.rang) }}</span>
          <span>{{ v!.n.toLocaleString('fr-FR') }} bébés en 3 ans</span>
          <span class="doux">{{ unSur(pays, v!.n) }}</span>
          <span v-if="v!.t !== null" class="tendance" :class="v!.t > 3 ? 'monte' : v!.t < -3 ? 'baisse' : ''">
            {{ pourcentAn(v!.t) }}/an</span>
        </p>
        <p v-if="pays.note" class="note">{{ pays.note[0]!.toUpperCase() + pays.note.slice(1) }}.</p>
      </li>
    </ul>
    <p v-if="absents.length" class="note">
      Peu ou pas donné (sous le seuil de publication) : {{ absents.map(l => l.pays.nom).join(', ') }}.
    </p>
    <button v-if="!tout && autres" type="button" class="btn btn-0 mini" :disabled="enCours" @click="voirTout">
      {{ enCours ? 'Chargement…' : `Voir dans les ${autres} autres pays` }}
    </button>
  </section>
</template>

<style scoped>
.monde { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.monde h3 { color: var(--doux); text-transform: uppercase; font-size: .7rem; letter-spacing: .06em; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pays { padding: 10px 12px; border-radius: 13px; border: 1px solid var(--trait); background: var(--fond);
  display: flex; flex-direction: column; gap: 4px; }
.tete { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.badge { font-size: .68rem; font-weight: 650; letter-spacing: .02em; color: var(--encre);
  text-decoration: none; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte));
  border: 1px solid color-mix(in srgb, var(--menthe) 70%, var(--trait)); }
.badge:hover, .badge:focus-visible { background: color-mix(in srgb, var(--menthe) 70%, var(--carte)); }
.valeur { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: .9rem;
  font-variant-numeric: tabular-nums; }
.fort { font-weight: 650; }
.doux { color: var(--doux); }
.tendance { font-weight: 600; }
.tendance.monte { color: var(--non); }
.tendance.baisse { color: var(--oui); }
.note { margin: 0; font-size: .74rem; color: var(--doux); }
.btn { align-self: flex-start; }
</style>
