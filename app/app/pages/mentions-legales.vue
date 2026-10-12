<script setup lang="ts">
import { legalEnFrancais } from '~/utils/pagesLegales'

/**
 * La page /mentions-legales : le texte vit dans components/legal/Mentions.vue, que la
 * feuille des textes légaux (FeuilleLegale) montre aussi. Cette page sert à
 * qui arrive par un lien direct : un moteur, une facture, un e-mail.
 */
const d = docLegal('/mentions-legales')
// Le français fait seul foi ; dans une autre langue, sa traduction anglaise.
const enFrancais = legalEnFrancais
</script>

<template>
  <PageLegale :titre="d.titre" :version="d.version">
    <LegalMentions v-if="enFrancais" />
    <LegalMentionsEn v-else />
  </PageLegale>
</template>
