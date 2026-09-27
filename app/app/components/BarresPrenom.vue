<script setup lang="ts">
/**
 * Les naissances année par année, en barres : pour les prénoms trop peu
 * donnés pour une courbe (moins de 60 bébés en trois ans, jamais plus de 60
 * dans l'année).
 *
 * Une courbe en « pour 10 000 » dessinerait l'arrondi à 5 de l'INSEE en dents
 * de scie ; un pourcentage par an ferait croire à une précision que ces
 * chiffres n'ont pas. Les barres montrent les vrais nombres — Elïa passe de
 * 5 à 15 bébés par an — et chacun juge. Même gabarit que CourbePrenom : la
 * carte de tri lui donne la hauteur qui reste (`remplir`).
 */
const props = defineProps<{ valeurs: number[] | null; an0: number; hauteur?: number
  remplir?: boolean }>()

const L = 300

const d = computed(() => {
  const v = props.valeurs
  if (!v?.length) return null
  const max = Math.max(...v)
  if (max <= 0) return null
  const H = props.hauteur ?? 88
  const pas = L / v.length
  const large = pas * 0.66
  return {
    H, max,
    barres: v.map((x, i) => {
      const h = x > 0 ? Math.max(3, (x / max) * (H - 4)) : 0
      return { an: props.an0 + i, x: i * pas + (pas - large) / 2, y: H - h, l: large, h }
    })
  }
})
defineExpose({ d })

/** Ce que les barres disent, en mots (RGAA 1.3), comme pour la courbe. */
const resume = computed(() => {
  const v = props.valeurs
  if (!d.value || !v) return ''
  const an1 = props.an0 + v.length - 1
  return `Naissances par an de ${props.an0} à ${an1}, arrondies à 5 par l’Insee : `
    + `au plus ${d.value.max}, et ${v[v.length - 1]} en ${an1}.`
})
</script>

<template>
  <svg v-if="d" class="barres" :viewBox="`0 0 ${L} ${d.H}`" preserveAspectRatio="none"
       :style="{ height: props.remplir ? '100%' : d.H + 'px' }" role="img" :aria-label="resume">
    <line x1="0" :x2="L" :y1="d.H - 0.5" :y2="d.H - 0.5" class="sol" vector-effect="non-scaling-stroke" />
    <rect v-for="b in d.barres" v-show="b.h" :key="b.an" :x="b.x" :y="b.y" :width="b.l" :height="b.h" />
  </svg>
</template>

<style scoped>
.barres { width: 100%; overflow: visible; display: block; }
.barres rect { fill: var(--menthe); stroke: var(--encre); stroke-width: 1.4;
  vector-effect: non-scaling-stroke; }
.sol { stroke: var(--trait); stroke-width: 1; }
</style>
