<script setup lang="ts">
/**
 * La page /confidentialite : le texte vit dans components/legal/Confidentialite.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/confidentialite')
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalConfidentialite />
  </PageLegale>
</template>
