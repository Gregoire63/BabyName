<script setup lang="ts">
import { legalEnFrancais } from '~/utils/pagesLegales'

/**
 * La page /conditions : le texte vit dans components/legal/Conditions.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/conditions')
// Le français fait seul foi ; dans une autre langue, sa traduction anglaise.
const enFrancais = legalEnFrancais
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalConditions v-if="enFrancais" />
    <LegalConditionsEn v-else />
  </PageLegale>
</template>
