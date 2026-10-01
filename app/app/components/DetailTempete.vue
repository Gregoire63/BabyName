<script setup lang="ts">
import { ilYA, leNom, memeEcriture, phraseOreille, siteSource, titreTempete, type Tempete } from '~/utils/tempetes'

/**
 * Une tempête racontée en quelques lignes : quand, où, il y a combien de
 * temps, le bilan, ce qui a marqué, si le nom a été rayé des listes, et où en
 * lire plus. Le même texte dans la feuille de l'icône (FeuilleTempete) et
 * dans la fiche du prénom : on lit la même chose par les deux chemins.
 *
 * « il y a 9 ans » plutôt qu'une date seule : c'est ce qui dit si l'on s'en
 * souvient encore autour de soi.
 */
withDefaults(defineProps<{
  t: Tempete
  /** Le prénom regardé : la phrase « se prononce comme » quand il s'écrit autrement. */
  prenom: string
  /** Le nom de la tempête en tête (la feuille d'une seule tempête l'a déjà en titre). */
  titre?: boolean
}>(), { titre: true })
</script>

<template>
  <div class="tempete">
    <p v-if="titre" class="titre"><strong>{{ titreTempete(t) }}</strong></p>
    <p class="quand">{{ t.quand }} · {{ t.ou }} · {{ ilYA(t.an) }}</p>
    <p v-if="!memeEcriture(prenom, t)" class="oreille">{{ phraseOreille(prenom, t) }}</p>
    <p class="bilan">{{ t.bilan }}</p>
    <p v-if="t.recit" class="recit">{{ t.recit }}</p>
    <p v-if="t.retire" class="retire">
      Nom rayé des listes : plus aucune tempête de l’Atlantique ne s’appellera {{ t.nom }}.
    </p>
    <a class="source" :href="t.source" target="_blank" rel="noopener noreferrer">
      En savoir plus sur {{ siteSource(t.source) }}<span class="sr-only"> : {{ leNom(t) }}, nouvel onglet</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>
    </a>
  </div>
</template>

<style scoped>
.tempete { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.tempete p { margin: 0; line-height: 1.4; }
.titre { font-size: .98rem; }
.quand { font-size: .8rem; color: var(--doux); }
.oreille { font-size: .88rem; font-style: italic; }
.bilan { font-size: .95rem; font-weight: 650; }
.recit { font-size: .9rem; }
.retire { font-size: .8rem; color: var(--doux); }
/* Un vrai lien, souligné, assez haut pour le pouce (24 px au moins). */
.source { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px;
  min-height: 28px; font-size: .82rem; font-weight: 700; color: var(--texte);
  text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.source svg { width: 14px; height: 14px; flex: none; fill: none; stroke: currentColor;
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
