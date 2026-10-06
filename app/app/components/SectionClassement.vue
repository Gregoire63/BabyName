<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { useVerdicts } from '~/composables/useVerdicts'

/**
 * Le tiroir « decider ensemble ». Trois volets : ce sur quoi on s'accorde,
 * ce sur quoi on ne s'accorde pas encore, et tout ce que j'ai juge.
 *
 * Les duels puis le classement pondere ont disparu. Pour deux personnes qui
 * choisissent un prenom, l'ordre fin n'a jamais servi : la liste des communs,
 * classee par son score, suffit a la conversation. « A revoir » a pris leur
 * place et repond, lui, a un vrai manque — un non pose en trois secondes
 * enterrait un prenom que l'autre adorait, sans que personne ne le sache.
 */
const props = defineProps<{ actif: boolean; segment: string }>()
const emit = defineEmits<{ segment: [string] }>()
const g = useGroupeCourant()
const { aRevoir } = useVerdicts()

const VOLETS = [
  { id: 'communs', t: 'Communs' },
  { id: 'revoir', t: 'À revoir' },
  { id: 'choix', t: 'Mes choix' },
  { id: 'portrait', t: 'Portrait' }
]

// Chaque volet ne se monte qu'une fois ouvert, et reste monte ensuite : on ne
// rejoue pas un chargement a chaque aller-retour. Monte ne veut pas dire au
// travail : celui qu'on ne regarde pas est en veille (EnVeille.vue).
const vus = ref<Set<string>>(new Set([props.segment]))
watch(() => props.segment, s => { vus.value = new Set([...vus.value, s]) })

const ici = (id: string) => props.actif && props.segment === id

/**
 * Les volets sont de vrais onglets (motif ARIA « tabs ») : un seul arret de
 * tabulation pour la rangee, les fleches pour passer de l'un a l'autre,
 * Debut et Fin pour les extremites. Le volet suit la selection.
 */
const rangee = ref<HTMLElement>()
function auClavierOnglets(e: KeyboardEvent) {
  const i = VOLETS.findIndex(v => v.id === props.segment)
  let j = -1
  if (e.key === 'ArrowRight') j = (i + 1) % VOLETS.length
  else if (e.key === 'ArrowLeft') j = (i - 1 + VOLETS.length) % VOLETS.length
  else if (e.key === 'Home') j = 0
  else if (e.key === 'End') j = VOLETS.length - 1
  if (j < 0) return
  e.preventDefault()
  e.stopPropagation()
  emit('segment', VOLETS[j]!.id)
  nextTick(() => rangee.value?.querySelector<HTMLElement>(`#onglet-${VOLETS[j]!.id}`)?.focus())
}

const resume = computed(() => {
  const n = g.communs.value.length
  const d = aRevoir.value.length
  switch (props.segment) {
    case 'communs': return `${n} prénom${n > 1 ? 's' : ''} en commun`
    case 'revoir': return d ? `${d} désaccord${d > 1 ? 's' : ''}` : 'aucun désaccord'
    case 'portrait': return 'ce que vos oui disent de vous'
    default: return 'tout ce que vous avez jugé'
  }
})
</script>

<template>
  <div class="pile">
    <TeteListe onglet="Classement" :info="resume" />

    <div ref="rangee" class="segment" role="tablist" aria-label="Volets du classement"
         @keydown="auClavierOnglets">
      <button v-for="v in VOLETS" :id="`onglet-${v.id}`" :key="v.id" type="button" role="tab"
              :aria-selected="segment === v.id" :aria-controls="`volet-${v.id}`"
              :tabindex="segment === v.id ? 0 : -1" :class="{ on: segment === v.id }"
              @click="emit('segment', v.id)">
        {{ v.t }}
        <i v-if="v.id === 'communs' && g.communs.value.length" class="nb">
          {{ g.communs.value.length }}</i>
        <i v-else-if="v.id === 'revoir' && aRevoir.length" class="nb chaud">
          {{ aRevoir.length }}</i>
      </button>
    </div>

    <div id="volet-communs" v-show="segment === 'communs'" role="tabpanel"
         aria-labelledby="onglet-communs">
      <!-- Pas de prop `actif` aux volets qui n'en font rien : la recevoir les
           faisait redessiner en entier à chaque changement de volet. -->
      <EnVeille v-if="vus.has('communs')" :actif="ici('communs')">
        <PanneauCommuns />
      </EnVeille>
    </div>
    <div id="volet-revoir" v-show="segment === 'revoir'" role="tabpanel"
         aria-labelledby="onglet-revoir">
      <EnVeille v-if="vus.has('revoir')" :actif="ici('revoir')">
        <PanneauRevoir />
      </EnVeille>
    </div>
    <div id="volet-choix" v-show="segment === 'choix'" role="tabpanel"
         aria-labelledby="onglet-choix">
      <EnVeille v-if="vus.has('choix')" :actif="ici('choix')">
        <PanneauMesChoix :actif="ici('choix')" />
      </EnVeille>
    </div>
    <div id="volet-portrait" v-show="segment === 'portrait'" role="tabpanel"
         aria-labelledby="onglet-portrait">
      <EnVeille v-if="vus.has('portrait')" :actif="ici('portrait')">
        <PanneauPortrait />
      </EnVeille>
    </div>
  </div>
</template>

<style scoped>
.segment { display: flex; gap: 2px; padding: 3px; border-radius: var(--pastille);
  background: color-mix(in srgb, var(--sable) 58%, transparent); }
/* Quatre volets : on retrecit le texte plutot que de laisser deborder. */
.segment button { flex: 1; min-width: 0; border: 0; border-radius: var(--pastille);
  background: none; padding: 8px 3px; font: inherit; font-size: .68rem; font-weight: 700;
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
