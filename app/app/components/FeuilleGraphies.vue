<script setup lang="ts">
import { anneesBarres, bebesParAn, frequenceLisible, pourcentAn, tendanceFiable, type Prenom } from '~/composables/useCatalogue'
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Les autres façons d'écrire le prénom de la carte, chiffres à l'appui.
 *
 * La carte disait « aussi écrit Mael, Maëlle… — le vote vaut pour 7
 * graphies » : une phrase longue, qui mangeait la carte et ne montrait rien de
 * ce qui départage deux orthographes. Ici, un onglet par graphie : combien de
 * bébés la reçoivent, si elle monte ou baisse, sa courbe. L'étiquette de
 * chaque onglet porte déjà la part de la graphie : « Maël 61 % » répond à la
 * première question qu'on se pose — laquelle est la plus courante ?
 *
 * Les onglets suivent le motif ARIA : un seul arrêt de tabulation pour la
 * rangée, les flèches pour passer de l'un à l'autre.
 */
const props = defineProps<{ p: Prenom }>()
const emit = defineEmits<{ fermer: [] }>()
const g = useGroupeCourant()
const id = useId()

/** La graphie de la carte d'abord, puis les autres du plus au moins donné. */
const graphies = computed<Prenom[]>(() => {
  const autres = (props.p.variantes ?? [])
    .map(l => g.parNom.value.get(l))
    .filter((x): x is Prenom => !!x)
    .sort((a, b) => b.n - a.n)
  return [g.parNom.value.get(props.p.l) ?? props.p, ...autres]
})
/**
 * Part de la graphie parmi TOUS les bébés qui portent ce prénom à l'oral —
 * y compris les graphies déjà jugées ou écartées par les filtres, qui ne sont
 * plus sur la carte : `fgp` est la fréquence du groupe entier.
 */
const part = (x: Prenom) => {
  if (!x.fgp) return ''
  const v = (x.f / x.fgp) * 100
  return v >= 1 ? `${Math.round(v)} %` : '< 1 %'
}

const choisi = ref(0)
const courant = computed(() => graphies.value[choisi.value] ?? graphies.value[0]!)

const rangee = ref<HTMLElement>()
function auClavier(e: KeyboardEvent) {
  const n = graphies.value.length
  let j = -1
  if (e.key === 'ArrowRight') j = (choisi.value + 1) % n
  else if (e.key === 'ArrowLeft') j = (choisi.value - 1 + n) % n
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = n - 1
  if (j < 0) return
  e.preventDefault()
  e.stopPropagation()
  choisir(j, true)
}
function choisir(j: number, focus = false) {
  choisi.value = j
  nextTick(() => {
    const b = rangee.value?.querySelector<HTMLElement>(`#${id}-o${j}`)
    b?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    if (focus) b?.focus()
  })
}

const sexe = (x: Prenom) => x.sexe === 'fm' ? 'mixte' : x.sexe === 'f' ? 'fille' : 'garçon'
const pic = (x: Prenom) => {
  const s = x.sr
  if (!s?.length) return null
  const max = Math.max(...s)
  return max > 0 ? { an: 1986 + s.indexOf(max), v: max } : null
}
const tendance = (t: number) => t > 8 ? 'monte' : t < -5 ? 'baisse' : ''
// Sous une vingtaine de bebes par an, pas de pente : le bruit de l'arrondi.
const lecture = (x: Prenom) => !tendanceFiable(x) ? ''
  : x.t > 15 ? 'grimpe vite' : x.t > 5 ? 'monte doucement' : x.t < -10 ? 'recule nettement'
    : x.t < -3 ? 's’efface lentement' : 'stable'
const barres = anneesBarres()
</script>

