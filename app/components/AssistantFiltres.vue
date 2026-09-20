<script setup lang="ts">
import { chargerCatalogue, filtrer, filtresParDefaut, type Prenom, type Filtres }
  from '~/composables/useCatalogue'

const emit = defineEmits<{ fermer: []; valider: [f: Filtres] }>()

const f = ref<Filtres>(filtresParDefaut())
const catalogue = ref<Prenom[]>([])
const origines = ref<string[]>([])
const etape = ref(0)
const envoi = ref(false)

onMounted(async () => {
  const c = await chargerCatalogue()
  catalogue.value = c!.liste
  // On ne propose que les origines qui pesent vraiment, sinon le choix est du bruit.
  const compte = new Map<string, number>()
  for (const p of c!.liste) for (const o of p.g) compte.set(o, (compte.get(o) ?? 0) + 1)
  origines.value = [...compte.entries()].filter(([, n]) => n >= 60)
    .sort((a, b) => b[1] - a[1]).map(([o]) => o)
})

const nb = computed(() => catalogue.value.length ? filtrer(catalogue.value, f.value).length : 0)

const ETAPES = ['Pour qui', 'Le style', 'La forme', 'Les origines']

function sexe(v: 'f' | 'm' | 'tous') {
  f.value.sexe = v === 'tous' ? ['f', 'm', 'fm'] : [v, 'fm']
  suite()
}
function style(v: 'repandu' | 'milieu' | 'rare') {
  if (v === 'repandu') { f.value.originalite = [0, 45]; f.value.risque_max = 100 }
  else if (v === 'milieu') { f.value.originalite = [25, 80]; f.value.risque_max = 70 }
  else { f.value.originalite = [55, 100]; f.value.risque_max = 45 }
  suite()
}
function forme(v: 'court' | 'moyen' | 'libre') {
  if (v === 'court') { f.value.syllabes = [1, 2]; f.value.car = [2, 7] }
  else if (v === 'moyen') { f.value.syllabes = [2, 3]; f.value.car = [4, 10] }
  else { f.value.syllabes = [1, 6]; f.value.car = [2, 14] }
  suite()
}
function basculerOrigine(o: string) {
  const i = f.value.origines_in.indexOf(o)
  i === -1 ? f.value.origines_in.push(o) : f.value.origines_in.splice(i, 1)
}

function suite() { if (etape.value < ETAPES.length - 1) etape.value++ }
function retour() { if (etape.value > 0) etape.value-- }

function valider() {
  envoi.value = true
  emit('valider', f.value)
}
function sansFiltre() {
  envoi.value = true
  emit('valider', filtresParDefaut())
}

const selection = computed(() => {
  const s = f.value.sexe
  const q = s.length === 3 ? 'fille ou garçon' : s.includes('f') ? 'fille' : 'garçon'
  return q
})
</script>

