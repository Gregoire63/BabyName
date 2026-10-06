<script setup lang="ts">
import { useGroupeCourant } from '~/composables/etatGroupe'
const g = useGroupeCourant()

// La liste des communs est chargee avec le reste de la liste : l'onglet en a
// besoin pour sa pastille avant meme d'etre ouvert. On la lit, on ne la refait pas.
const communs = computed(() => g.communs.value)

const ouvert = ref<string | null>(null)
const commentaires = ref<any[]>([])
const brouillon = ref('')

async function ouvrir(prenom: string) {
  if (ouvert.value === prenom) { ouvert.value = null; return }
  ouvert.value = prenom
  commentaires.value = await $fetch(
    `/api/groupes/${g.gid}/commentaires?prenom=${encodeURIComponent(prenom)}`)
}

async function commenter() {
  if (!brouillon.value.trim() || !ouvert.value) return
  const p = ouvert.value
  await $fetch(`/api/groupes/${g.gid}/commentaires`,
    { method: 'POST', body: { prenom: p, texte: brouillon.value } })
  brouillon.value = ''
  commentaires.value = await $fetch(
    `/api/groupes/${g.gid}/commentaires?prenom=${encodeURIComponent(p)}`)
  // Le compte de la carte repliée suit, sans recharger toute la liste.
  const c = communs.value.find((x: any) => x.prenom === p)
  if (c) c.nb_commentaires = commentaires.value.length
}

/** « 1 commentaire », « 3 commentaires » : de quoi savoir qu'il faut déplier. */
const motsLisibles = (n: number) => `${n} commentaire${n > 1 ? 's' : ''}`

/** Un accord qu'on retire après coup — le bébé de la cousine est né entre-
 *  temps. La même feuille que sur la carte : déjà pris, ou autre raison. */
const ecarterPour = ref<string | null>(null)
/** Un observateur n'a pas de veto : il n'a pas le bouton. */
const jObserve = computed(() => g.etat.value?.moi?.role === 'observateur')

/**
 * Le cœur des grands-parents.
 *
 * Un observateur ne décide pas, mais la courte liste du couple est le moment
 * où il a envie de dire « celui-là ». Son cœur, c'est son « oui » sur le
 * prénom (le même vote qu'au tri, qui ne compte toujours pas dans les
 * accords) ; le retirer le repasse en « neutre » plutôt que de l'effacer —
 * sinon le prénom reviendrait dans sa pile de tri.
 */
const coeurEnCours = ref('')
async function basculerCoeur(c: any) {
  if (coeurEnCours.value) return
  coeurEnCours.value = c.prenom
  try { await g.voter(c.prenom, c.j_aime ? 1 : 2) }
  catch { /* rien de changé : le cœur reste tel qu'il était */ }
  finally { coeurEnCours.value = '' }
}

/** « Mamie », « vous et Papi », « Mamie, Papi et Tata Rose ». */
function coeursLisibles(c: any): string {
  const noms = [...(c.coeurs ?? [])].sort((a: any, b: any) => Number(b.moi) - Number(a.moi))
    .map((x: any) => x.moi ? 'vous' : x.pseudo)
  if (noms.length <= 1) return noms.join('')
  return `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`
}

// « Qui traîne » vit dans RappelRetard : il suit le compte de votes de
// chacun, qui change à chaque geste du tri, et n'a pas à entraîner la liste.

/**
 * QUI A DIT QUOI.
 *
 * « 2 oui · 1 neutre » ne disait pas qui. Le serveur donne désormais les voix
 * des décideurs (aux décideurs seulement, voir communsVisibles) : un oui de
 * tout le monde se dit en une pastille mise en avant, sinon chaque voix a la
 * sienne — ♥ pour un oui, ~ pour un neutre, les signes des boutons du tri.
 */
const nbDecideurs = computed(() =>
  (g.etat.value?.avancement ?? []).filter((x: any) => x.role !== 'observateur').length)
const ouiDeTous = computed(() =>
  nbDecideurs.value >= 3 ? 'Oui de tous' : nbDecideurs.value === 2 ? 'Oui à deux' : '')
const toutOui = (c: any) => !!ouiDeTous.value && c.nb_neutres === 0
const qui = (v: any) => v.moi ? 'vous' : v.pseudo

