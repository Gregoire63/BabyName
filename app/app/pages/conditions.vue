<script setup lang="ts">
/**
 * La page /conditions : le texte vit dans components/legal/Conditions.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/conditions')
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalConditions />
  </PageLegale>
</template>