<template>
  <Feuille plein titre="Créer une liste" @fermer="emit('fermer')">
    <template #action>
      <div class="points">
        <i v-for="(e, i) in ETAPES" :key="e" :class="{ on: i <= etape }" />
      </div>
      <button class="btn btn-0 mini doux" :disabled="etape === 0" @click="retour">Retour</button>
    </template>

    <div class="corps">
      <template v-if="etape === 0">
        <h1>Vous cherchez un prénom pour…</h1>
        <p class="doux">On peut tout changer plus tard, rien n’est figé.</p>
        <div class="choix">
          <button class="carte opt" @click="sexe('f')"><strong>Une fille</strong></button>
          <button class="carte opt" @click="sexe('m')"><strong>Un garçon</strong></button>
          <button class="carte opt" @click="sexe('tous')">
            <strong>On ne sait pas encore</strong>
            <span class="mini doux">Les deux, et les mixtes</span>
          </button>
        </div>
      </template>

      <template v-else-if="etape === 1">
        <h1>Plutôt répandu, ou plutôt rare ?</h1>
        <p class="doux">
          Un prénom rare qui monte vite finit souvent en triple dans la classe.
          Le filtre « rare » écarte aussi ceux-là.
        </p>
        <div class="choix">
          <button class="carte opt" @click="style('repandu')">
            <strong>Répandu, assumé</strong>
            <span class="mini doux">Il sera porté par d’autres, et c’est très bien</span>
          </button>
          <button class="carte opt" @click="style('milieu')">
            <strong>Connu sans être partout</strong>
            <span class="mini doux">Le compromis le plus fréquent</span>
          </button>
          <button class="carte opt" @click="style('rare')">
            <strong>Rare, et qui le reste</strong>
            <span class="mini doux">Rare aujourd’hui et sans signe d’explosion</span>
          </button>
        </div>
      </template>

      <template v-else-if="etape === 2">
        <h1>Court ou long ?</h1>
        <p class="doux">À dire dix fois par jour pendant vingt ans.</p>
        <div class="choix">
          <button class="carte opt" @click="forme('court')">
            <strong>Court</strong><span class="mini doux">1 ou 2 syllabes</span>
          </button>
          <button class="carte opt" @click="forme('moyen')">
            <strong>Moyen</strong><span class="mini doux">2 ou 3 syllabes</span>
          </button>
          <button class="carte opt" @click="forme('libre')">
            <strong>Peu importe</strong>
          </button>
        </div>
      </template>

      <template v-else>
        <h1>Une origine en tête ?</h1>
        <p class="doux">
          Facultatif. Attention : beaucoup de prénoms n’ont pas d’origine documentée —
          en choisir une les écarte tous.
        </p>
        <div class="nuage">
          <button v-for="o in origines" :key="o" class="jeton"
                  :class="{ in: f.origines_in.includes(o) }" @click="basculerOrigine(o)">
            {{ o }}
          </button>
        </div>
        <label class="ligne mini" style="margin-top:6px">
          <input type="checkbox" :checked="f.compose === false"
                 @change="f.compose = f.compose === false ? null : false">
          Pas de prénoms composés
        </label>
      </template>
    </div>

    <template #pied>
      <p class="compte">
        <strong>{{ nb.toLocaleString('fr-FR') }}</strong> prénoms — {{ selection }}
      </p>
      <p v-if="nb < 40 && catalogue.length" class="mini" style="color:var(--non);margin:0">
        C’est très peu. Vous aurez fait le tour en une séance.
      </p>
      <button v-if="etape === ETAPES.length - 1" class="btn btn-1" :disabled="envoi || !nb"
              @click="valider">
        {{ envoi ? 'Création…' : 'Créer la liste' }}
      </button>
      <button v-else class="btn btn-0 mini doux" @click="sansFiltre">
        Passer, je filtrerai après
      </button>
    </template>
  </Feuille>
</template>

<style scoped>
.points { display: flex; gap: 5px; flex: none; }
.points i { width: 20px; height: 3px; border-radius: 999px; background: var(--trait); }
.points i.on { background: var(--encre); }

/* le defilement et le rembourrage viennent de la feuille */
.corps { display: flex; flex-direction: column; gap: 10px; }
.corps h1 { font-size: 1.55rem; }
.corps > p { margin: 0 0 6px; font-size: .92rem; }
.choix { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.opt { display: flex; flex-direction: column; gap: 3px; text-align: left; cursor: pointer;
  padding: 16px 18px; }
.opt:active { transform: scale(.985); }
.opt strong { font-size: 1.05rem; font-weight: 620; }

.nuage { display: flex; flex-wrap: wrap; gap: 7px; }
.jeton { border: 1px solid var(--trait); background: var(--carte); color: var(--doux);
  border-radius: 999px; padding: 8px 14px; font: inherit; font-size: .84rem; cursor: pointer; }
.jeton.in { background: var(--encre); border-color: var(--encre); color: var(--fond); }

.compte { margin: 0; text-align: center; font-size: .92rem; color: var(--doux);
  font-variant-numeric: tabular-nums; }
.compte strong { color: var(--texte); font-size: 1.15rem; }
</style>
