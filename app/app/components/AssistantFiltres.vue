<script setup lang="ts">
import { chargerCatalogue, filtrer, filtresParDefaut, type Prenom, type Filtres }
  from '~/composables/useCatalogue'
import { appliquerPays, chargerIndexPays, chargerPays, indexPays, type Pays } from '~/composables/usePays'
import { t, nombre } from '~/composables/useLangue'
import { groupePays, nomPays } from '~/utils/nomPays'

const emit = defineEmits<{ fermer: []; valider: [f: Filtres] }>()
/** Le prénom demandé depuis une fiche (`?prenom=`) : il ouvrira la liste,
 *  et les choix qui suivent ne l'écartent pas — on le dit avant qu'ils le
 *  fassent craindre. */
defineProps<{ premier?: string }>()

const f = ref<Filtres>(filtresParDefaut())
const catalogue = shallowRef<Prenom[]>([])
const base = shallowRef<Prenom[]>([])
const pays = shallowRef<Pays[]>([])
const origines = ref<string[]>([])
const etape = ref(0)
const envoi = ref(false)

onMounted(async () => {
  const c = await chargerCatalogue()
  base.value = c!.liste
  catalogue.value = c!.liste
  pays.value = await chargerIndexPays().catch(() => [])
  await appliquerSelection()
  // On ne propose que les origines qui pesent vraiment, sinon le choix est du bruit.
  const compte = new Map<string, number>()
  for (const p of c!.liste) for (const o of p.g) compte.set(o, (compte.get(o) ?? 0) + 1)
  origines.value = [...compte.entries()].filter(([, n]) => n >= 60)
    .sort((a, b) => b[1] - a[1]).map(([o]) => o)
})

const nb = computed(() => catalogue.value.length ? filtrer(catalogue.value, f.value).length : 0)

const ETAPES = ['Pour qui', 'Où', 'Le style', 'La forme', 'Les origines']

/**
 * Où grandira l'enfant : la pile, ce sont les prénoms donnés dans ces pays,
 * et la carte montre leur fréquence commune. Tous les pays dont les chiffres
 * sont publics et complets ; la francophonie est cochée d'office.
 */
const groupes = computed(() => {
  const m = new Map<string, Pays[]>()
  for (const x of pays.value) { const a = m.get(x.groupe); a ? a.push(x) : m.set(x.groupe, [x]) }
  return [...m.entries()]
})
let selectionEnCours = 0
async function appliquerSelection() {
  const codes = f.value.pays.length ? [...f.value.pays] : ['fr']
  const n = ++selectionEnCours
  const liste = await chargerPays(base.value, codes).catch(() => base.value)
  if (n !== selectionEnCours) return
  appliquerPays(liste, codes)
  catalogue.value = [...liste]
}
function basculerPays(code: string) {
  const i = f.value.pays.indexOf(code)
  if (i === -1) f.value.pays.push(code)
  else if (f.value.pays.length > 1) f.value.pays.splice(i, 1)
  appliquerSelection()
}
const nomsPays = computed(() => indexPays().filter(x => f.value.pays.includes(x.code)).map(x => nomPays(x.code, x.nom)))

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
  const q = s.length === 3 ? t('AssistantFiltres.filleOuGarcon') : s.includes('f') ? t('Sexe.f') : t('Sexe.m')
  return q
})
</script>