<template>
  <Feuille :titre="`Les ${graphies.length} façons d’écrire ${p.l}`" @fermer="emit('fermer')">
    <p class="mini doux" style="margin:0">
      Ils se disent pareil : votre vote vaut pour les {{ graphies.length }}.
    </p>

    <div ref="rangee" class="onglets-graphies" role="tablist" aria-label="Graphies"
         @keydown="auClavier">
      <button v-for="(x, i) in graphies" :id="`${id}-o${i}`" :key="x.l" type="button" role="tab"
              :aria-selected="choisi === i" :aria-controls="`${id}-panneau`"
              :tabindex="choisi === i ? 0 : -1" :class="{ on: choisi === i }"
              @click="choisir(i)">
        <span class="n">{{ x.l }}</span>
        <span class="part">{{ part(x) }}</span>
      </button>
    </div>

    <section :id="`${id}-panneau`" role="tabpanel" :aria-labelledby="`${id}-o${choisi}`"
             class="panneau">
      <header class="tete">
        <h3 class="nom">{{ courant.l }}</h3>
        <span class="puce">{{ sexe(courant) }}</span>
        <span v-if="courant.q" class="puce rare">rare</span>
      </header>

      <p class="phrase">
        <strong>{{ courant.n.toLocaleString('fr-FR') }}</strong>
        naissance{{ courant.n > 1 ? 's' : '' }} en trois ans<template v-if="part(courant)">,
        soit {{ part(courant) }} des bébés qui portent ce prénom à l’oral</template>.
      </p>

      <dl class="chiffres">
        <div><dt>des naissances</dt><dd>{{ frequenceLisible(courant.f) }}</dd></div>
        <div v-if="tendanceFiable(courant)"><dt>par an</dt>
          <dd :class="tendance(courant.t)">{{ pourcentAn(courant.t) }}</dd></div>
        <div v-else><dt>bébé{{ bebesParAn(courant) > 1 ? 's' : '' }} par an</dt>
          <dd>≈ {{ bebesParAn(courant) }}</dd></div>
        <div><dt>pic historique</dt><dd>{{ courant.p || 'inconnu' }}</dd></div>
      </dl>

      <div v-if="courant.sr" class="graphe">
        <p class="graphe-tete">
          <span>Naissances depuis 1986<template v-if="lecture(courant)"> · {{ lecture(courant) }}</template></span>
          <span v-if="pic(courant)">au plus haut en {{ pic(courant)!.an }}</span>
        </p>
        <CourbePrenom :key="courant.l" :serie="courant.sr" :hauteur="96" pic />
        <p class="graphe-axe" aria-hidden="true"><span>1986</span><span>2025</span></p>
      </div>
      <div v-else-if="courant.nb" class="graphe">
        <p class="graphe-tete"><span>Naissances par an</span></p>
        <BarresPrenom :key="courant.l" :valeurs="courant.nb" :an0="barres[0]" :hauteur="110" />
      </div>
      <p v-else class="mini doux" style="margin:0">
        Trop peu de naissances chaque année pour tracer une courbe.
      </p>

      <p v-if="courant.m" class="sens">« {{ courant.m }} »</p>
    </section>

    <template #pied="{ fermer }">
      <button type="button" class="btn" @click="g.ouvrirFiche(courant.l); fermer()">
        Toute la fiche de {{ courant.l }}
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
/* Une rangée qui défile : sept graphies ne tiennent pas en largeur. */
.onglets-graphies { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
  margin: 0 -20px; padding: 2px 20px 4px; scroll-padding-inline: 20px; }
.onglets-graphies::-webkit-scrollbar { display: none; }
.onglets-graphies button { flex: none; display: flex; flex-direction: column; align-items: flex-start;
  gap: 0; padding: 7px 13px 6px; border-radius: 14px; border: 1px solid var(--trait);
  background: var(--carte); color: var(--doux); cursor: pointer; font: inherit;
  transition: background .16s, color .16s, border-color .16s; }
.onglets-graphies .n { font-weight: 800; font-size: .95rem; color: var(--texte); }
.onglets-graphies .part { font-size: .7rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.onglets-graphies button.on { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.onglets-graphies button.on .n { color: var(--fond); }

.panneau { display: flex; flex-direction: column; gap: 12px; }
.tete { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tete .nom { font-size: 1.6rem; letter-spacing: -.03em; margin-right: 2px; }
.rare { background: none; border: 1px dashed var(--trait); color: var(--doux); }
.phrase { margin: 0; font-size: .95rem; line-height: 1.4; }

.chiffres { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.chiffres > div { background: var(--fond); border: 1px solid var(--trait); border-radius: 13px;
  padding: 7px 9px; display: flex; flex-direction: column-reverse; gap: 1px; min-width: 0; }
.chiffres dt { font-size: .68rem; color: var(--doux); font-weight: 600; }
.chiffres dd { margin: 0; font-size: 1rem; font-weight: 750; font-variant-numeric: tabular-nums;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chiffres dd.monte { color: var(--non); }
.chiffres dd.baisse { color: var(--oui); }

.graphe { display: flex; flex-direction: column; gap: 4px; }
.graphe-tete, .graphe-axe { margin: 0; display: flex; justify-content: space-between; gap: 8px;
  font-size: .7rem; color: var(--doux); font-weight: 600; }
.sens { margin: 0; font-style: italic; }
</style>
