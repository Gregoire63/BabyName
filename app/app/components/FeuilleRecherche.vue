<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
import { sansAccent, type Prenom } from '~/composables/useCatalogue'
import { useVerdicts, MOT } from '~/composables/useVerdicts'
import { jumeauDe, type Jumeau } from '~/composables/useAjouts'

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
 *
 * LE PRÉNOM QUI N'Y EST PAS. Le catalogue, c'est ce que l'INSEE publie pour
 * les trois dernières années : ni Jeannine, ni une graphie à soi, ni un
 * prénom inventé. Tapé en entier et absent, il s'AJOUTE à la liste (sous les
 * résultats) : une carte en tête de pile pour chacun de ses membres
 * (useAjouts, ajouts.post.ts). Deux gestes, pas un : le second laisse écrire
 * un mot pour les autres (« le prénom de mon arrière-grand-mère »), et une
 * faute de frappe ne part pas d'un seul toucher. S'il se dit comme un prénom
 * connu, on le propose d'abord : Jeaninne est peut-être Jeannine.
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

/** Les prénoms qui s'écrivent avec ces lettres-là exactement, catalogue et
 *  prénoms ajoutés : de quoi savoir si le prénom tapé existe déjà. */
const exactsTous = computed<Prenom[]>(() => {
  const r = cle.value
  if (r.length < 2) return []
  return [...g.catalogue.value.filter(p => p.slug === r), ...g.ajouts.value.filter(p => p.slug === r)]
})

