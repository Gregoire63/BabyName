<script setup lang="ts">
import { lireLegalEnFrancais } from '~/utils/pagesLegales'

/**
 * Traduction anglaise des mentions legales (legal/Mentions.vue). Le francais
 * fait seul foi : changer l'un, c'est changer l'autre.
 */
const e = EDITEUR
</script>

<template>
  <p class="avis-traduction">
    <em>This is a translation provided for convenience. The French version is the only legally binding one.</em>
    <button type="button" class="lien-fr" @click="lireLegalEnFrancais()">Read the French version</button>
  </p>

  <h2>Publisher</h2>
  <p>
    {{ e.marque }} is published by <strong>{{ e.nom }}</strong>, {{ e.formeEn }} (<span lang="fr">{{ e.forme.toLowerCase() }}</span>).<br>
    SIRET: <ACompleter :v="e.siret" quoi="SIRET" /><br>
    Address: <ACompleter :v="e.adresse" quoi="business address" /><br>
    Telephone: <ACompleter :v="e.telephone" quoi="telephone" /><br>
    Email: <a :href="`mailto:${e.email}`">{{ e.email }}</a>
    <template v-if="e.tva === 'assujetti'">
      <br>Intra-Community VAT number: <ACompleter :v="e.numeroTva" quoi="VAT number" />
    </template>
  </p>
  <p>Director of publication: {{ e.directeurPublication }}.</p>

  <h2>Hosting</h2>
  <p>
    <strong>{{ HEBERGEUR.nom }}</strong>, {{ HEBERGEUR.adresse }}.<br>
    Telephone: {{ HEBERGEUR.telephone }} ·
    contact: <a :href="`mailto:${HEBERGEUR.contact}`">{{ HEBERGEUR.contact }}</a> ·
    <a :href="HEBERGEUR.site" rel="noopener">{{ HEBERGEUR.site.replace('https://', '') }}</a>
  </p>
  <p>
    The same provider hosts the application and its database, which is kept
    in the European Union. Details of the providers and of the safeguards
    governing your data are set out in the
    <NuxtLink to="/confidentialite">privacy policy</NuxtLink>.
  </p>

  <h2>Intellectual property</h2>
  <p>
    The application, its code, its design and its texts are the property of
    the publisher. Any unauthorised reproduction is prohibited, except within
    the limits provided for by law.
  </p>
  <p>The data displayed come in part from open sources:</p>
  <ul>
    <li>
      <strong>Birth statistics</strong>: Insee (French national statistics institute), first names file
      (2025 edition), under the
      <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" rel="noopener">Licence Ouverte 2.0</a> (Open Licence 2.0).
      Derived indicators (trends, projections, rarity) are calculated by babyNamed.
    </li>
    <li>
      <strong>Meanings and origins</strong>: partly taken from
      <a href="https://en.wiktionary.org/" rel="noopener">Wiktionary</a>
      (Wiktionary contributors, licence
      <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" rel="noopener">CC BY-SA 4.0</a>)
      and from <a href="https://www.wikidata.org/" rel="noopener">Wikidata</a> (CC0),
      supplemented and reworded. Texts adapted from Wiktionary are distributed
      under the same CC BY-SA 4.0 licence.
    </li>
    <li>
      <strong>Typeface</strong>: Nunito, by Vernon Adams and contributors,
      under the <a href="https://openfontlicense.org/" rel="noopener">SIL Open Font License 1.1</a>,
      served by babyNamed itself.
    </li>
  </ul>

  <h2>Contact us</h2>
  <p>
    A question, a problem, a request about your data:
    <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
  </p>
</template>

<style scoped>
.avis-traduction { font-size: .9rem; color: var(--doux); }
.lien-fr { border: 0; background: none; padding: 0; font: inherit; color: var(--texte);
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
</style>
