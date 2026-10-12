import type { Prenom } from '~/composables/useCatalogue'
import { bords, estVoyelle } from '~/composables/usePhonetique'
import { t, nombre, type Parametres } from '~/composables/useLangue'

/**
 * « Qu'est-ce qu'on aime, en fait ? »
 *
 * Apres deux cents swipes, personne ne sait dire ce qu'il a choisi. Les oui
 * ont un motif — une epoque, une longueur, une finale — et ce motif est
 * invisible de l'interieur. C'est ce que ce fichier remonte.
 *
 * Deux regles de methode, et tout depend d'elles :
 *
 * 1. LA REFERENCE EST CE QUE LA PERSONNE A JUGE, pas le catalogue. Les
 *    filtres ont deja choisi a sa place : si la liste ne montre que des
 *    prenoms courts, « vous aimez les prenoms courts » ne dit rien. On
 *    compare les oui au vu, donc a decision constante.
 * 2. ON NE PARLE QUE DE CE QUI TIENT. Un ecart sur trois prenoms n'est pas un
 *    gout, c'est du bruit. Seuils explicites ci-dessous, et silence quand ils
 *    ne sont pas atteints : un portrait invente se remarque tout de suite et
 *    disqualifie le reste de l'application.
 *
 * Rien n'est calcule sur des votes qu'on n'a pas le droit de voir : l'entree
 * est `votesVisibles`, qui ne rend les verdicts d'autrui que sur les prenoms
 * qu'on a soi-meme juges.
 */

/** En dessous, on se tait : le motif ne serait pas distinguable du hasard. */
const MIN_OUI = 12
/** Une origine ne se cite qu'a partir de tant de oui la portant. */
const MIN_OCC = 3
/** Ecart relatif minimal pour qu'un trait merite une phrase. */
const LIFT = 1.35

export interface Trait {
  /** Clé stable, sert aussi à comparer deux personnes sur le même axe. */
  axe: 'origine' | 'longueur' | 'rarete' | 'epoque' | 'finale' | 'genre'
  texte: string
  /** Le texte (app/textes/usePortrait) et ses paramètres : de quoi le
   *  réécrire pour quelqu'un d'autre (`qui`, voir PanneauPortrait). */
  cle: string
  p: Parametres
  /** Force du trait, pour trier. */
  poids: number
}

export interface Portrait {
  userId: string
  pseudo: string
  nOui: number
  nJuges: number
  traits: Trait[]
  /** null tant que MIN_OUI n'est pas atteint. */
  assez: boolean
}

export interface VoteVisible {
  prenom: string; user_id: string; pseudo: string; valeur: number
}

const moyenne = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/**
 * Un nombre ecrit dans la langue affichee.
 *
 * `toFixed` rend « 1.8 » et « 3.0 » : un point anglais et un zero inutile, au
 * milieu de phrases qu'on lit comme une conversation. Une virgule en francais,
 * et rien apres l'entier quand il n'y a rien a dire.
 */
const nb = (x: number, d = 1) => nombre(Number(x.toFixed(d)), { maximumFractionDigits: d })

/** Un trait : son texte pour « vous », et de quoi le réécrire pour un autre. */
const trait = (axe: Trait['axe'], poids: number, cle: string, p: Parametres): Trait =>
  ({ axe, poids, cle, p, texte: t(`usePortrait.${cle}`, p) })

/** Finale entendue : une voyelle ou une consonne — l'oreille trie la-dessus. */
function finaleVocalique(nom: string): boolean {
  const f = bords(nom).fin
  return !!f && estVoyelle(f)
}

