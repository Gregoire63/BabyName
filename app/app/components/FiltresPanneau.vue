<script setup lang="ts">
import { filtresParDefaut, type Filtres } from '~/composables/useCatalogue'
const modele = defineModel<Filtres>({ required: true })
const props = defineProps<{ origines: string[]; nb: number; nbRares: number }>()
const emit = defineEmits<{ fermer: [] }>()

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const avance = ref(false)

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
function cycler(o: string) {
  const e = etatOrigine(o)
  if (e === null) origine(o, 'in')
  else if (e === 'in') { origine(o, 'in'); origine(o, 'out') }
  else origine(o, 'out')
}
</script>

<template>
  <Feuille titre="Filtres" @fermer="emit('fermer')">
    <template #action>
      <button class="btn btn-0 mini doux" @click="modele = filtresParDefaut()">
        Remettre à zéro
      </button>
    </template>

    <!-- Des blocs nets, un réglage chacun : la feuille était une colonne de
         petits titres gris et de cases par défaut, où rien ne se détachait. -->
    <div class="blocs">
      <section class="bloc" aria-labelledby="f-sexe">
        <h3 id="f-sexe" class="titre">Sexe</h3>
        <div class="trois">
          <button v-for="s in (['f','m','fm'] as const)" :key="s" type="button" class="jeton tuile"
                  :class="{ in: modele.sexe.includes(s) }"
                  :aria-pressed="modele.sexe.includes(s)"
                  @click="bascule(modele.sexe as string[], s)">
            {{ s === 'f' ? 'fille' : s === 'm' ? 'garçon' : 'mixte' }}
          </button>
        </div>
      </section>

      <!-- Chaque curseur dit son rôle et sa valeur : deux curseurs côte à
           côte sans rien pour les distinguer, on ne savait pas lequel était
           le minimum. -->
      <section class="bloc" aria-labelledby="f-long">
        <div class="tete">
          <h3 id="f-long" class="titre">Longueur</h3>
          <span class="valeur">{{ modele.car[0] }}–{{ modele.car[1] }} lettres</span>
        </div>
        <label class="borne">
          <span>au moins</span>
          <input v-model.number="modele.car[0]" type="range" min="2" :max="modele.car[1]"
                 aria-label="Longueur minimale, en lettres">
          <b>{{ modele.car[0] }}</b>
        </label>
        <label class="borne">
          <span>au plus</span>
          <input v-model.number="modele.car[1]" type="range" :min="modele.car[0]" max="14"
                 aria-label="Longueur maximale, en lettres">
          <b>{{ modele.car[1] }}</b>
        </label>
      </section>

      <section class="bloc" aria-labelledby="f-syl">
        <div class="tete">
          <h3 id="f-syl" class="titre">Syllabes</h3>
          <span class="valeur">{{ modele.syllabes[0] === modele.syllabes[1] ? modele.syllabes[0]
            : `${modele.syllabes[0]}–${modele.syllabes[1]}` }}</span>
        </div>
        <label class="borne">
          <span>au moins</span>
          <input v-model.number="modele.syllabes[0]" type="range" min="1" :max="modele.syllabes[1]"
                 aria-label="Nombre minimal de syllabes">
          <b>{{ modele.syllabes[0] }}</b>
        </label>
        <label class="borne">
          <span>au plus</span>
          <input v-model.number="modele.syllabes[1]" type="range" :min="modele.syllabes[0]" max="6"
                 aria-label="Nombre maximal de syllabes">
          <b>{{ modele.syllabes[1] }}</b>
        </label>
      </section>

      <section class="bloc" aria-labelledby="f-orig">
        <div class="tete">
          <h3 id="f-orig" class="titre">Origines</h3>
          <!-- la légende tient lieu de mode d'emploi -->
          <span class="legende" aria-hidden="true">
            <span class="jeton mini-jeton in">incluse</span>
            <span class="jeton mini-jeton out">exclue</span>
          </span>
        </div>
        <div class="nuage">
          <!-- Trois états (rien, incluse, exclue) : la couleur seule ne les
               dit pas à un lecteur d'écran, le texte caché si. -->
          <button v-for="o in props.origines" :key="o" type="button" class="jeton"
                  :class="etatOrigine(o)" @click="cycler(o)">
            {{ o }}<span class="sr-only">{{ etatOrigine(o) === 'in' ? ' : incluse'
              : etatOrigine(o) === 'out' ? ' : exclue' : ' : indifférente' }}</span>
          </button>
        </div>
        <p v-if="modele.origines_in.length" class="mini doux" style="margin:10px 0 0">
          Les prénoms sans origine connue sont écartés.
        </p>
      </section>

      <section class="bloc interrupteurs" aria-label="Autres filtres">
        <label class="inter">
          <span>Pas de prénoms composés</span>
          <input type="checkbox" role="switch" :checked="modele.compose === false"
                 @change="modele.compose = modele.compose === false ? null : false">
        </label>
        <label class="inter">
          <span>Seulement ceux dont on connaît le sens</span>
          <input v-model="modele.sens_requis" type="checkbox" role="switch">
        </label>
        <label class="inter">
          <span>Écarter ceux qui sont aussi un objet ou une marque</span>
          <input v-model="modele.exclure_objet" type="checkbox" role="switch">
        </label>
        <label class="inter">
          <span>
            Inclure les prénoms très rares<template v-if="props.nbRares"> — + {{ props.nbRares.toLocaleString('fr-FR') }}</template>
            <small>Moins de 20 naissances en trois ans</small>
          </span>
          <input v-model="modele.inclure_rares" type="checkbox" role="switch">
        </label>
      </section>

      <button type="button" class="deplier" :aria-expanded="avance" @click="avance = !avance">
        <span>Options fines</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" :class="{ ouvert: avance }"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      <template v-if="avance">
        <section class="bloc">
          <label class="regle">
            <span class="tete"><span class="titre">Originalité minimale</span>
              <span class="valeur">{{ modele.originalite[0] }}/100</span></span>
            <input v-model.number="modele.originalite[0]" type="range" min="0" max="100">
          </label>
          <label class="regle" style="margin-top:12px">
            <span class="tete"><span class="titre">Risque d’explosion maximal</span>
              <span class="valeur">{{ modele.risque_max }}/100</span></span>
            <input v-model.number="modele.risque_max" type="range" min="0" max="100">
          </label>
        </section>
        <section class="bloc" aria-labelledby="f-init">
          <h3 id="f-init" class="titre">Initiales à éviter</h3>
          <div class="nuage">
            <button v-for="l in LETTRES" :key="l" type="button" class="jeton petit"
                    :class="{ out: modele.initiales_out.includes(l) }"
                    :aria-pressed="modele.initiales_out.includes(l)"
                    :aria-label="`Éviter l’initiale ${l}`"
                    @click="bascule(modele.initiales_out, l)">{{ l }}</button>
          </div>
        </section>
        <section class="bloc interrupteurs">
          <label class="inter">
            <span>Seulement les prénoms d’avant 1970 qui remontent</span>
            <input v-model="modele.revival_seulement" type="checkbox" role="switch">
          </label>
        </section>
      </template>
    </div>

    <template #pied="{ fermer }">
      <button class="btn btn-1" style="width:100%" @click="fermer">
        {{ props.nb.toLocaleString('fr-FR') }} prénoms — voir
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.blocs { display: flex; flex-direction: column; gap: 12px; }
.bloc { background: var(--fond); border: 1px solid var(--trait); border-radius: var(--r-s);
  padding: 14px 14px 12px; }