// ---------------------------------------------------------------------------
/**
 * L'ORDRE, AU DOIGT.
 *
 * On range les accords en tirant la poignée ⠿ : un seul ordre pour la liste,
 * le même pour les deux parents (ordre-communs.put.ts). La carte suit le
 * doigt, les autres s'écartent ; lâchée, elle prend sa place et l'ordre part
 * au serveur. Au clavier : la poignée, puis haut et bas.
 *
 * La poignée seule saisit (touch-action: none) : le reste de la carte fait
 * défiler la page et s'ouvre comme avant. Près du haut ou du bas de l'écran,
 * la liste défile toute seule sous la carte.
 */
const peutRanger = computed(() => !jObserve.value && communs.value.length > 1)
const liste = ref<HTMLElement>()
const annonceOrdre = ref('')
const erreurOrdre = ref('')

interface Saisie { i: number; cible: number; dy: number; pas: number }
const saisie = ref<Saisie | null>(null)
let centres: number[] = []
let hauteurs: number[] = []
let ecart = 0
let y0 = 0
let yDoigt = 0
let defileur: HTMLElement | null = null
let defile0 = 0
let auto = 0

function defileurDe(el: HTMLElement | null | undefined): HTMLElement | null {
  for (let x = el?.parentElement; x; x = x.parentElement) {
    const o = getComputedStyle(x).overflowY
    if ((o === 'auto' || o === 'scroll') && x.scrollHeight > x.clientHeight) return x
  }
  return null
}
const defilement = () => defileur ? defileur.scrollTop : window.scrollY
const cartes = () => [...(liste.value?.querySelectorAll<HTMLElement>(':scope > article.commun') ?? [])]

