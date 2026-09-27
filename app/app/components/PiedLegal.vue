<script setup lang="ts">
/**
 * Les liens que la loi veut accessibles de partout : mentions legales,
 * confidentialite, conditions, accessibilite. Un seul composant, pose en bas
 * de l'accueil, de la connexion, du compte et des pages legales elles-memes.
 *
 * Chacun ouvre la feuille des textes legaux (FeuilleLegale), qui monte du bas
 * par-dessus l'ecran : on lit sans le quitter. Le lien garde son adresse,
 * pour qui l'ouvre dans un nouvel onglet ou sans JavaScript.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const { ouvrir } = useFeuilleLegale()
</script>

<template>
  <nav class="pied-legal" :class="{ compact }" aria-label="Informations légales">
    <ul>
      <li v-for="d in DOCS_LEGAUX" :key="d.chemin">
        <a :href="d.chemin" class="lien" aria-haspopup="dialog" @click.prevent="ouvrir(d.chemin)">{{ d.court }}</a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.pied-legal ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap;
  justify-content: center; gap: 4px 16px; font-size: .78rem; color: var(--doux); }
.pied-legal a { display: inline-block; padding: 6px 2px; }
.pied-legal.compact ul { font-size: .74rem; gap: 2px 12px; }
</style>
