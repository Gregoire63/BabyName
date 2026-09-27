<script setup lang="ts">
/**
 * La page /mentions-legales : le texte vit dans components/legal/Mentions.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/mentions-legales')
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalMentions />
  </PageLegale>
</template>