.tete { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  margin: 0 0 10px; }
.tete .titre { margin: 0; }
.titre { display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .06em;
  color: var(--doux); margin: 0 0 10px; font-weight: 700; }
.valeur { font-size: .86rem; font-weight: 800; color: var(--texte); font-variant-numeric: tabular-nums; }

.trois { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.nuage { display: flex; flex-wrap: wrap; gap: 7px; }
.jeton { border: 1px solid var(--trait); background: var(--carte); color: var(--texte);
  border-radius: 999px; padding: 7px 13px; font: inherit; font-size: .8rem; font-weight: 600;
  cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.jeton.tuile { border-radius: 12px; padding: 11px 6px; font-size: .9rem; text-align: center; }
.jeton.petit { padding: 5px 9px; min-width: 34px; }
.jeton.in { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.jeton.out { background: color-mix(in srgb, var(--peche) 70%, transparent);
  border-color: transparent; color: var(--texte); text-decoration: line-through; }
.legende { display: inline-flex; gap: 5px; }
.mini-jeton { padding: 2px 8px; font-size: .66rem; cursor: default; }

/* les curseurs, à la couleur de l'app */
.borne { display: flex; align-items: center; gap: 10px; }
.borne + .borne { margin-top: 8px; }
.borne > span { font-size: .74rem; color: var(--doux); width: 58px; flex: none; font-weight: 600;
  white-space: nowrap; }
.borne > b { width: 24px; flex: none; text-align: right; font-variant-numeric: tabular-nums;
  font-weight: 800; }
input[type=range] { flex: 1; min-width: 0; width: 100%; height: 28px; margin: 0; background: none;
  -webkit-appearance: none; appearance: none; cursor: pointer; }
input[type=range]::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: var(--trait); }
input[type=range]::-moz-range-track { height: 6px; border-radius: 999px; background: var(--trait); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px;
  margin-top: -8px; border-radius: 50%; background: var(--carte); border: 2px solid var(--encre);
  box-shadow: 0 1px 4px rgba(26,35,78,.25); }
input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--carte);
  border: 2px solid var(--encre); box-shadow: 0 1px 4px rgba(26,35,78,.25); }
input[type=range]:focus-visible { outline: 2px solid var(--encre); outline-offset: 2px; border-radius: 999px; }
.regle { display: block; }
.regle .tete { margin-bottom: 4px; }

/* les cases, en interrupteurs : une ligne par réglage, l'interrupteur à droite */
.interrupteurs { padding: 2px 14px; }
.inter { display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 12px 0; font-size: .88rem; font-weight: 600; cursor: pointer; }
.inter + .inter { border-top: 1px solid var(--trait); }
.inter small { display: block; font-size: .74rem; font-weight: 500; color: var(--doux); margin-top: 2px; }
/* Le rond reste blanc, clair comme sombre ; « oui » est vert, comme partout. */
.inter input { -webkit-appearance: none; appearance: none; flex: none; width: 44px; height: 26px;
  border-radius: 999px; background: color-mix(in srgb, var(--doux) 38%, transparent);
  position: relative; margin: 0; cursor: pointer; transition: background .18s; }
.inter input::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3);
  transition: transform .18s; }
.inter input:checked { background: var(--oui); }
.inter input:checked::after { transform: translateX(18px); }
.inter input:focus-visible { outline: 2px solid var(--encre); outline-offset: 2px; }

.deplier { display: flex; align-items: center; justify-content: space-between; width: 100%;
  border: 0; background: none; padding: 6px 4px; font: inherit; font-weight: 700; font-size: .88rem;
  color: var(--doux); cursor: pointer; }
.deplier svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4;
  stroke-linecap: round; stroke-linejoin: round; transition: transform .2s; }
.deplier svg.ouvert { transform: rotate(180deg); }
</style>
