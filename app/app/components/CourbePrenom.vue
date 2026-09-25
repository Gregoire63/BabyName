<script setup lang="ts">
/** Courbe 1986-2025 en pour 10 000 naissances, normalisee sur son propre max.
 *  Partagee par la carte de tri (compacte) et la fiche complete. */
const props = defineProps<{ serie: number[] | null; hauteur?: number; pic?: boolean }>()

const AN0 = 1986
const L = 300

const d = computed(() => {
  const s = props.serie
  if (!s || s.length < 4) return null
  const max = Math.max(...s)
  if (max <= 0) return null
  const H = props.hauteur ?? 88
  const pas = L / (s.length - 1)
  const pts = s.map((v, i) => [i * pas, H - (v / max) * (H - 6)] as const)
  const ligne = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const iPic = s.indexOf(max)
  return {
    ligne, H, max,
    aire: `0,${H} ${ligne} ${L},${H}`,
    pic: { x: pts[iPic]![0], y: pts[iPic]![1], an: AN0 + iPic, v: max }
  }
})
defineExpose({ d })

/**
 * Ce que la courbe dit, en mots (RGAA 1.3) : elle etait masquee aux lecteurs
 * d'ecran, qui perdaient la seule information qu'elle porte — la forme de la
 * mode. On en donne le sens, pas les quarante valeurs.
 */
const resume = computed(() => {
  const s = props.serie
  if (!d.value || !s) return ''
  const debut = s.slice(0, 5).reduce((a, b) => a + b, 0) / 5
  const fin = s.slice(-5).reduce((a, b) => a + b, 0) / 5
  const sens = fin > debut * 1.3 ? 'en hausse' : fin < debut * 0.7 ? 'en baisse' : 'plutôt stable'
  return `Naissances de ${AN0} à ${AN0 + s.length - 1} : ${sens}, au plus haut en ${d.value.pic.an}.`
})
</script>

<template>
  <svg v-if="d" class="courbe" :viewBox="`0 0 ${L} ${d.H}`" preserveAspectRatio="none"
       :style="{ height: d.H + 'px' }" role="img" :aria-label="resume">
    <defs>
      <linearGradient :id="`g${d.H}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--menthe)" stop-opacity=".9" />
        <stop offset="100%" stop-color="var(--menthe)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polygon :points="d.aire" :fill="`url(#g${d.H})`" />
    <polyline :points="d.ligne" fill="none" stroke="var(--encre)" stroke-width="1.8"
              vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
    <circle v-if="pic" :cx="d.pic.x" :cy="d.pic.y" r="3" fill="var(--peche)"
            stroke="var(--encre)" stroke-width="1.4" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<style scoped>
.courbe { width: 100%; overflow: visible; display: block; }
</style>
