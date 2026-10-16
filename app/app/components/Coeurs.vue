<script setup lang="ts">
/**
 * Deux cœurs, un grand et un petit : le motif des coins de carte — la liste
 * en cours et l'accueil (SectionAccueil), le cadeau reçu (FeuilleCadeau) et
 * le code offert (offrir/merci).
 *
 * Ils y remplacent les étincelles (Etincelles), dans la même composition.
 * L'étincelle est devenue le signe des IA : posée en haut à droite d'un
 * bandeau en dégradé, un testeur l'a prise pour la marque de Gemini, et la
 * carte pour une image générée (16/10). Deux cœurs, c'est ce que fait l'app :
 * deux personnes qui aiment le même prénom. Pas un bouton : décor, pâle, et
 * jamais seul (un cœur seul en coin de carte se lit « ajouter aux favoris »).
 */
withDefaults(defineProps<{ taille?: number; couleur?: string }>(),
  { taille: 26, couleur: 'currentColor' })

// Le cœur du bouton « oui » (SectionTrier), le même partout.
const COEUR = 'M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z'
</script>

<template>
  <svg class="coeurs" :width="taille" :height="taille" viewBox="0 0 32 32"
       :fill="couleur" aria-hidden="true">
    <path :d="COEUR" transform="translate(-2 6) scale(1.05)" />
    <path :d="COEUR" transform="translate(16 -2) scale(0.62)" />
  </svg>
</template>

<style scoped>
.coeurs { display: block; flex: none; overflow: visible; }
</style>
