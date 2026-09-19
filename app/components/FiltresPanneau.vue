<script setup lang="ts">
import { filtresParDefaut, type Filtres } from '~/composables/useCatalogue'
const modele = defineModel<Filtres>({ required: true })
const props = defineProps<{ origines: string[]; nb: number }>()
const emit = defineEmits<{ fermer: [] }>()

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function bascule(liste: string[], v: string) {
  const i = liste.indexOf(v)
  i === -1 ? liste.push(v) : liste.splice(i, 1)
}
function origine(o: string, sens: 'in' | 'out') {
  const autre = sens === 'in' ? modele.value.origines_out : modele.value.origines_in
  const i = autre.indexOf(o); if (i !== -1) autre.splice(i, 1)
  bascule(sens === 'in' ? modele.value.origines_in : modele.value.origines_out, o)
}
const etatOrigine = (o: string) =>
  modele.value.origines_in.includes(o) ? 'in'
  : modele.value.origines_out.includes(o) ? 'out' : null
</script>

<template>
  <div class="carte pile panneau">
    <div class="ligne">
      <h2 style="flex:1">Filtres</h2>
      <button class="btn btn-fantome mini" @click="modele = filtresParDefaut()">Tout remettre</button>
      <button class="btn btn-fantome mini" @click="emit('fermer')">Fermer</button>
    </div>

    <input v-model="modele.recherche" class="champ" placeholder="Chercher un prénom">

    <div>
      <p class="titre">Sexe</p>
      <div class="ligne">
        <button v-for="s in (['f','m','fm'] as const)" :key="s" class="btn mini"
                :class="{ 'btn-principal': modele.sexe.includes(s) }"
                @click="bascule(modele.sexe as string[], s)">
          {{ s === 'f' ? 'fille' : s === 'm' ? 'garçon' : 'mixte' }}
        </button>
      </div>
    </div>

    <div>
      <p class="titre">Origine — un clic pour inclure, deux pour exclure</p>
      <div class="nuage">
        <button v-for="o in props.origines" :key="o" class="puce"
                :class="etatOrigine(o)"
                @click="etatOrigine(o) === 'in' ? origine(o,'out') : etatOrigine(o) === 'out' ? origine(o,'out') : origine(o,'in')">
          {{ o }}
        </button>
      </div>
      <p class="mini doux" style="margin:6px 0 0">
        4 871 prénoms n’ont pas d’origine documentée : un filtre « inclure » les écarte tous.
      </p>
    </div>

    <div class="grille">
      <label>
        <span class="titre">Lettres : {{ modele.car[0] }}–{{ modele.car[1] }}</span>
        <input v-model.number="modele.car[0]" type="range" min="2" max="14">
        <input v-model.number="modele.car[1]" type="range" min="2" max="14">
      </label>
      <label>
        <span class="titre">Syllabes : {{ modele.syllabes[0] }}–{{ modele.syllabes[1] }}</span>
        <input v-model.number="modele.syllabes[0]" type="range" min="1" max="6">
        <input v-model.number="modele.syllabes[1]" type="range" min="1" max="6">
      </label>
      <label>
        <span class="titre">Originalité minimale : {{ modele.originalite[0] }}</span>
        <input v-model.number="modele.originalite[0]" type="range" min="0" max="100">
      </label>
      <label>
        <span class="titre">Risque d’explosion max : {{ modele.risque_max }}</span>
        <input v-model.number="modele.risque_max" type="range" min="0" max="100">
      </label>
    </div>

    <div>
      <p class="titre">Initiales à éviter (celles qui sonnent mal avec le nom)</p>
      <div class="nuage">
        <button v-for="l in LETTRES" :key="l" class="puce petite"
                :class="{ out: modele.initiales_out.includes(l) }"
                @click="bascule(modele.initiales_out, l)">{{ l }}</button>
      </div>
    </div>

    <div class="pile" style="gap:8px">
      <label class="ligne mini"><input v-model="modele.sens_requis" type="checkbox"> Seulement ceux dont on connaît le sens</label>
      <label class="ligne mini"><input v-model="modele.exclure_objet" type="checkbox"> Écarter les prénoms qui sont aussi un objet ou une marque</label>
      <label class="ligne mini"><input v-model="modele.revival_seulement" type="checkbox"> Seulement les prénoms d’avant 1970 qui remontent</label>
      <label class="ligne mini">
        <input type="checkbox" :checked="modele.compose === false"
               @change="modele.compose = modele.compose === false ? null : false"> Pas de prénoms composés
      </label>
    </div>

    <p class="resultat">{{ props.nb }} prénoms passent</p>
  </div>
</template>

<style scoped>
.panneau { margin-bottom: 16px; }
.titre { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em;
  color: var(--doux); margin: 0 0 6px; font-weight: 600; }
.nuage { display: flex; flex-wrap: wrap; gap: 6px; }
.puce { border: 1px solid var(--trait); background: var(--carte); color: var(--doux);
  border-radius: 999px; padding: 5px 11px; font-size: .78rem; cursor: pointer; font: inherit;
  font-size: .78rem; }
.puce.petite { padding: 4px 9px; min-width: 32px; }
.puce.in { background: var(--oui); border-color: var(--oui); color: #fff; }
.puce.out { background: var(--non); border-color: var(--non); color: #fff; text-decoration: line-through; }
.grille { display: grid; gap: 14px; }
.grille label { display: block; }
.grille input[type=range] { width: 100%; accent-color: var(--accent); }
.resultat { text-align: center; font-weight: 650; margin: 0; }
</style>