function traitsDe(oui: Prenom[], juges: Prenom[]): Trait[] {
  const out: Trait[] = []
  const n = oui.length

  // --- origines : sur-representation, pas part brute -----------------------
  const compte = (l: Prenom[]) => {
    const m = new Map<string, number>()
    for (const p of l) for (const o of p.g) m.set(o, (m.get(o) ?? 0) + 1)
    return m
  }
  const cOui = compte(oui), cVu = compte(juges)
  const origines: { o: string; lift: number; k: number }[] = []
  for (const [o, k] of cOui) {
    if (k < MIN_OCC) continue
    const partOui = k / n
    const partVu = (cVu.get(o) ?? 0) / Math.max(1, juges.length)
    if (partVu <= 0) continue
    const lift = partOui / partVu
    if (lift >= LIFT) origines.push({ o, lift, k })
  }
  origines.sort((a, b) => b.lift * b.k - a.lift * a.k)
  if (origines.length) {
    out.push(trait('origine', origines[0]!.lift, 'origine',
      { o1: origines[0]!.o, o2: origines[1]?.o ?? '' }))
  }

  // --- longueur ------------------------------------------------------------
  const syOui = moyenne(oui.map(p => p.y)), syVu = moyenne(juges.map(p => p.y))
  if (syVu > 0 && Math.abs(syOui - syVu) >= 0.28) {
    const court = syOui < syVu
    out.push(trait('longueur', Math.abs(syOui - syVu) * 2, court ? 'court' : 'long',
      { oui: nb(syOui), vu: nb(syVu) }))
  }

  // --- rarete --------------------------------------------------------------
  const oOui = moyenne(oui.map(p => p.o)), oVu = moyenne(juges.map(p => p.o))
  if (oVu > 0 && Math.abs(oOui - oVu) >= 7) {
    const rare = oOui > oVu
    out.push(trait('rarete', Math.abs(oOui - oVu) / 10, rare ? 'rare' : 'courant',
      { oui: nb(oOui, 0), vu: nb(oVu, 0) }))
  }

  // --- epoque : le pic historique, c'est le grand-pere ou le voisin de CP ---
  //
  // La serie commence en 1900 et la colonne est toujours remplie : 1900 est
  // une VRAIE valeur, celle des prenoms deja au sommet quand les archives
  // commencent. Les exclure (`> 1900`) retirait exactement les plus retro —
  // Louise et Jeanne — et tirait la moyenne vers le present.
  const pics = oui.map(p => p.p).filter(x => x >= 1900)
  const picsVu = juges.map(p => p.p).filter(x => x >= 1900)
  if (pics.length >= MIN_OUI * 0.6 && picsVu.length >= 10) {
    const a = moyenne(pics), b = moyenne(picsVu)
    const d = Math.abs(a - b)
    if (d >= 6) {
      // Huit ans ne sont pas « une generation ». On calibre le mot sur
      // l'ecart : une phrase qui sur-vend se retourne contre le reste.
      const ampleur = t(`usePortrait.ampleur_${d >= 22 ? 'generation' : d >= 12 ? 'decennie' : 'annees'}`)
      out.push(trait('epoque', d / 12, a < b ? 'ancien' : 'recent', { an: Math.round(a), ampleur }))
    }
  }

  // --- finale : ce qui s'entend en dernier ---------------------------------
  const vOui = oui.filter(p => finaleVocalique(p.l)).length / n
  const vVu = juges.filter(p => finaleVocalique(p.l)).length / Math.max(1, juges.length)
  if (Math.abs(vOui - vVu) >= 0.14) {
    out.push(vOui > vVu
      ? trait('finale', Math.abs(vOui - vVu) * 3, 'voyelle', { pct: Math.round(vOui * 100) })
      : trait('finale', Math.abs(vOui - vVu) * 3, 'consonne', { pct: Math.round((1 - vOui) * 100) }))
  }

  return out.sort((a, b) => b.poids - a.poids)
}

export function portraits(
  votes: VoteVisible[], parNom: Map<string, Prenom>
): Portrait[] {
  const par = new Map<string, { pseudo: string; oui: Prenom[]; juges: Prenom[] }>()
  for (const v of votes) {
    const p = parNom.get(v.prenom)
    if (!p) continue
    let e = par.get(v.user_id)
    if (!e) { e = { pseudo: v.pseudo, oui: [], juges: [] }; par.set(v.user_id, e) }
    e.juges.push(p)
    if (v.valeur === 2) e.oui.push(p)
  }
  const out: Portrait[] = []
  for (const [userId, e] of par) {
    const assez = e.oui.length >= MIN_OUI && e.juges.length >= MIN_OUI * 2
    out.push({
      userId, pseudo: e.pseudo, nOui: e.oui.length, nJuges: e.juges.length, assez,
      traits: assez ? traitsDe(e.oui, e.juges) : []
    })
  }
  return out.sort((a, b) => b.nOui - a.nOui)
}

/**
 * La ou ca diverge.
 *
 * Deux portraits cote a cote ne disent pas grand-chose ; ce qui interesse un
 * couple, c'est l'axe sur lequel ils ne sont pas d'accord. On ne le declare
 * que si les deux ont assez juge : sinon on compare un gout a un hasard.
 */