function saisir(e: PointerEvent, i: number) {
  if (!peutRanger.value || saisie.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  // Hors de l'écran, une carte n'est pas mise en page (content-visibility,
  // voir le style) : elle n'a qu'une hauteur estimée. Pour ranger il faut les
  // vraies — `tient` les rend toutes, tout de suite, avant de mesurer.
  liste.value?.classList.add('tient')
  const r = cartes().map(c => c.getBoundingClientRect())
  hauteurs = r.map(x => x.height)
  centres = r.map(x => x.top + x.height / 2)
  ecart = r.length > 1 ? Math.max(0, r[1]!.top - r[0]!.bottom) : 0
  y0 = yDoigt = e.clientY
  defileur = defileurDe(liste.value)
  defile0 = defilement()
  erreurOrdre.value = ''
  saisie.value = { i, cible: i, dy: 0, pas: hauteurs[i]! + ecart }
  auto = requestAnimationFrame(defilerSiBord)
}

function suivre() {
  const s = saisie.value
  if (!s) return
  s.dy = yDoigt - y0 + (defilement() - defile0)
  // La place change quand le milieu de la carte tenue passe le milieu d'une
  // autre (positions de départ : celles-ci ne bougent pas pendant la saisie).
  const centre = centres[s.i]! + s.dy
  let c = s.i
  while (c + 1 < centres.length && centre > centres[c + 1]!) c++
  while (c - 1 >= 0 && centre < centres[c - 1]!) c--
  s.cible = c
}
function bouger(e: PointerEvent) {
  if (!saisie.value) return
  yDoigt = e.clientY
  suivre()
}
/** Près d'un bord, la liste défile sous la carte tenue. */
function defilerSiBord() {
  if (!saisie.value) return
  const haut = defileur ? defileur.getBoundingClientRect().top : 0
  const bas = defileur ? defileur.getBoundingClientRect().bottom : window.innerHeight
  const ZONE = 70
  const v = yDoigt < haut + ZONE ? -Math.ceil((haut + ZONE - yDoigt) / 6)
    : yDoigt > bas - ZONE ? Math.ceil((yDoigt - (bas - ZONE)) / 6) : 0
  if (v) {
    if (defileur) defileur.scrollTop += v
    else window.scrollBy(0, v)
    suivre()
  }
  auto = requestAnimationFrame(defilerSiBord)
}

async function lacher() {
  const s = saisie.value
  if (!s) return
  cancelAnimationFrame(auto)
  const el = cartes()[s.i]
  const avant = el?.getBoundingClientRect().top ?? 0
  if (s.cible === s.i) { saisie.value = null; return }
  // Les cartes qui s'étaient écartées sont déjà à leur nouvelle place : sans
  // transition le temps de l'échange, sinon elles repartiraient d'un cran.
  pose.value = true
  saisie.value = null
  const l = [...communs.value]
  const [x] = l.splice(s.i, 1)
  l.splice(s.cible, 0, x)
  g.communs.value = l
  await nextTick()
  // La carte lâchée glisse du doigt à sa place.
  if (el) {
    const apres = el.getBoundingClientRect().top
    el.animate([{ transform: `translateY(${avant - apres}px)` }, { transform: 'none' }],
      { duration: 160, easing: 'ease-out' })
  }
  requestAnimationFrame(() => { pose.value = false })
  dire(x.prenom, s.cible)
  enregistrer(l)
}
const pose = ref(false)

/** Haut et bas sur la poignée : une place à la fois. Début et Fin : aux bouts. */
function auClavier(e: KeyboardEvent, i: number) {
  const n = communs.value.length
  const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1
    : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null
  if (j === null) return
  e.preventDefault()
  e.stopPropagation()
  if (j < 0 || j >= n || j === i) return
  const l = [...communs.value]
  const [x] = l.splice(i, 1)
  l.splice(j, 0, x)
  g.communs.value = l
  dire(x.prenom, j)
  // Le nœud déplacé perd le focus en changeant de place : on le lui rend.
  nextTick(() => cartes()[j]?.querySelector<HTMLElement>('.poignee')?.focus())
  clearTimeout(minuteurClavier)
  minuteurClavier = setTimeout(() => enregistrer(g.communs.value), 600)
}
let minuteurClavier: any = null

function dire(prenom: string, place: number) {
  annonceOrdre.value = `${prenom} : ${place + 1} sur ${communs.value.length}`
}

/** L'ordre entier part au serveur ; s'il n'y arrive pas, on revient à celui
 *  du serveur plutôt que de laisser croire qu'il est rangé. */
async function enregistrer(l: any[]) {
  for (const c of l) c.nouveau = false
  try {
    await $fetch(`/api/groupes/${g.gid}/ordre-communs`,
      { method: 'PUT', body: { prenoms: l.map((c: any) => c.prenom) } })
  } catch {
    erreurOrdre.value = 'L’ordre n’a pas pu être enregistré. Réessayez dans un instant.'
    await g.rechargerCommuns()
  }
}

/** La carte tenue suit le doigt ; celles qu'elle survole lui font la place. */
function styleDe(k: number) {
  const s = saisie.value
  if (!s) return undefined
  if (k === s.i) return { transform: `translateY(${s.dy}px)`, transition: 'none', zIndex: 3 }
  if (s.i < k && k <= s.cible) return { transform: `translateY(${-s.pas}px)` }
  if (s.cible <= k && k < s.i) return { transform: `translateY(${s.pas}px)` }
  return undefined
}
onUnmounted(() => { cancelAnimationFrame(auto); clearTimeout(minuteurClavier) })
</script>

<template>
  <div class="pile">
    <RappelRetard />

    <div v-if="!communs.length" class="vide">
      <Etincelles :taille="34" couleur="var(--menthe)" />
      <h2>Rien en commun pour l’instant</h2>
      <p>Les prénoms que vous aimez tous arriveront ici.</p>
      <button class="btn" @click="g.allerA('swipe')">Aller trier</button>
    </div>

    <p v-if="peutRanger" id="aide-ordre" class="mini doux aide">
      Rangez-les en tirant <span aria-hidden="true">⠿</span><span class="sr-only">la poignée</span> :
      le même ordre pour vous {{ nbDecideurs > 2 ? 'tous' : 'deux' }}.
      <span class="sr-only">Au clavier : la poignée, puis les flèches haut et bas.</span>
    </p>
    <p v-if="erreurOrdre" class="mini" role="alert" style="color:var(--non);margin:0">{{ erreurOrdre }}</p>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ annonceOrdre }}</p>

    <div ref="liste" class="liste" :class="{ tient: saisie, pose }">
      <article v-for="(c, i) in communs" :key="c.prenom" class="carte commun"
               :class="{ tous: toutOui(c), tenue: saisie?.i === i }" :style="styleDe(i)">
        <!-- Le bouton porte le prenom et s'etend sur tout l'en-tete (::after) :
             au doigt rien ne change, au clavier l'en-tete devient atteignable. -->
        <div class="ligne entete">
          <button v-if="peutRanger" type="button" class="poignee"
                  :aria-label="`Déplacer ${c.prenom}, ${i + 1} sur ${communs.length}`"
                  aria-describedby="aide-ordre"
                  @pointerdown="saisir($event, i)" @pointermove="bouger"
                  @pointerup="lacher" @pointercancel="lacher" @keydown="auClavier($event, i)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
            </svg>
          </button>
          <div style="flex:1;min-width:0">
            <!-- Le prénom et ses voix sur une ligne : une carte plus courte, c'est
                 plus d'accords à l'écran pour les ranger. Trop long, les voix
                 passent dessous. -->
            <div class="titre">
            <h2>
              <button type="button" class="deplier" :aria-expanded="ouvert === c.prenom"
                      @click="ouvrir(c.prenom)">{{ c.prenom }}</button>
            </h2>
            <p class="voix">
              <span v-if="toutOui(c)" class="v tous">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z" /></svg>
                {{ ouiDeTous }}
              </span>
              <template v-else-if="c.voix?.length">
                <span v-for="v in c.voix" :key="v.pseudo + v.moi" class="v" :class="v.valeur === 2 ? 'oui' : 'neutre'">
                  <svg v-if="v.valeur === 2" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2s-8.4-5-8.4-11A5 5 0 0 1 12 7.1a5 5 0 0 1 8.4 3.1c0 6-8.4 11-8.4 11Z" /></svg>
                  <span v-else aria-hidden="true" class="tilde">~</span>
                  <span class="sr-only">{{ v.valeur === 2 ? 'Oui' : 'Neutre' }} :</span>
                  {{ qui(v) }}
                </span>
              </template>
              <span v-else class="mini doux">
                {{ c.nb_oui }} oui<template v-if="c.nb_neutres"> · {{ c.nb_neutres }} neutre</template>
              </span>
              <span v-if="c.nouveau" class="v nouveau">nouveau</span>
            </p>
            </div>
            <p v-if="c.nb_commentaires || g.parNom.value.get(c.prenom)?.m" class="mini doux" style="margin:3px 0 0">
              <span v-if="c.nb_commentaires" class="mots">{{ motsLisibles(c.nb_commentaires) }}</span>
              <template v-if="c.nb_commentaires && g.parNom.value.get(c.prenom)?.m"> · </template>
              <template v-if="g.parNom.value.get(c.prenom)?.m">« {{ g.parNom.value.get(c.prenom)!.m }} »</template>
            </p>
            <p v-if="c.coeurs?.length" class="mini coeurs" style="margin:4px 0 0">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 0 1 6.6 6.7Z" /></svg>
              <span>Aimé par {{ coeursLisibles(c) }}</span>
            </p>
          </div>
          <!-- Au-dessus de l'en-tête dépliable (::after) : le cœur se touche sans
               ouvrir la carte. -->
          <button v-if="jObserve" type="button" class="coeur" :aria-pressed="!!c.j_aime"
                  :disabled="coeurEnCours === c.prenom"
                  :aria-label="c.j_aime ? `Retirer mon cœur à ${c.prenom}` : `J’aime ${c.prenom}`"
                  @click="basculerCoeur(c)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 0 1 6.6 6.7Z" /></svg>
          </button>
        </div>

        <div v-if="ouvert === c.prenom" class="pile" style="margin-top:14px;gap:10px">
          <div v-for="m in commentaires" :key="m.id" class="mini">
            <strong>{{ m.pseudo }}</strong> : {{ m.texte }}
          </div>
          <p v-if="!commentaires.length" class="mini doux" style="margin:0">Aucun commentaire.</p>
          <div class="ligne">
            <input v-model="brouillon" class="champ mini" placeholder="Votre avis…"
                   :aria-label="`Votre avis sur ${c.prenom}`"
                   @keyup.enter="commenter">
            <button class="btn mini" @click="commenter">Dire</button>
          </div>
          <div class="ligne" style="justify-content:space-between">
            <button class="btn btn-0 mini" @click="g.ouvrirFiche(c.prenom)">Plus d’informations</button>
            <button v-if="!jObserve" class="btn btn-0 mini" style="color:var(--non)"
                    :aria-label="`Veto sur ${c.prenom}`" @click="ecarterPour = c.prenom">
              Veto
            </button>
          </div>
        </div>
      </article>
    </div>
    <FeuilleEcarter v-if="ecarterPour" :prenom="ecarterPour" @fermer="ecarterPour = null" />
  </div>
