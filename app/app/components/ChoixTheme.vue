<script setup lang="ts">
import { useTheme, type Theme } from '~/composables/useTheme'

/**
 * Le choix du thème : trois boutons radio, pas une liste déroulante — les
 * trois options tiennent sur une ligne et se comparent d'un coup d'œil.
 *
 * Un vrai groupe radio (RGAA 11.5) : un seul arrêt de tabulation, les flèches
 * pour changer, et l'état lu par les lecteurs d'écran.
 */
const { choix, choisir } = useTheme()
const nom = useId()

const OPTIONS: { v: Theme; t: string; aide: string }[] = [
  { v: 'clair', t: 'Clair', aide: 'toujours clair' },
  { v: 'systeme', t: 'Système', aide: 'comme le téléphone' },
  { v: 'sombre', t: 'Sombre', aide: 'toujours sombre' }
]
</script>

<template>
  <fieldset class="theme">
    <legend class="sr-only">Thème de l’application</legend>
    <label v-for="o in OPTIONS" :key="o.v" class="option" :class="{ on: choix === o.v }">
      <input type="radio" :name="nom" :value="o.v" :checked="choix === o.v"
             @change="choisir(o.v)">
      <span class="apercu" :class="o.v" aria-hidden="true"><i /><i /></span>
      <strong>{{ o.t }}</strong>
      <span class="aide">{{ o.aide }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.theme { border: 0; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.option { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 11px 6px 9px; border: 1px solid var(--trait); border-radius: var(--r-s);
  background: var(--fond); cursor: pointer; text-align: center; }
.option.on { border-color: var(--encre); box-shadow: inset 0 0 0 1px var(--encre); }
/* Le bouton radio reste dans l'arbre (clavier, lecteur d'écran) mais la case
   entière sert de cible : on le rend invisible sans le retirer. */
.option input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.option:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
.option strong { font-size: .86rem; }
.aide { font-size: .68rem; color: var(--doux); line-height: 1.2; }

/* Une vignette : la page et sa carte, dans les couleurs du thème. Fixes, et
   non tirées des variables : elles montrent l'AUTRE thème aussi. */
.apercu { width: 44px; height: 30px; border-radius: 8px; border: 1px solid var(--trait);
  position: relative; overflow: hidden; background: #fbfaf9; }
.apercu i { position: absolute; left: 7px; right: 7px; height: 7px; border-radius: 3px; background: #fff;
  box-shadow: 0 0 0 1px #ece7e3; }
.apercu i:first-child { top: 6px; } .apercu i:last-child { top: 16px; right: 16px; }
.apercu.sombre { background: #101321; }
.apercu.sombre i { background: #191d2e; box-shadow: 0 0 0 1px #2a2f45; }
.apercu.systeme { background: linear-gradient(135deg, #fbfaf9 50%, #101321 50%); }
.apercu.systeme i { background: color-mix(in srgb, #fff 50%, #191d2e); box-shadow: none; }
</style>
