<script setup lang="ts">
import type { Prenom } from '~/composables/useCatalogue'
import { titreFeuille } from '~/utils/tempetes'

/**
 * La feuille de l'icône d'orage, ouverte depuis la carte.
 *
 * L'icône seule intriguait sans rien dire ; la fiche, elle, oblige à quitter
 * la carte et à chercher l'encadré. Ici, un toucher sur l'icône, et la
 * tempête est là — comme « Voir plus » ouvre les graphies. Le contenu est
 * celui de la fiche (DetailTempete), pour ne pas lire deux versions.
 */
const props = defineProps<{ p: Prenom }>()
const emit = defineEmits<{ fermer: [] }>()
const tp = computed(() => props.p.tp ?? [])
</script>

<template>
  <Feuille :titre="titreFeuille(tp)" @fermer="emit('fermer')">
    <div class="liste" :class="{ plusieurs: tp.length > 1 }">
      <DetailTempete v-for="t in tp" :key="`${t.nom}-${t.an}`" :t="t" :prenom="p.l"
                     :titre="tp.length > 1" />
    </div>
  </Feuille>
</template>

<style scoped>
.liste { display: flex; flex-direction: column; gap: 16px; padding-bottom: 6px; }
/* Deux tempêtes du même nom (Martin) : chacune dans son encadré. */
.liste.plusieurs > * { padding: 12px 14px; border-radius: 13px; border: 1px solid var(--trait);
  background: color-mix(in srgb, var(--encre) 5%, var(--carte)); }
</style>
