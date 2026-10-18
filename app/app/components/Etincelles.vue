<script setup lang="ts">
/**
 * Le motif du logo : deux etoiles a cinq branches aux pointes arrondies, une
 * grande et une petite (la « bonne etoile », registre chambre de bebe).
 * Elles remplacent les etoiles a quatre branches concaves (18/10) : c'etait
 * la forme du logo de Gemini et de l'emoji ✨, devenue le signe des IA. C'est la seule fioriture de l'identite, donc on
 * l'emploie avec parcimonie — la ou il se passe quelque chose de bien.
 *
 * JAMAIS EN COIN D'UNE CARTE, en filigrane. L'étincelle est devenue le signe
 * des IA : posée en haut à droite d'un bandeau en dégradé, un testeur l'a
 * prise pour la marque de Gemini, et la carte pour une image générée (16/10).
 * Les coins ont désormais leurs deux cœurs (Coeurs) ; l'étincelle reste là où
 * elle dit quelque chose : un accord, un favori.
 */
withDefaults(defineProps<{ taille?: number; couleur?: string; une?: boolean }>(),
  { taille: 26, couleur: 'currentColor', une: false })

// Etoile a cinq branches, rayon interieur = moitie de l'exterieur : dodue.
// Les pointes s'arrondissent par un trait rond de la meme couleur (ARRONDI).
// Boite englobante centree sur (12, 12), 21 de haut, comme l'ancienne.
const ETOILE = 'M12 2.99 14.93 8.92 21.47 9.87 16.73 14.49 17.85 21.01 12 17.93 6.15 21.01 7.27 14.49 2.53 9.87 9.07 8.92Z'
const ARRONDI = 2.99
</script>

<template>
  <svg class="etincelles" :width="taille" :height="taille" viewBox="0 0 32 32"
       :fill="couleur" :stroke="couleur" :stroke-width="ARRONDI" stroke-linejoin="round"
       aria-hidden="true">
    <path :d="ETOILE" transform="translate(-1 6) scale(1.05)" />
    <path v-if="!une" :d="ETOILE" transform="translate(18.54 -3.06) rotate(14) scale(0.62)" />
  </svg>
</template>

<style scoped>
.etincelles { display: block; flex: none; overflow: visible; }
</style>
