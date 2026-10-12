<script setup lang="ts">
import { legalEnFrancais } from '~/utils/pagesLegales'

/**
 * La page /confidentialite : le texte vit dans components/legal/Confidentialite.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/confidentialite')
// Le français fait seul foi ; dans une autre langue, sa traduction anglaise.
const enFrancais = legalEnFrancais
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalConfidentialite v-if="enFrancais" />
    <LegalConfidentialiteEn v-else />
  </PageLegale>
</template>
