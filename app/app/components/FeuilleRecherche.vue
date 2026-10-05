<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { sansAccent, type Prenom } from '~/composables/useCatalogue'
import { useVerdicts, MOT } from '~/composables/useVerdicts'

/**
 * Chercher un prénom précis, depuis le tri — et l'amener en haut de la pile.
 *
 * Un résultat n'a qu'une action : le toucher le met en PREMIÈRE CARTE, et la
 * feuille se ferme. On le juge alors comme les autres, d'un geste, avec toute
 * sa carte sous les yeux. Les votes et le blocage en petit, ligne par ligne,
 * faisaient doublon avec la carte et se lisaient mal.
 *
 * Dans TOUT le catalogue, filtres de la liste ignorés, et c'est voulu : on
 * cherche le prénom d'une cousine pour savoir ce qu'on en a déjà dit, pas pour
 * s'entendre répondre qu'il ne passe pas le filtre « 2 à 3 syllabes ». Déjà
 * jugé, il revient quand même : le rejuger remplace l'ancien vote.
 *
 * Trois réglages venus d'un retour d'usage sur téléphone :
 *  - le champ ne passe PAS par `v-model`, qui attend que le clavier Android
 *    ait fini de « composer » le mot en cours : on tapait « mar », le champ
 *    l'affichait, la liste restait vide jusqu'à ce qu'on range le clavier.
 *    On lit chaque frappe (utils/frappe.ts) ;
 *  - Entrée ne choisit rien. Elle prenait le premier résultat — celui que,
 *    justement, on n'avait pas encore vu. Elle valide la recherche, comme
 *    partout : le clavier se range, la liste reste, le premier résultat
 *    prend le focus (au clavier, une seconde Entrée le choisit) ;
 *  - le champ est épinglé en haut d'une feuille haute (`haute`, `#fixe`) :
 *    il ne bouge plus quand la liste s'allonge, et les résultats arrivent
 *    juste dessous, au-dessus du clavier.
 */
const emit = defineEmits<{ fermer: []; choisir: [nom: string] }>()
const g = useGroupeCourant()
const { parPrenom } = useVerdicts()

const recherche = ref('')
const champ = ref<HTMLInputElement>()
const liste = ref<HTMLElement>()
const feuille = ref<{ remonter: () => void }>()

// Le clavier sort tout de suite : toucher la loupe, c'est vouloir écrire. On
// attend la fin de la montée, sinon le focus fait sauter la feuille.
onMounted(() => setTimeout(() => champ.value?.focus({ preventScroll: true }), 320))

/** Ce qu'on compare : les lettres seules, comme les `slug` du catalogue.
 *  « jean-b », « marie lou » et « M'Mah » se tapent comme ils s'écrivent. */
const cle = computed(() => sansAccent(recherche.value).replace(/[^a-z]/g, ''))

const trouves = computed<Prenom[]>(() => {
  const r = cle.value
  if (r.length < 2) return []
  const exacts: Prenom[] = []
  const debut: Prenom[] = []
  const dedans: Prenom[] = []
  for (const p of g.catalogue.value) {
    if (p.slug === r) exacts.push(p)
    else if (p.slug.startsWith(r)) debut.push(p)
    else if (p.slug.includes(r)) dedans.push(p)
  }
  // Les plus donnés d'abord : c'est presque toujours celui qu'on cherche.
  const parFrequence = (a: Prenom, b: Prenom) => b.n - a.n
  exacts.sort(parFrequence)
  // Sauf le prénom tapé EN ENTIER, qui passe en tête si rare soit-il :
  // « Lou » avant Louis, et « Mari », qui restait introuvable derrière
  // vingt-cinq « Mari… » plus donnés. Une ligne, pas toutes ses graphies :
  // la plus donnée (on tape « leo », on veut Léo), ou celle qu'on a pris la
  // peine d'accentuer (« lëo »).
  const tape = recherche.value.trim().toLowerCase()
  const tete = (tape !== sansAccent(tape) ? exacts.find(p => p.l.toLowerCase() === tape) : undefined)
    ?? exacts[0]
  const suite = [...exacts.filter(p => p !== tete), ...debut].sort(parFrequence)
  return [...(tete ? [tete] : []), ...suite, ...dedans.sort(parFrequence)].slice(0, 25)
})

// D'autres lettres, d'autres résultats : on les relit depuis le premier,
// pas depuis l'endroit où l'on avait fait défiler les précédents.
watch(cle, () => feuille.value?.remonter(), { flush: 'post' })

/** Retiré du jeu : « Déjà pris » se dit (c'est tout son principe), un
 *  veto ne dit que « Veto », jamais de qui. */
const retire = (nom: string) => g.parDejaPris.value.has(nom) ? 'Déjà pris'
  : g.vetos.value.has(nom) ? 'Veto' : null

