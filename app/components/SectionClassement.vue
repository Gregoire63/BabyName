<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts } from '~/composables/useVerdicts'

/**
 * Le tiroir « decider ensemble ». Quatre volets qui forment une suite :
 * ce sur quoi on s'accorde, ce sur quoi on ne s'accorde pas encore, tout ce
 * que j'ai juge, et l'ordre final.
 *
 * Les duels ont disparu : departager deux prenoms au hasard, des dizaines de
 * fois, ne disait rien qu'on ne sache deja — le podium que l'on ordonne a la
 * main dit la meme chose en trois gestes. « A revoir » prend leur place, et
 * repond a un vrai manque : un non pose en trois secondes enterrait un prenom
 * que l'autre adorait, sans que personne ne le sache jamais.
 */
const props = defineProps<{ actif: boolean; segment: string }>()
const emit = defineEmits<{ segment: [string] }>()
const g = useGroupeCourant()
const { aRevoir } = useVerdicts()

const VOLETS = [
  { id: 'communs', t: 'Communs' },
  { id: 'revoir', t: 'À revoir' },
  { id: 'choix', t: 'Mes choix' },
  { id: 'top', t: 'Top' }
]

// Chaque volet ne se monte qu'une fois ouvert, et reste monte ensuite : on ne
// rejoue pas un chargement a chaque aller-retour.
const vus = ref<Set<string>>(new Set([props.segment]))
watch(() => props.segment, s => { vus.value = new Set([...vus.value, s]) })

const ici = (id: string) => props.actif && props.segment === id

const resume = computed(() => {
  const n = g.communs.value.length
  const d = aRevoir.value.length
  switch (props.segment) {
    case 'communs': return `${n} prénom${n > 1 ? 's' : ''} en commun`
    case 'revoir': return d ? `${d} désaccord${d > 1 ? 's' : ''}` : 'aucun désaccord'
    case 'choix': return 'tout ce que vous avez jugé'
    default: return 'votre podium et le général'
  }
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
        <i v-else-if="v.id === 'revoir' && aRevoir.length" class="nb chaud">
          {{ aRevoir.length }}</i>
      </button>
    </div>

    <PanneauCommuns v-if="vus.has('communs')" v-show="segment === 'communs'"
                    :actif="ici('communs')" />
    <PanneauRevoir v-if="vus.has('revoir')" v-show="segment === 'revoir'"
                   :actif="ici('revoir')" />
    <PanneauMesChoix v-if="vus.has('choix')" v-show="segment === 'choix'"
                     :actif="ici('choix')" />
    <PanneauTop v-if="vus.has('top')" v-show="segment === 'top'" :actif="ici('top')" />
  </div>
</template>

<style scoped>
.segment { display: flex; gap: 2px; padding: 3px; border-radius: var(--pastille);
  background: color-mix(in srgb, var(--sable) 58%, transparent); }
.segment button { flex: 1; min-width: 0; border: 0; border-radius: var(--pastille);
  background: none; padding: 8px 4px; font: inherit; font-size: .72rem; font-weight: 700;
  color: var(--doux); cursor: pointer; white-space: nowrap;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  transition: background .16s, color .16s; }
.segment button.on { background: var(--fond); color: var(--texte);
  box-shadow: 0 1px 3px rgba(26,35,78,.09); }
.nb { font-style: normal; font-size: .62rem; font-weight: 800; min-width: 15px;
  padding: 1px 4px; border-radius: 999px; background: var(--menthe); color: var(--encre);
  font-variant-numeric: tabular-nums; }
.nb.chaud { background: var(--peche); }
</style>
