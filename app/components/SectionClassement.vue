<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'

/**
 * Le tiroir « decider ensemble ». Trois volets qui forment une seule suite :
 * on voit sur quoi on s'accorde, on departage, on obtient un ordre. C'etaient
 * trois onglets separes ; separes, on ne voyait pas qu'ils s'enchainent.
 */
const props = defineProps<{ actif: boolean; segment: string }>()
const emit = defineEmits<{ segment: [string] }>()
const g = useGroupeCourant()

const VOLETS = [
  { id: 'communs', t: 'Communs' },
  { id: 'duels', t: 'Duels' },
  { id: 'top', t: 'Top' }
]

// Chaque volet ne se monte qu'une fois ouvert, et reste monte ensuite : on ne
// rejoue pas un chargement a chaque aller-retour entre les trois.
const vus = ref<Set<string>>(new Set([props.segment]))
watch(() => props.segment, s => { vus.value = new Set([...vus.value, s]) })

const ici = (id: string) => props.actif && props.segment === id

const resume = computed(() => {
  const n = g.communs.value.length
  return props.segment === 'communs'
    ? `${n} prénom${n > 1 ? 's' : ''} en commun`
    : props.segment === 'duels'
      ? 'départager deux à deux'
      : 'votre podium et le général'
})
</script>

<template>
  <div class="pile">
    <TeteListe onglet="Classement" :info="resume" />

    <div class="segment" role="tablist">
      <button v-for="v in VOLETS" :key="v.id" role="tab"
              :aria-selected="segment === v.id" :class="{ on: segment === v.id }"
              @click="emit('segment', v.id)">
        {{ v.t }}
        <i v-if="v.id === 'communs' && g.communs.value.length" class="nb">
          {{ g.communs.value.length }}</i>
      </button>
    </div>

    <PanneauCommuns v-if="vus.has('communs')" v-show="segment === 'communs'"
                    :actif="ici('communs')" />
    <PanneauDuels v-if="vus.has('duels')" v-show="segment === 'duels'"
                  :actif="ici('duels')" @voir-top="emit('segment', 'top')" />
    <PanneauTop v-if="vus.has('top')" v-show="segment === 'top'" :actif="ici('top')" />
  </div>
</template>

<style scoped>
.segment { display: flex; gap: 3px; padding: 3px; border-radius: var(--pastille);
  background: color-mix(in srgb, var(--sable) 58%, transparent); }
.segment button { flex: 1; min-width: 0; border: 0; border-radius: var(--pastille);
  background: none; padding: 8px 6px; font: inherit; font-size: .8rem; font-weight: 700;
  color: var(--doux); cursor: pointer; white-space: nowrap;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  transition: background .16s, color .16s; }
.segment button.on { background: var(--fond); color: var(--texte);
  box-shadow: 0 1px 3px rgba(26,35,78,.09); }
.nb { font-style: normal; font-size: .64rem; font-weight: 800; min-width: 16px;
  padding: 1px 5px; border-radius: 999px; background: var(--menthe); color: var(--encre);
  font-variant-numeric: tabular-nums; }
</style>