const trouves = computed<Prenom[]>(() => {
  const r = cle.value
  if (r.length < 2) return []
  const exacts: Prenom[] = [...exactsTous.value]
  const debut: Prenom[] = []
  const dedans: Prenom[] = []
  for (const liste of [g.catalogue.value, g.ajouts.value]) {
    for (const p of liste) {
      if (p.slug === r) continue
      if (p.slug.startsWith(r)) debut.push(p)
      else if (p.slug.includes(r)) dedans.push(p)
    }
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
  // Un prénom ajouté par la liste, tapé tel quel : c'est lui qu'on cherche
  // (il n'a pas de naissances pour remonter tout seul).
  const tete = exacts.find(p => p.ajout && p.l.toLowerCase() === tape)
    ?? (tape !== sansAccent(tape) ? exacts.find(p => p.l.toLowerCase() === tape) : undefined)
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

// --- ajouter un prénom absent ------------------------------------------------
/** Ce qu'un observateur ne peut pas : il ne met rien dans la pile des autres. */
const decide = computed(() => g.etat.value?.moi?.role !== 'observateur')
/** Le prénom tapé, écrit comme il serait ajouté (ecrireAjout) ; '' si ce
 *  n'en est pas un, ou s'il existe déjà sous cette écriture. */
const propose = computed(() => {
  if (!decide.value) return ''
  const nom = ecrireAjout(recherche.value)
  if (!nom || exactsTous.value.some(p => memeAjout(p.l, nom))) return ''
  return nom
})

/** Le prénom connu qui se dit pareil, s'il n'est pas déjà dans les résultats. */
const jumeau = ref<Jumeau | null>(null)
let minuteurJumeau: any = null
watch(propose, (nom) => {
  jumeau.value = null
  composer.value = false
  erreurAjout.value = ''
  clearTimeout(minuteurJumeau)
  if (!nom) return
  // Après la frappe, pas à chaque lettre : la première fois, il y a des
  // clés à calculer (useAjouts).
  minuteurJumeau = setTimeout(async () => {
    const j = await jumeauDe(nom, g.catalogue.value).catch(() => null)
    if (propose.value === nom) jumeau.value = j
  }, 350)
})
onUnmounted(() => clearTimeout(minuteurJumeau))
const jumeauVisible = computed(() => {
  const j = jumeau.value
  return j && !trouves.value.some(p => p.l === j.l) && !g.vetos.value.has(j.l) ? j : null
})

/** Le jumeau de l'historique n'a pas de carte : le toucher l'écrit à la place. */
function prendreJumeau(j: Jumeau, fermer: () => void) {
  if (j.p) { choisir(j.p, fermer); return }
  recherche.value = j.l
  champ.value?.focus({ preventScroll: true })
}

const composer = ref(false)
const mot = ref('')
const ajoutEnCours = ref(false)
const erreurAjout = ref('')
const champMot = ref<HTMLTextAreaElement>()

function commencerAjout() {
  composer.value = true
  nextTick(() => champMot.value?.focus({ preventScroll: true }))
}

async function ajouter(fermer: () => void) {
  const nom = propose.value
  if (!nom || ajoutEnCours.value) return
  ajoutEnCours.value = true
  erreurAjout.value = ''
  try {
    const garde = await g.ajouterPrenom(nom, mot.value.trim() || undefined)
    emit('choisir', garde)
    fermer()
  } catch (err: any) {
    const code = err?.data?.statusMessage ?? err?.statusMessage
    erreurAjout.value = code === 'ajouts_plein' ? 'Cette liste a déjà deux cents prénoms ajoutés.'
      : code === 'trop_d_essais' ? 'Beaucoup d’ajouts d’affilée : réessayez dans un moment.'
      : 'L’ajout n’a pas abouti. Réessayez dans un instant.'
  } finally {
    ajoutEnCours.value = false
  }
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
                  :aria-label="`${p.l}${p.ajout ? ', ajouté à la liste' : p.q ? ', rare' : ''} : mettre en première carte${etat(p.l) ? ` (déjà jugé : ${etat(p.l)!.t.toLowerCase()})` : ''}`"
                  @click="choisir(p, fermer)">
            <span class="nom">
              {{ p.l }}
              <Etincelles v-if="g.favoris.value.has(p.l)" :taille="12" couleur="var(--peche)" une />
            </span>
            <span v-if="p.ajout" class="puce ajoute">ajouté</span>
            <span v-else-if="p.q" class="puce rare" :title="`${p.n} naissances en trois ans`">rare</span>
            <span v-if="etat(p.l)" class="puce" :class="etat(p.l)!.c">{{ etat(p.l)!.t }}</span>
            <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>
          <div v-else class="trouve bloque">
            <span class="nom">{{ p.l }}</span>
            <span class="puce veto">{{ retire(p.l) }}</span>
          </div>
        </li>
      </ul>

      <!-- Absent du catalogue comme de la liste : il s'ajoute, pour tous. -->
      <section v-if="propose" class="ajout" aria-label="Prénom absent du catalogue">
        <button v-if="jumeauVisible" type="button" class="trouve"
                :aria-label="`${jumeauVisible.l} se dit pareil : ${jumeauVisible.p ? 'mettre en première carte' : 'l’écrire ainsi'}`"
                @click="prendreJumeau(jumeauVisible, fermer)">
          <span class="nom">{{ jumeauVisible.l }}</span>
          <span class="puce">se dit pareil</span>
          <svg class="fleche" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>
        <button v-if="!composer" type="button" class="trouve ajouter"
                :aria-label="`Ajouter « ${propose} » à la liste`" @click="commencerAjout">
          <svg class="plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span class="nom">Ajouter « {{ propose }} »</span>
        </button>
        <form v-else class="pile compose" @submit.prevent="ajouter(fermer)">
          <label for="mot-ajout" class="mini">
            Un mot pour la liste <span class="doux">(facultatif)</span>
          </label>
          <textarea id="mot-ajout" ref="champMot" v-model="mot" class="champ" rows="2"
                    :maxlength="MOT_AJOUT_MAX" placeholder="Le prénom de mon arrière-grand-mère" />
          <p v-if="erreurAjout" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreurAjout }}</p>
          <button type="submit" class="btn btn-1" :disabled="ajoutEnCours">
            {{ ajoutEnCours ? 'Ajout…' : `Ajouter « ${propose} » à la liste` }}
          </button>
        </form>
      </section>
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
/* Un prénom que la liste a ajouté : ni rare ni courant, il est à elle. */
.trouve .ajoute { background: color-mix(in srgb, var(--menthe) 55%, transparent); }
.ajout { display: flex; flex-direction: column; border-top: 1px solid var(--trait); }
.ajout > .trouve + .trouve, .ajout > .trouve + .compose { border-top: 1px solid var(--trait); }
.ajouter .nom { font-weight: 750; }
.plus { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--encre);
  stroke-width: 2.4; stroke-linecap: round; }
.compose { gap: 8px; padding: 12px 2px 4px; }
.compose textarea { resize: none; }
</style>
