<script setup lang="ts">
/**
 * Les liens que la loi veut accessibles de partout : mentions legales,
 * confidentialite, conditions, accessibilite. Un seul composant, pose en bas
 * de l'accueil, de la connexion, du compte et des pages legales elles-memes.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const LIENS = [
  { to: '/confidentialite', t: 'Confidentialité' },
  { to: '/conditions', t: 'Conditions' },
  { to: '/mentions-legales', t: 'Mentions légales' },
  { to: '/accessibilite', t: 'Accessibilité' }
]
</script>

<template>
  <nav class="pied-legal" :class="{ compact }" aria-label="Informations légales">
    <ul>
      <li v-for="l in LIENS" :key="l.to"><NuxtLink :to="l.to" class="lien">{{ l.t }}</NuxtLink></li>
    </ul>
  </nav>
</template>

<style scoped>
.pied-legal ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap;
  justify-content: center; gap: 4px 16px; font-size: .78rem; color: var(--doux); }
.pied-legal a { display: inline-block; padding: 6px 2px; }
.pied-legal.compact ul { font-size: .74rem; gap: 2px 12px; }
</style>
