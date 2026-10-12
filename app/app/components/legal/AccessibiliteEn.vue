<script setup lang="ts">
import { lireLegalEnFrancais } from '~/utils/pagesLegales'

/**
 * Traduction anglaise de la declaration d'accessibilite
 * (legal/Accessibilite.vue). Le francais fait seul foi : changer l'un, c'est
 * changer l'autre.
 */
const e = EDITEUR
// La date suit le texte, en anglais.
const auditLe = computed(() => new Date(`${VERSIONS_TEXTES.accessibilite}T12:00:00`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
</script>

<template>
  <p class="avis-traduction">
    <em>This is a translation provided for convenience. The French version is the only legally binding one.</em>
    <button type="button" class="lien-fr" @click="lireLegalEnFrancais()">Read the French version</button>
  </p>

  <p>
    {{ e.nom }} is committed to making babyNamed accessible to all, in accordance with the
    <span lang="fr">référentiel général d’amélioration de l’accessibilité</span> (RGAA, French general
    accessibility improvement framework, version 4.1.2), which incorporates the level AA criteria of the
    international WCAG 2.1 guidelines. This statement applies to the babyNamed application.
    It is voluntary: the publisher, a micro-enterprise, is not subject to the legal obligation.
  </p>

  <h2>Compliance status</h2>
  <p>
    babyNamed is <strong>partially compliant</strong> with RGAA 4.1.2. No full audit has been
    carried out by an external body: this status is based on an internal audit, described below.
  </p>

  <h2>What has been done</h2>
  <ul>
    <li>Contrast of text and controls raised to level AA, in the light theme as in the dark theme.</li>
    <li>The whole app can be navigated with the keyboard, with a visible focus; sorting can also be done with the arrow keys (← no, → yes, ↓ neutral) or with the three buttons, without ever needing the swipe gesture.</li>
    <li>Windows (name pages, filters, purchase, account) behave as dialogs: focus moves into them, stays inside, returns to where it was on closing, and Escape closes them.</li>
    <li>Each name that arrives in the sorting is announced to screen readers; each screen has a title, announced at every change.</li>
    <li>Birth charts have a text description; all input fields have a label.</li>
    <li>Animations stop when the system asks for reduced motion; the app works in landscape as in portrait, and zoom is never blocked.</li>
  </ul>

  <h2>Non-accessible content</h2>
  <h3>Known non-compliance</h3>
  <ul>
    <li>First names of foreign origin are not marked up in their language: a speech synthesiser reads them the French way (criterion 8.7).</li>
    <li>Birth charts are summarised in one sentence (trend, peak year); the year-by-year values are not offered as a table (criterion 1.3).</li>
  </ul>
  <h3>Exemptions</h3>
  <p>None.</p>

  <h2>Preparation of this statement</h2>
  <p>Statement drawn up on {{ auditLe }}.</p>
  <ul>
    <li><strong>Technologies</strong>: HTML, CSS, JavaScript (Vue and Nuxt), WAI-ARIA.</li>
    <li><strong>Method</strong>: automated axe-core tests (WCAG 2.0 and 2.1 rules, levels A and AA) on every screen of the application, in the light theme and in the dark theme, rerun at every change; manual keyboard checks.</li>
    <li><strong>Test environment</strong>: Chromium, on desktop and in mobile view.</li>
    <li><strong>Pages checked</strong>: sign-in, home, sorting, name search, ranking (shared, to review, my choices, portrait), list settings, name page, filters, list creation, purchase, account and information pages.</li>
  </ul>

  <h2>Feedback and contact</h2>
  <p>
    Is some content or a feature inaccessible to you? Write to
    <a :href="`mailto:${e.email}`">{{ e.email }}</a> describing what is blocking you: we will
    give you an answer or an alternative, and fix what can be fixed.
  </p>

  <h2>Remedies</h2>
  <p>
    If you have reported an accessibility defect to us without receiving a satisfactory answer, you
    may refer the matter to the <span lang="fr">Défenseur des droits</span> (French Defender of Rights):
  </p>
  <ul>
    <li>through the <a href="https://formulaire.defenseurdesdroits.fr/" rel="noopener">online form</a>;</li>
    <li>by contacting <a href="https://www.defenseurdesdroits.fr/carte-des-delegues" rel="noopener">the delegate for your region</a>;</li>
    <li>by post, free of charge and without a stamp: <span lang="fr">Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07</span>.</li>
  </ul>
</template>

<style scoped>
.avis-traduction { font-size: .9rem; color: var(--doux); }
.lien-fr { border: 0; background: none; padding: 0; font: inherit; color: var(--texte);
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
</style>
