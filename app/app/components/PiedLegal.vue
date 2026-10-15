<script setup lang="ts">
/**
 * Les liens que la loi veut accessibles de partout : mentions legales,
 * confidentialite, conditions, accessibilite. Un seul composant, pose en bas
 * de l'accueil, de la connexion, du compte et des pages legales elles-memes.
 *
 * Chacun ouvre la feuille des textes legaux (FeuilleLegale), qui monte du bas
 * par-dessus l'ecran : on lit sans le quitter. Le lien garde son adresse,
 * pour qui l'ouvre dans un nouvel onglet ou sans JavaScript.
 *
 * Sur UNE ligne, partout, dans toutes les langues, des 360 px de large : ils
 * en prenaient deux (65 px au lieu de 30) sur presque chaque ecran. Mesure
 * faite au plus etroit — la feuille du compte, 320 px de place —, le
 * francais y tient a .68rem, liens serres ; le neerlandais grace a un nom
 * plus court (« Juridische info »). Un texte agrandi (zoom du navigateur)
 * passe a la ligne plutot que de sortir de l'ecran : `wrap` reste.
 */
const { ouvrir } = useFeuilleLegale()
</script>

<template>
  <nav class="pied-legal" :aria-label="$t('PiedLegal.nav')">
    <ul>
      <li v-for="d in DOCS_LEGAUX" :key="d.chemin">
        <a :href="d.chemin" class="lien" aria-haspopup="dialog" @click.prevent="ouvrir(d.chemin)">{{ d.court }}</a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.pied-legal ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap;
  justify-content: center; gap: 0 8px; font-size: .68rem; color: var(--doux); }
/* 28 px de haut : de quoi les toucher, sans l'interligne d'un paragraphe. */
.pied-legal a { display: inline-block; padding: 6px 1px; white-space: nowrap; }
</style>
