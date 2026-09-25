<script setup lang="ts">
/** Mentions legales — art. 6 III de la loi pour la confiance dans l'economie numerique (LCEN). */
const e = EDITEUR
</script>

<template>
  <PageLegale titre="Mentions légales">
    <h2>Éditeur</h2>
    <p>
      {{ e.marque }} est édité par <strong>{{ e.nom }}</strong>, {{ e.forme.toLowerCase() }}.<br>
      SIRET : <ACompleter :v="e.siret" quoi="SIRET" /><br>
      Adresse : <ACompleter :v="e.adresse" quoi="adresse professionnelle" /><br>
      Téléphone : <ACompleter :v="e.telephone" quoi="téléphone" /><br>
      E-mail : <a :href="`mailto:${e.email}`">{{ e.email }}</a>
      <template v-if="e.tva === 'assujetti'">
        <br>N° de TVA intracommunautaire : <ACompleter :v="e.numeroTva" quoi="numéro de TVA" />
      </template>
    </p>
    <p>Directeur de la publication : {{ e.directeurPublication }}.</p>

    <h2>Hébergement</h2>
    <p>
      <strong>{{ HEBERGEUR.nom }}</strong> — {{ HEBERGEUR.adresse }}.<br>
      Téléphone : {{ HEBERGEUR.telephone }} ·
      contact : <a :href="`mailto:${HEBERGEUR.contact}`">{{ HEBERGEUR.contact }}</a> ·
      <a :href="HEBERGEUR.site" rel="noopener">{{ HEBERGEUR.site.replace('https://', '') }}</a>
    </p>
    <p>
      Le même prestataire héberge l’application et sa base de données, conservée
      dans l’Union européenne. Le détail des prestataires et des garanties
      encadrant vos données figure dans la
      <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>.
    </p>

    <h2>Propriété intellectuelle</h2>
    <p>
      L’application, son code, sa conception et ses textes sont la propriété de
      l’éditeur. Toute reproduction non autorisée est interdite, sauf dans les
      limites prévues par la loi.
    </p>
    <p>Les données affichées viennent en partie de sources ouvertes :</p>
    <ul>
      <li>
        <strong>Statistiques de naissances</strong> : Insee, fichier des prénoms
        (millésime 2025), sous
        <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/" rel="noopener">Licence Ouverte 2.0</a>.
        Les indicateurs dérivés (tendances, projections, rareté) sont calculés par babyNamed.
      </li>
      <li>
        <strong>Significations et origines</strong> : en partie issues du
        <a href="https://en.wiktionary.org/" rel="noopener">Wiktionnaire</a>
        (contributeurs du Wiktionary, licence
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" rel="noopener">CC BY-SA 4.0</a>)
        et de <a href="https://www.wikidata.org/" rel="noopener">Wikidata</a> (CC0),
        complétées et reformulées. Les textes adaptés du Wiktionnaire sont diffusés
        sous la même licence CC BY-SA 4.0.
      </li>
      <li>
        <strong>Police de caractères</strong> : Nunito, par Vernon Adams et contributeurs,
        sous <a href="https://openfontlicense.org/" rel="noopener">SIL Open Font License 1.1</a>,
        servie par babyNamed lui-même.
      </li>
    </ul>

    <h2>Nous écrire</h2>
    <p>
      Une question, un problème, une demande sur vos données :
      <a :href="`mailto:${e.email}`">{{ e.email }}</a>.
    </p>
  </PageLegale>
</template>
