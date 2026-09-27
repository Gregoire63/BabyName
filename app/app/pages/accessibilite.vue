<script setup lang="ts">
/**
 * La page /accessibilite : le texte vit dans components/legal/Accessibilite.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/accessibilite')
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalAccessibilite />
  </PageLegale>
</template>
