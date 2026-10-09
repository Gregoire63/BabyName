import { sansAccent, type Prenom } from '~/composables/useCatalogue'
import { syllabes } from '~/composables/useNomComplet'
import { prononciation } from '~/composables/usePhonetique'
import { chargerHistorique, historiqueDe, jumeauHistorique, souffler, type Historique } from '~/composables/useHistorique'

/**
 * LES PRÉNOMS AJOUTÉS À UNE LISTE, devenus des cartes.
 *
 * Un membre ajoute depuis la recherche un prénom que le catalogue n'a pas
 * (server/api/groupes/[id]/ajouts.post.ts). Pour la pile, les accords et la
 * fiche, il doit être une fiche comme une autre : `ficheAjoutee` la fabrique,
 * avec des valeurs neutres là où le catalogue aurait des chiffres — zéro
 * naissance récente, aucune origine, aucun sens. Personne ne les affiche :
 * la carte et la fiche le reconnaissent à `ajout` et montrent à la place ce
 * qu'on en sait vraiment (`donneesAjout`).
 *
 * Ce qu'on en sait, sans rien inventer :
 *  1. l'historique de l'INSEE pour cette écriture (useHistorique) — Jeannine,
 *     Jerome sans ses accents, Ginette ;
 *  2. sinon, ou en plus, le prénom qui SE DIT pareil : au catalogue
 *     (Jérôme, pour Jerome), à défaut dans l'historique (Jeannine, pour
 *     Jeaninne) — ses chiffres à lui, dits comme tels ;
 *  3. les prénoms du catalogue qui s'écrivent presque pareil ;
 *  4. et, s'il n'y a rien : qu'il n'apparaît dans aucun chiffre publié par
 *     l'INSEE depuis 1900 — ce qui est vrai, et dit quelque chose.
 * Pas de sens, pas d'origine : une étymologie devinée pour un prénom inventé
 * serait un mensonge poli, et l'app perdrait la confiance qu'on fait à
 * toutes les autres.
 */

/** Une ligne de `ajouts`, dans l'état d'une liste (groupes/[id]/index.get.ts). */
export interface EntreeAjout {
  prenom: string
  mot: string | null
  auteur: string | null
  mien: boolean
  ajoute_le: string
}

// Une fiche par prénom, la même tant que rien n'en change : la pile reconnaît
// ses cartes par leur nom, mais un objet neuf à chaque rechargement de la liste
// referait tout ce qui en dépend.
const fiches = new Map<string, Prenom>()
// Un groupe de prononciation à lui (négatif : jamais celui d'un prénom du
// catalogue) : il ne fusionne avec aucune carte, et aucune ne l'emporte.
const groupes = new Map<string, number>()

