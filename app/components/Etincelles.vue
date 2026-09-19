<script setup lang="ts">
/**
 * Le motif du logo : deux etoiles a quatre branches aux cotes concaves, une
 * grande et une petite. C'est la seule fioriture de l'identite, donc on
 * l'emploie avec parcimonie — la ou il se passe quelque chose de bien.
 */
withDefaults(defineProps<{ taille?: number; couleur?: string; une?: boolean }>(),
  { taille: 26, couleur: 'currentColor', une: false })

// Etoile a quatre branches : chaque cote est une courbe rentrante.
const ETOILE = 'M12 1.5c0 5.8 4.7 10.5 10.5 10.5C16.7 12 12 16.7 12 22.5 12 16.7 7.3 12 1.5 12 7.3 12 12 7.3 12 1.5Z'
</script>

<template>
  <svg class="etincelles" :width="taille" :height="taille" viewBox="0 0 32 32"
       :fill="couleur" aria-hidden="true">
    <path :d="ETOILE" transform="translate(-1 6) scale(1.05)" />
    <path v-if="!une" :d="ETOILE" transform="translate(17 -1) scale(0.58)" />
  </svg>
</template>

<style scoped>
.etincelles { display: block; flex: none; overflow: visible; }
</style>