<template>
  <Feuille plein :titre="$t('AssistantFiltres.titre')" @fermer="emit('fermer')">
    <template #action>
      <div class="points">
        <i v-for="(e, i) in ETAPES" :key="e" :class="{ on: i <= etape }" />
      </div>
      <button class="btn btn-0 mini doux" :disabled="etape === 0" @click="retour">{{ $t('AssistantFiltres.retour') }}</button>
    </template>

    <div class="corps">
      <template v-if="etape === 0">
        <h1>{{ $t('AssistantFiltres.pourQui') }}</h1>
        <p class="doux">{{ $t('AssistantFiltres.rienNestFige') }}</p>
        <p v-if="premier" class="premier">
          <strong>{{ premier }}</strong>{{ $t('AssistantFiltres.premier') }}
        </p>
        <div class="choix">
          <button class="carte opt" @click="sexe('f')"><strong>{{ $t('AssistantFiltres.uneFille') }}</strong></button>
          <button class="carte opt" @click="sexe('m')"><strong>{{ $t('AssistantFiltres.unGarcon') }}</strong></button>
          <button class="carte opt" @click="sexe('tous')">
            <strong>{{ $t('AssistantFiltres.onNeSaitPas') }}</strong>
            <span class="mini doux">{{ $t('AssistantFiltres.lesDeux') }}</span>
          </button>
        </div>
      </template>

      <template v-else-if="etape === 1">
        <h1>{{ $t('AssistantFiltres.ou') }}</h1>
        <p class="doux">
          {{ $t('AssistantFiltres.ouAide') }}
        </p>
        <div v-for="[nom, liste] in groupes" :key="nom" class="groupe-pays">
          <p class="mini doux">{{ groupePays(nom) }}</p>
          <div class="nuage">
            <button v-for="x in liste" :key="x.code" class="jeton"
                    :class="{ in: f.pays.includes(x.code) }" :aria-pressed="f.pays.includes(x.code)"
                    @click="basculerPays(x.code)">
              {{ nomPays(x.code, x.nom) }}
            </button>
          </div>
        </div>
        <button class="btn btn-1" @click="suite">{{ $t('AssistantFiltres.continuer') }}</button>
      </template>

      <template v-else-if="etape === 2">
        <h1>{{ $t('AssistantFiltres.style') }}</h1>
        <p class="doux">
          {{ $t('AssistantFiltres.styleAide') }}
        </p>
        <div class="choix">
          <button class="carte opt" @click="style('repandu')">
            <strong>{{ $t('AssistantFiltres.repandu') }}</strong>
            <span class="mini doux">{{ $t('AssistantFiltres.repanduAide') }}</span>
          </button>
          <button class="carte opt" @click="style('milieu')">
            <strong>{{ $t('AssistantFiltres.milieu') }}</strong>
            <span class="mini doux">{{ $t('AssistantFiltres.milieuAide') }}</span>
          </button>
          <button class="carte opt" @click="style('rare')">
            <strong>{{ $t('AssistantFiltres.rare') }}</strong>
            <span class="mini doux">{{ $t('AssistantFiltres.rareAide') }}</span>
          </button>
        </div>
      </template>

      <template v-else-if="etape === 3">
        <h1>{{ $t('AssistantFiltres.forme') }}</h1>
        <p class="doux">{{ $t('AssistantFiltres.formeAide') }}</p>
        <div class="choix">
          <button class="carte opt" @click="forme('court')">
            <strong>{{ $t('AssistantFiltres.court') }}</strong><span class="mini doux">{{ $t('AssistantFiltres.courtAide') }}</span>
          </button>
          <button class="carte opt" @click="forme('moyen')">
            <strong>{{ $t('AssistantFiltres.moyen') }}</strong><span class="mini doux">{{ $t('AssistantFiltres.moyenAide') }}</span>
          </button>
          <button class="carte opt" @click="forme('libre')">
            <strong>{{ $t('AssistantFiltres.libre') }}</strong>
          </button>
        </div>
      </template>

      <template v-else>
        <h1>{{ $t('AssistantFiltres.origine') }}</h1>
        <p class="doux">
          {{ $t('AssistantFiltres.origineAide') }}
        </p>
        <div class="nuage">
          <button v-for="o in origines" :key="o" class="jeton"
                  :class="{ in: f.origines_in.includes(o) }" @click="basculerOrigine(o)">
            {{ $t(`Origines.${o}`) }}
          </button>
        </div>
        <label class="ligne mini" style="margin-top:6px">
          <input type="checkbox" :checked="f.compose === false"
                 @change="f.compose = f.compose === false ? null : false">
          {{ $t('AssistantFiltres.composes') }}
        </label>
      </template>
    </div>

    <template #pied>
      <p class="compte">
        <strong>{{ nombre(nb) }}</strong> {{ $t('AssistantFiltres.prenoms', { sel: selection, c: nb }) }}<template v-if="etape >= 1 && nomsPays.length">,
        {{ nomsPays.length <= 3 ? nomsPays.join(', ') : $t('AssistantFiltres.nbPays', { n: nomsPays.length }) }}</template>
      </p>
      <p v-if="nb < 40 && catalogue.length" class="mini" style="color:var(--non);margin:0">
        {{ $t('AssistantFiltres.tresPeu') }}
      </p>
      <button v-if="etape === ETAPES.length - 1" class="btn btn-1" :disabled="envoi || !nb"
              @click="valider">
        {{ envoi ? $t('AssistantFiltres.creation') : $t('AssistantFiltres.creer') }}
      </button>
      <button v-else class="btn btn-0 mini doux" @click="sansFiltre">
        {{ $t('AssistantFiltres.passer') }}
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
.corps > .premier { margin: 0 0 4px; padding: 10px 14px; border-radius: var(--r-s);
  background: color-mix(in srgb, var(--menthe) 45%, var(--carte)); color: var(--texte); }
.opt { display: flex; flex-direction: column; gap: 3px; text-align: left; cursor: pointer;
  padding: 16px 18px; }
.opt:active { transform: scale(.985); }
.opt strong { font-size: 1.05rem; font-weight: 620; }

.nuage { display: flex; flex-wrap: wrap; gap: 7px; }
.jeton { border: 1px solid var(--trait); background: var(--carte); color: var(--doux);
  border-radius: 999px; padding: 8px 14px; font: inherit; font-size: .84rem; cursor: pointer; }
.jeton.in { background: var(--encre); border-color: var(--encre); color: var(--fond); }

.groupe-pays { display: flex; flex-direction: column; gap: 4px; }
.groupe-pays > p { margin: 4px 0 0; text-transform: uppercase; letter-spacing: .05em; font-size: .68rem; }
.compte { margin: 0; text-align: center; font-size: .92rem; color: var(--doux);
  font-variant-numeric: tabular-nums; }
.compte strong { color: var(--texte); font-size: 1.15rem; }
</style>