</template>

<style scoped>
.liste { display: flex; flex-direction: column; gap: 14px; }
.liste.tient { user-select: none; -webkit-user-select: none; }
.liste.pose > .commun { transition: none; }
.commun { padding: 14px 16px; position: relative; transition: transform .18s ease, box-shadow .18s; }
/* Une longue liste d'accords : ce qui est hors de l'écran n'est ni stylé, ni
   mis en page, ni peint tant qu'on n'y arrive pas. Ouvrir le classement ou
   revenir sur ce volet ne coûte plus que ce qu'on en voit. Pas pendant qu'on
   range : la carte tenue a besoin des vraies places de toutes les autres. */
.liste:not(.tient) > .commun { content-visibility: auto; contain-intrinsic-size: auto 76px; }
.commun.tenue { box-shadow: 0 12px 30px rgba(26,35,78,.22); }
/* Oui de tout le monde : la carte le dit avant même qu'on lise. */
.commun.tous { border-color: color-mix(in srgb, var(--oui) 45%, var(--trait));
  background: color-mix(in srgb, var(--oui) 7%, var(--carte)); }

.entete { position: relative; align-items: flex-start; gap: 8px; }
.deplier { all: unset; cursor: pointer; }
.deplier::after { content: ''; position: absolute; inset: 0; }
.deplier:focus-visible { outline: none; }
.entete:has(.deplier:focus-visible) { outline: 3px solid var(--focus); outline-offset: 4px; border-radius: 10px; }

