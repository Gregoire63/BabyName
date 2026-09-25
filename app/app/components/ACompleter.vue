<script setup lang="ts">
/**
 * Une mention legale obligatoire : sa valeur, ou un trou qui se voit.
 *
 * Un champ vide qui disparait en silence donne une page propre et illegale.
 * Ici il s'affiche en rouge, pour que personne — a commencer par l'editeur —
 * ne puisse le rater avant de vendre.
 */
defineProps<{ v?: string | null; quoi: string }>()
</script>

<template>
  <span v-if="v && v.trim()">{{ v }}</span>
  <mark v-else class="a-completer">[à compléter : {{ quoi }}]</mark>
</template>

<style scoped>
.a-completer { background: none; color: var(--non); font-weight: 800; }
</style>