export function ficheAjoutee(a: EntreeAjout): Prenom {
  const info = { par: a.auteur, mien: a.mien, mot: a.mot, le: a.ajoute_le }
  const deja = fiches.get(a.prenom)
  const i = deja?.ajout
  if (deja && i && i.par === info.par && i.mien === info.mien && i.mot === info.mot && i.le === info.le) return deja
  let gp = groupes.get(a.prenom)
  if (gp === undefined) { gp = -1 - groupes.size; groupes.set(a.prenom, gp) }
  const slug = sansAccent(a.prenom).replace(/[^a-z]/g, '')
  const p: Prenom = markRaw({
    l: a.prenom, slug, sexe: 'fm', gp, fgp: 0, ngp: 1, tgp: 0,
    u: 0, f: 0, n: 0, t: 0, p: 0,
    // L'originalité du catalogue : 100, « quasi inexistant » — vrai d'un
    // prénom qu'aucune naissance récente ne porte.
    o: 100, r: 0, rv: false, q: false,
    c: a.prenom.replace(/[- ’']/g, '').length, y: syllabes(a.prenom),
    k: /[- ]/.test(a.prenom), i: (slug[0] ?? '').toUpperCase(), e: slug.slice(-1),
    g: [], m: null, me: null, cf: null, ob: false, obn: null, dm: [],
    sr: null, nb: null, ajout: info
  })
  fiches.set(a.prenom, p)
  return p
}

// --------------------------------------------------------- ce qui se dit pareil

let clesCatalogue: Promise<Map<string, Prenom>> | null = null

/**
 * Le prénom du catalogue qui se dit comme `cle`, le plus donné de son groupe
 * (le catalogue est trié par naissances). Une clé par groupe de prononciation
 * suffit : toutes ses graphies la partagent (essai-ajout le vérifie sur les
 * 19 608). Calculé une fois pour la page, par tranches.
 */
async function jumeauCatalogue(catalogue: Prenom[], cle: string): Promise<Prenom | null> {
  clesCatalogue ??= (async () => {
    const m = new Map<string, Prenom>()
    const vus = new Set<number>()
    let n = 0
    for (const p of catalogue) {
      if (vus.has(p.gp)) continue
      vus.add(p.gp)
      const k = prononciation(p.l)
      if (!m.has(k)) m.set(k, p)
      if (++n % 1500 === 0) await souffler()
    }
    return m
  })()
  return (await clesCatalogue).get(cle) ?? null
}

export interface Jumeau {
  l: string
  /** Au catalogue : sa fiche (sa courbe, sa fréquence aujourd'hui). */
  p?: Prenom
  /** Dans l'historique seulement : ses décennies. */
  h?: Historique
}

/**
 * Le prénom qui se dit comme `nom` et s'écrit autrement : au catalogue
 * d'abord (une carte qui existe déjà), dans l'historique ensuite. Sert à la
 * carte (« se dit comme ») et à la recherche, qui le propose avant d'ajouter
 * une faute de frappe.
 */
export async function jumeauDe(nom: string, catalogue: Prenom[], aussiHistorique = true): Promise<Jumeau | null> {
  const cle = prononciation(nom)
  if (!cle.replace(/-/g, '')) return null
  const meme = (l: string) => l.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr')
  const p = await jumeauCatalogue(catalogue, cle)
  if (p && !meme(p.l)) return { l: p.l, p }
  if (!aussiHistorique) return null
  const ix = await chargerHistorique()
  const h = ix ? await jumeauHistorique(ix, cle) : null
  return h && !meme(h.l) ? { l: h.l, h } : null
}

// ------------------------------------------------- ce qui s'écrit presque pareil

/** Distance d'édition, abandonnée dès qu'elle dépasse `max` (-1). */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return -1
  let avant = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const ligne = [i]
    let mini = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(avant[j]! + 1, ligne[j - 1]! + 1, avant[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
      ligne.push(v)
      if (v < mini) mini = v
    }
    if (mini > max) return -1
    avant = ligne
  }
  return avant[b.length]! <= max ? avant[b.length]! : -1
}

/**
 * Les prénoms du catalogue qui s'écrivent presque pareil — une lettre de
 * différence, deux pour un prénom long —, les plus donnés d'abord, un par
 * groupe de prononciation, hors des très rares (qu'on ne connaît pas mieux
 * que le prénom ajouté).
 */
export function prochesDe(nom: string, catalogue: Prenom[], exclure: Set<string>, max = 4): Prenom[] {
  const slug = sansAccent(nom).replace(/[^a-z]/g, '')
  if (slug.length < 3) return []
  const seuil = slug.length <= 5 ? 1 : 2
  const vus = new Set<number>()
  const trouves: { p: Prenom; d: number }[] = []
  for (const p of catalogue) {
    if (p.q || vus.has(p.gp)) continue
    vus.add(p.gp)
    if (exclure.has(p.l) || p.slug === slug) continue
    const d = distance(slug, p.slug, seuil)
    if (d > 0) trouves.push({ p, d })
  }
  return trouves.sort((x, y) => x.d - y.d || y.p.n - x.p.n).slice(0, max).map(x => x.p)
}

// --------------------------------------------------------------- tout ensemble

export interface DonneesAjout {
  /**
   * Son historique à l'INSEE ; `absent` s'il n'y figure pas (rien de publié
   * depuis 1900) ; null si l'historique n'a pas pu être lu — on ne dit alors
   * rien de son absence.
   */
  hist: Historique | 'absent' | null
  jumeau: Jumeau | null
  proches: Prenom[]
  /** Fille, garçon, mixte : seulement d'après SON historique, jamais d'après
   *  un prénom qui se dit pareil (Maël n'est pas Maëlle). */
  sexe: 'f' | 'm' | 'fm' | null
}

const memo = shallowReactive(new Map<string, DonneesAjout>())
const enCours = new Set<string>()

/**
 * Ce qu'on sait d'un prénom ajouté — undefined le temps de le calculer (un
 * historique à charger, des clés à poser), puis la réponse, gardée pour la
 * page. Réactif : lu dans un `computed`, il se met à jour tout seul.
 */
export function donneesAjout(p: Prenom, catalogue: Prenom[]): DonneesAjout | undefined {
  const d = memo.get(p.l)
  if (d || enCours.has(p.l) || !catalogue.length) return d
  enCours.add(p.l)
  ;(async () => {
    const ix = await chargerHistorique()
    const h = ix ? historiqueDe(ix, p.l) : null
    // Avec son propre historique, un prénom n'a pas besoin de celui d'un
    // autre : seul un jumeau du catalogue (une carte qui existe) reste utile.
    const jumeau = await jumeauDe(p.l, catalogue, !h)
    const proches = prochesDe(p.l, catalogue, new Set(jumeau ? [jumeau.l] : []))
    return { hist: h ?? (ix ? 'absent' as const : null), jumeau, proches, sexe: h?.sexe ?? null }
  })()
    // Quoi qu'il arrive, une réponse : sans elle, la carte attendrait pour
    // toujours. Rien de su, rien de dit.
    .catch(() => ({ hist: null, jumeau: null, proches: [], sexe: null }))
    .then(d => { memo.set(p.l, d) })
    .finally(() => enCours.delete(p.l))
  return undefined
}

/** « années 1930 » ; « années 2020 » se lit pareil, même inachevées. */
export const anneesDe = (decennie: number) => `années ${decennie}`
