<script setup lang="ts">
import { filtresParDefaut, type Filtres } from '~/composables/useCatalogue'
const modele = defineModel<Filtres>({ required: true })
const props = defineProps<{ origines: string[]; nb: number }>()
const emit = defineEmits<{ fermer: [] }>()

const dedans = ref<HTMLElement>()
const f = useFeuille(() => emit('fermer'), dedans)

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
  <div class="voile" @click.self="emit('fermer')">
    <div class="feuille" :style="f.style.value"
         @pointerdown="f.debut" @pointermove="f.bouge"
         @pointerup="f.fin" @pointercancel="f.fin">
      <div class="poignee" />
      <div ref="dedans" class="dedans pile">
        <div class="ligne">
          <h2 style="flex:1">Filtres</h2>
          <button class="btn btn-0 mini doux" @click="modele = filtresParDefaut()">Remettre à zéro</button>
        </div>

        <input v-model="modele.recherche" class="champ" placeholder="Chercher un prénom"
               autocapitalize="off">

        <div>
          <p class="titre">Sexe</p>
          <div class="nuage">
            <button v-for="s in (['f','m','fm'] as const)" :key="s" class="jeton"
                    :class="{ in: modele.sexe.includes(s) }"
                    @click="bascule(modele.sexe as string[], s)">
              {{ s === 'f' ? 'fille' : s === 'm' ? 'garçon' : 'mixte' }}
            </button>
          </div>
        </div>

        <div>
          <p class="titre">Origine — 1 clic inclut, 2 excluent</p>
          <div class="nuage">
            <button v-for="o in props.origines" :key="o" class="jeton"
                    :class="etatOrigine(o)" @click="cycler(o)">{{ o }}</button>
          </div>
          <p class="mini doux" style="margin:7px 0 0">
            Beaucoup de prénoms n’ont aucune origine documentée : inclure une origine les écarte tous.
          </p>
        </div>

        <!-- Deux curseurs cote a cote sans rien pour les distinguer, on ne
             savait pas lequel etait le minimum. Chacun porte desormais son
             role et sa valeur. -->
        <div class="regle">
          <p class="titre">Longueur du prénom · en lettres</p>
          <label class="borne">
            <span>au moins</span>
            <input v-model.number="modele.car[0]" type="range" min="2" :max="modele.car[1]">
            <b>{{ modele.car[0] }}</b>
          </label>
          <label class="borne">
            <span>au plus</span>
            <input v-model.number="modele.car[1]" type="range" :min="modele.car[0]" max="14">
            <b>{{ modele.car[1] }}</b>
          </label>
        </div>

        <div class="regle">
          <p class="titre">Nombre de syllabes</p>
          <label class="borne">
            <span>au moins</span>
            <input v-model.number="modele.syllabes[0]" type="range" min="1" :max="modele.syllabes[1]">
            <b>{{ modele.syllabes[0] }}</b>
          </label>
          <label class="borne">
            <span>au plus</span>
            <input v-model.number="modele.syllabes[1]" type="range" :min="modele.syllabes[0]" max="6">
            <b>{{ modele.syllabes[1] }}</b>
          </label>
        </div>

        <div class="pile" style="gap:9px">
          <label class="ligne mini">
            <input type="checkbox" :checked="modele.compose === false"
                   @change="modele.compose = modele.compose === false ? null : false">
            Pas de prénoms composés
          </label>
          <label class="ligne mini">
            <input v-model="modele.sens_requis" type="checkbox">
            Seulement ceux dont on connaît le sens
          </label>
          <label class="ligne mini">
            <input v-model="modele.exclure_objet" type="checkbox">
            Écarter ceux qui sont aussi un objet ou une marque
          </label>
        </div>

        <button class="btn btn-0 mini doux" style="align-self:flex-start"
                @click="avance = !avance">
          {{ avance ? '− Moins d’options' : '+ Options fines' }}
        </button>

        <template v-if="avance">
          <label class="regle">
            <span class="titre">Originalité minimale · {{ modele.originalite[0] }}/100</span>
            <input v-model.number="modele.originalite[0]" type="range" min="0" max="100">
          </label>
          <label class="regle">
            <span class="titre">Risque d’explosion maximal · {{ modele.risque_max }}/100</span>
            <input v-model.number="modele.risque_max" type="range" min="0" max="100">
          </label>
          <div>
            <p class="titre">Initiales à éviter</p>
            <div class="nuage">
              <button v-for="l in LETTRES" :key="l" class="jeton petit"
                      :class="{ out: modele.initiales_out.includes(l) }"
                      @click="bascule(modele.initiales_out, l)">{{ l }}</button>
            </div>
          </div>
          <label class="ligne mini">
            <input v-model="modele.revival_seulement" type="checkbox">
            Seulement les prénoms d’avant 1970 qui remontent
          </label>
        </template>
      </div>

      <div class="pied">
        <button class="btn btn-1" style="width:100%" @click="emit('fermer')">
          {{ props.nb.toLocaleString('fr-FR') }} prénoms — voir
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voile { position: fixed; inset: 0; z-index: 55; background: rgba(26,35,78,.42);
  backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; }
.feuille { width: 100%; max-width: 560px; max-height: 92%; background: var(--carte);
  border-radius: 22px 22px 0 0; display: flex; flex-direction: column;
  animation: monte .24s cubic-bezier(.2,.8,.3,1); }
@keyframes monte { from { transform: translateY(18px); opacity: .6 } }
.feuille { touch-action: none; }
.poignee { width: 42px; height: 5px; border-radius: 999px; background: var(--trait);
  margin: 10px auto 4px; flex: none; }
.dedans { touch-action: pan-y; }
.pied { touch-action: auto; }
.dedans { overflow-y: auto; overscroll-behavior: contain; padding: 8px 20px 16px; }
.pied { padding: 10px 20px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--trait); }

.titre { display: block; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em;
  color: var(--doux); margin: 0 0 7px; font-weight: 650; }
.nuage { display: flex; flex-wrap: wrap; gap: 6px; }
.jeton { border: 1px solid var(--trait); background: var(--carte); color: var(--doux);
  border-radius: 999px; padding: 6px 12px; font: inherit; font-size: .78rem; cursor: pointer; }
.jeton.petit { padding: 4px 9px; min-width: 32px; }
.jeton.in { background: var(--encre); border-color: var(--encre); color: var(--fond); }
.jeton.out { background: color-mix(in srgb, var(--peche) 70%, transparent);
  border-color: transparent; color: var(--texte); text-decoration: line-through; }
.regle input[type=range] { width: 100%; accent-color: var(--encre); flex: 1; min-width: 0; }
.borne { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.borne > span { font-size: .72rem; color: var(--doux); width: 64px; flex: none;
  text-align: right; font-weight: 600; white-space: nowrap; }
.borne > b { width: 22px; flex: none; text-align: center; font-variant-numeric: tabular-nums;
  font-weight: 800; }
</style>