export function divergence(
  votes: VoteVisible[], parNom: Map<string, Prenom>
): string | null {
  const par = new Map<string, { pseudo: string; oui: Prenom[] }>()
  for (const v of votes) {
    if (v.valeur !== 2) continue
    const p = parNom.get(v.prenom)
    if (!p) continue
    let e = par.get(v.user_id)
    if (!e) { e = { pseudo: v.pseudo, oui: [] }; par.set(v.user_id, e) }
    e.oui.push(p)
  }
  const gens = [...par.values()].filter(e => e.oui.length >= MIN_OUI)
  if (gens.length < 2) return null
  const [a, b] = gens.slice(0, 2) as [typeof gens[0], typeof gens[0]]

  const axes: { nom: string; va: number; vb: number; unite: (x: number) => string; seuil: number }[] = [
    { nom: t('usePortrait.axe_longueur'), va: moyenne(a.oui.map(p => p.y)), vb: moyenne(b.oui.map(p => p.y)),
      unite: x => t('usePortrait.unite_longueur', { n: nb(x) }), seuil: 0.35 },
    { nom: t('usePortrait.axe_rarete'), va: moyenne(a.oui.map(p => p.o)), vb: moyenne(b.oui.map(p => p.o)),
      unite: x => t('usePortrait.unite_rarete', { n: nb(x, 0) }), seuil: 9 },
    { nom: t('usePortrait.axe_epoque'), va: moyenne(a.oui.map(p => p.p).filter(x => x >= 1900)),
      vb: moyenne(b.oui.map(p => p.p).filter(x => x >= 1900)),
      unite: x => t('usePortrait.unite_epoque', { n: Math.round(x) }), seuil: 8 }
  ]
  const pires = axes
    .filter(x => Number.isFinite(x.va) && Number.isFinite(x.vb) && Math.abs(x.va - x.vb) >= x.seuil)
    .sort((x, y) => Math.abs(y.va - y.vb) / y.seuil - Math.abs(x.va - x.vb) / x.seuil)
  const d = pires[0]
  if (!d) return null
  return t('usePortrait.divergence',
    { axe: d.nom, a: a.pseudo, va: d.unite(d.va), b: b.pseudo, vb: d.unite(d.vb) })
}

/**
 * Pourquoi ce prenom-la coince.
 *
 * « A revoir » disait qui avait dit quoi, jamais pourquoi. Or la reponse est
 * dans les votes : si quelqu'un dit non a Marius et oui a des prenoms qui font
 * 2,1 syllabes en moyenne, ce n'est pas Marius qu'il refuse, c'est trois
 * syllabes. Le dire desamorce la discussion — on arrete de defendre un prenom
 * pour parler de ce qu'on aime.
 *
 * Trois garde-fous, et ils comptent plus que la fonction :
 *
 * 1. On n'explique que le NON. Expliquer un oui ne sert a rien, et pointer ce
 *    que l'autre aime ressemblerait vite a un argumentaire contre lui.
 * 2. Il faut MIN_OUI oui visibles chez la personne qui refuse. En dessous, la
 *    moyenne est du bruit et l'explication serait une invention credible —
 *    le pire cas, parce qu'elle serait crue.
 * 3. Il faut un ECART NET : au moins 1,2 ecart-type, sur un axe ou la personne
 *    est reellement constante. Un prenom moyen sur tous les axes n'a pas
 *    d'explication, et on se tait.
 */
const ECART_MIN = 1.2

function ecartType(xs: number[]): number {
  if (xs.length < 3) return 0
  const m = moyenne(xs)
  return Math.sqrt(moyenne(xs.map(x => (x - m) ** 2)))
}

export interface Explication {
  /** Qui refuse — la phrase est ecrite de son point de vue. */
  pseudo: string
  texte: string
}

interface Axe {
  /** Son nom et son unité : app/textes/usePortrait (axe_…, unite_…). */
  id: 'longueur' | 'rarete' | 'epoque'
  valeur: (p: Prenom) => number | null
  dire: (x: number) => string
}

const AXES: Axe[] = [
  { id: 'longueur', valeur: p => p.y, dire: x => t('usePortrait.unite_longueur', { n: nb(x) }) },
  { id: 'rarete', valeur: p => p.o, dire: x => t('usePortrait.unite_rarete', { n: nb(x, 0) }) },
  { id: 'epoque', valeur: p => (p.p >= 1900 ? p.p : null), dire: x => t('usePortrait.unite_epoque', { n: Math.round(x) }) }
]