const etat = (nom: string) => {
  const r = retire(nom)
  if (r) return { t: r, c: 'veto' }
  const v = parPrenom.value.get(nom)?.mien
  if (v === undefined || v === null) return null
  return { t: MOT[v], c: `v${v}` }
}

/** Un prénom retiré du jeu n'y revient pas : la ligne le dit, sans bouton. */
function choisir(p: Prenom, fermer: () => void) {
  if (g.vetos.value.has(p.l)) return
  emit('choisir', p.l)
  fermer()
}

/** Entrée : on range le clavier et on passe aux résultats, sans en choisir. */
function valider(e: KeyboardEvent) {
  if (e.isComposing) return
  const premier = liste.value?.querySelector<HTMLElement>('button.trouve')
  if (!premier) return
  champ.value?.blur()
  premier.focus()
}

// Faire défiler les résultats range le clavier : on a fini d'écrire, on lit.
// (Au doigt seulement, et pas sur `scroll` : la liste se replace toute seule
// à chaque lettre.)
let y0 = 0
function doigtPose(e: TouchEvent) { y0 = e.touches[0]?.clientY ?? 0 }
function doigtGlisse(e: TouchEvent) {
  if (document.activeElement !== champ.value) return
  if (Math.abs((e.touches[0]?.clientY ?? y0) - y0) > 12) champ.value?.blur()
}
</script>

<template>
  <Feuille ref="feuille" haute titre="Chercher un prénom" @fermer="emit('fermer')">
    <template #fixe>
      <input ref="champ" :value="recherche" class="champ chercher" type="search"
             placeholder="Louise, Gabriel…" aria-label="Chercher un prénom dans le catalogue"
             aria-describedby="recherche-aide" enterkeyhint="search"
             autocapitalize="off" autocorrect="off" spellcheck="false"
             @input="recherche = frappe($event)"
             @keyup.enter="valider">
    </template>
    <template #default="{ fermer }">
      <!-- v-show : le champ s'y réfère (aria-describedby), elle reste dans la page -->
      <p v-show="!trouves.length" id="recherche-aide" class="mini doux" style="margin:0">
        Tout le catalogue, sans vos filtres.
      </p>

      <p v-if="cle.length >= 2 && !trouves.length" class="mini doux" role="status"
         style="margin:0">
        Aucun prénom ne correspond.
      </p>

      <ul v-if="trouves.length" ref="liste" class="resultats" aria-label="Résultats"
          @touchstart.passive="doigtPose" @touchmove.passive="doigtGlisse">
        <li v-for="p in trouves" :key="p.l">
          <button v-if="!g.vetos.value.has(p.l)" type="button" class="trouve"
                  :aria-label="`${p.l}${p.q ? ', rare' : ''} : mettre en première carte${etat(p.l) ? ` (déjà jugé : ${etat(p.l)!.t.toLowerCase()})` : ''}`"
                  @click="choisir(p, fermer)">
            <span class="nom">
              {{ p.l }}
              <Etincelles v-if="g.favoris.value.has(p.l)" :taille="12" couleur="var(--peche)" une />
            </span>
            <span v-if="p.q" class="puce rare" :title="`${p.n} naissances en trois ans`">rare</span>
            <span v-if="etat(p.l)" class="puce" :class="etat(p.l)!.c">{{ etat(p.l)!.t }}</span>
            <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
          <div v-else class="trouve bloque">
            <span class="nom">{{ p.l }}</span>
            <span class="puce veto">{{ retire(p.l) }}</span>
          </div>
        </li>
      </ul>
    </template>
  </Feuille>
</template>

<style scoped>
.chercher { -webkit-appearance: none; appearance: none; }
.resultats { list-style: none; margin: 0; padding: 0; }
.resultats li { border-top: 1px solid var(--trait); }
.trouve { width: 100%; display: flex; align-items: center; gap: 8px; padding: 12px 2px;
  border: 0; background: none; font: inherit; color: var(--texte); text-align: left;
  cursor: pointer; border-radius: 10px; }
.trouve:active { background: var(--fond); }
.trouve .nom { flex: 1; min-width: 0; font-weight: 650; font-size: 1.02rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 5px; }
.trouve .puce { font-size: .66rem; flex: none; }
.trouve .v0, .trouve .veto { background: color-mix(in srgb, var(--non) 22%, transparent); }
.trouve .v2 { background: color-mix(in srgb, var(--oui) 22%, transparent); }
/* Un prénom trouvé par la recherche mais absent du tri : sans ce marqueur on
   croit à un bug de la pile. */
.trouve .rare { background: none; border: 1px dashed var(--trait); color: var(--doux); }
.fleche { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--doux);
  stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.bloque { cursor: default; opacity: .7; }
</style>