/* La poignée : au-dessus du calque cliquable, cible de 44 px, et elle seule
   saisit la carte (le doigt ailleurs fait défiler). */
.poignee { position: relative; z-index: 1; flex: none; width: 34px; height: 44px; margin: -8px 0 -8px -8px;
  border: 0; background: none; border-radius: 10px; display: grid; place-items: center;
  color: var(--doux); cursor: grab; touch-action: none; }
.poignee svg { width: 20px; height: 20px; fill: currentColor; }
.poignee:active { cursor: grabbing; color: var(--texte); background: var(--fond); }

.titre { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 4px 10px; }
.titre h2 { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.voix { margin: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;
  gap: 5px; }
.v { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 7px;
  border-radius: var(--pastille); font-size: .72rem; font-weight: 700; line-height: 1.3;
  border: 1px solid var(--trait); background: var(--fond); color: var(--doux); }
.v svg { width: 12px; height: 12px; fill: currentColor; flex: none; }
.v .tilde { font-weight: 800; }
.v.oui { color: var(--oui); border-color: color-mix(in srgb, var(--oui) 35%, var(--trait));
  background: color-mix(in srgb, var(--oui) 12%, var(--carte)); }
/* Fond à 12 % comme les autres : à 18 %, le vert clair tombait à 4,4:1. La
   mise en avant tient au contour plus franc, et à la carte entière. */
.v.tous { color: var(--oui); border-color: color-mix(in srgb, var(--oui) 60%, var(--trait));
  background: color-mix(in srgb, var(--oui) 12%, var(--carte)); }
.v.nouveau { color: var(--texte); border-color: transparent;
  background: color-mix(in srgb, var(--peche) 55%, transparent); }

.aide { margin: 0; }
.coeurs { display: flex; align-items: center; gap: 5px; color: var(--texte); }
/* Un mot à lire : il se remarque dans la ligne grise, sans crier. */
.mots { color: var(--texte); font-weight: 700; }
.coeurs svg { width: 13px; height: 13px; flex: none; fill: var(--oui); }
/* Au-dessus du calque cliquable de l'en-tête. */
.coeur { position: relative; z-index: 1; flex: none; width: 44px; height: 44px; border-radius: 999px;
  border: 1px solid var(--trait); background: var(--carte); display: grid; place-items: center;
  cursor: pointer; }
.coeur svg { width: 21px; height: 21px; fill: none; stroke: var(--oui); stroke-width: 2;
  stroke-linejoin: round; }
.coeur[aria-pressed="true"] { border-color: color-mix(in srgb, var(--oui) 55%, var(--trait));
  background: color-mix(in srgb, var(--oui) 16%, var(--carte)); }
.coeur[aria-pressed="true"] svg { fill: var(--oui); }
.coeur:disabled { opacity: .6; }

@media (prefers-reduced-motion: reduce) {
  .commun { transition: none; }
}
</style>