/**
 * Les explications de TOUS les désaccords d'un coup.
 *
 * La version d'origine expliquait un prénom à la fois, en relisant tous les
 * votes pour chacun : qui a refusé, puis ses oui, puis leurs moyennes.
 * « À revoir » l'appelait pour chaque ligne, deux fois par ligne — un calcul
 * en (désaccords × votes), refait à chaque ouverture du volet et à chaque
 * vote. Mesuré avec 600 votes : 2,3 s sur un ordinateur, 7 s processeur
 * ralenti quatre fois, pendant lesquelles rien ne répond.
 *
 * Ici les votes sont lus UNE fois : le premier « non » d'un autre sur chaque
 * prénom, les oui de chacun, puis — par personne qui refuse, et une seule
 * fois — ce que ses oui ont de constant sur chaque axe. Mêmes règles, mêmes
 * phrases, au mot près.
 */
export function expliquerDesaccords(
  prenoms: Iterable<string>,
  votes: VoteVisible[],
  parNom: Map<string, Prenom>,
  moiId: string
): Map<string, Explication> {
  // Qui a dit non a CE prenom, en dehors de moi (le premier, dans l'ordre des
  // votes) ; et les oui de chacun.
  const refusDe = new Map<string, VoteVisible>()
  const ouiDe = new Map<string, Prenom[]>()
  for (const v of votes) {
    if (v.valeur === 0 && v.user_id !== moiId && !refusDe.has(v.prenom)) refusDe.set(v.prenom, v)
    if (v.valeur !== 2) continue
    const q = parNom.get(v.prenom)
    if (!q) continue
    const l = ouiDe.get(v.user_id)
    if (l) l.push(q); else ouiDe.set(v.user_id, [q])
  }

  // Ce que les oui d'une personne ont de constant, axe par axe. null : pas
  // assez de oui, ou rien de constant sur cet axe.
  type Constante = { axe: Axe; m: number; sd: number } | null
  const profils = new Map<string, Constante[] | null>()
  const profilDe = (userId: string): Constante[] | null => {
    const connu = profils.get(userId)
    if (connu !== undefined) return connu
    const sesOui = ouiDe.get(userId) ?? []
    const profil = sesOui.length < MIN_OUI ? null : AXES.map((axe): Constante => {
      const xs = sesOui.map(axe.valeur).filter((x): x is number => x !== null)
      if (xs.length < MIN_OUI) return null
      const sd = ecartType(xs)
      return sd > 0 ? { axe, m: moyenne(xs), sd } : null
    })
    profils.set(userId, profil)
    return profil
  }

  const explications = new Map<string, Explication>()
  for (const prenom of prenoms) {
    const p = parNom.get(prenom)
    const refus = refusDe.get(prenom)
    if (!p || !refus) continue
    const profil = profilDe(refus.user_id)
    if (!profil) continue

    let meilleur: { axe: Axe; m: number; x: number; ecarts: number } | null = null
    for (const c of profil) {
      if (!c) continue
      const x = c.axe.valeur(p)
      if (x === null) continue
      const ecarts = Math.abs(x - c.m) / c.sd
      if (ecarts >= ECART_MIN && (!meilleur || ecarts > meilleur.ecarts)) {
        meilleur = { axe: c.axe, m: c.m, x, ecarts }
      }
    }
    if (!meilleur) continue

    const { axe, m, x } = meilleur
    explications.set(prenom, {
      pseudo: refus.pseudo,
      texte: t('usePortrait.explication',
        { prenom: p.l, axe: t(`usePortrait.axe_${axe.id}`), qui: refus.pseudo, m: axe.dire(m), x: axe.dire(x) })
    })
  }
  return explications
}

/** Un seul prénom : la même chose, pour qui n'en a qu'un à expliquer. */
export function expliquerDesaccord(
  prenom: string,
  votes: VoteVisible[],
  parNom: Map<string, Prenom>,
  moiId: string
): Explication | null {
  return expliquerDesaccords([prenom], votes, parNom, moiId).get(prenom) ?? null
}

/** Assez de matière pour expliquer un refus ? Sert à dire pourquoi on se tait. */
export function quiPeutEtreExplique(
  votes: VoteVisible[], moiId: string
): { pseudo: string; oui: number }[] {
  const par = new Map<string, { pseudo: string; oui: number }>()
  for (const v of votes) {
    if (v.user_id === moiId) continue
    let e = par.get(v.user_id)
    if (!e) { e = { pseudo: v.pseudo, oui: 0 }; par.set(v.user_id, e) }
    if (v.valeur === 2) e.oui++
  }
  return [...par.values()]
}

export { MIN_OUI }
