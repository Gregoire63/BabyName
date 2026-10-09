import { chargerJson, sansAccent, seuilDeTendance, type ChiffreFx, type Prenom } from '~/composables/useCatalogue'

/**
 * Les prénoms dans tous les pays dont les statistiques sont libres et
 * complètes (pipeline/pays.py) : France, Belgique, Suisse, Québec, Ontario,
 * États-Unis, Royaume-Uni, Irlande, Autriche, Suède, Norvège, Pologne…
 *
 * Un fichier par pays, chargé seulement quand une liste le choisit (ou quand
 * une fiche montre tous les pays) : les États-Unis seuls pèsent 270 Ko.
 *
 * Ce qu'un pays apporte :
 *  - ses chiffres, posés sur chaque prénom du catalogue (`p.px[code]`) ;
 *  - ses prénoms absents du catalogue (Brooklyn, Emiel, Zofia…), créés ici
 *    comme « prénoms d'ailleurs » : pas de chiffre français, une originalité
 *    française de 100, et leurs chiffres là-bas.
 *
 * Ce que les pays CHOISIS décident (`appliquerPays`) : la pile (les prénoms
 * donnés dans l'un d'eux), la rareté, l'originalité et le « 1 sur N » de la
 * carte — une fréquence COMMUNE, naissances du prénom dans ces pays sur
 * toutes leurs naissances, pas une moyenne de pourcentages où la Norvège
 * pèserait autant que les États-Unis.
 */

export interface Pays {
  code: string; nom: string; groupe: string
  /** Le nom court de l'organisme, pour le badge (INSEE, Statbel, SSA, ONS…). */
  sigle: string
  /** La France : ses chiffres sont ceux du catalogue lui-même. */
  catalogue: boolean
  organisme: string; jeu: string; licence: string; url: string
  annees: [number, number]; seuil: string
  /** false : le pays publie un total filles et garçons confondus (Québec). */
  par_sexe: boolean; note: string
  total: number | { f: number; m: number }
  prenoms?: number; nouveaux?: number
}

let index: Pays[] | null = null
let indexEnCours: Promise<Pays[]> | null = null
const charges = new Map<string, Promise<void>>()
/** Les prénoms créés par les pays : un par graphie, quel que soit le pays. */
const crees = new Map<string, Prenom & { _f: number; _m: number }>()
let prochainGroupe = 1_000_000

export async function chargerIndexPays(): Promise<Pays[]> {
  if (index) return index
  indexEnCours ??= (async () => {
    const d: any = await $fetch('/data/pays/index.json')
    index = d.pays as Pays[]
    return index
  })()
  return indexEnCours
}
export const indexPays = () => index ?? []
export const paysDe = (code: string) => (index ?? []).find(p => p.code === code)

/** Naissances de la fenêtre, filles et garçons confondus. */
export function totalPays(p: Pays): number {
  return typeof p.total === 'number' ? p.total : p.total.f + p.total.m
}
/** Le dénominateur qui va avec un prénom : son sexe si le pays sépare. */
export function totalPour(p: Pays, sexe: Prenom['sexe']): number {
  if (typeof p.total === 'number') return p.total
  return sexe === 'f' ? p.total.f : sexe === 'm' ? p.total.m : p.total.f + p.total.m
}

/**
 * Charge les pays demandés (une fois chacun) et pose leurs chiffres sur le
 * catalogue. Rend la liste COMPLÈTE : le catalogue + les prénoms créés.
 */
export async function chargerPays(catalogue: Prenom[], codes: readonly string[]): Promise<Prenom[]> {
  await chargerIndexPays()
  const parNom = new Map<string, Prenom>()
  for (const p of catalogue) if (!parNom.has(p.l)) parNom.set(p.l, p)
  await Promise.all(codes.filter(c => c !== 'fr' && paysDe(c)).map(code => {
    let pr = charges.get(code)
    if (!pr) {
      pr = chargerJson(`/data/pays/${code}.json`).then(d => poser(d, parNom, catalogue))
      charges.set(code, pr)
      pr.catch(() => charges.delete(code))
    }
    return pr
  }))
  return crees.size ? [...catalogue, ...crees.values()] : catalogue
}

/** Tous les pays : pour la fiche, qui les montre tous. */
export async function chargerTousLesPays(catalogue: Prenom[]): Promise<Prenom[]> {
  const idx = await chargerIndexPays()
  return chargerPays(catalogue, idx.map(p => p.code))
}

function poser(d: { code: string; lignes: any[] }, parNom: Map<string, Prenom>, catalogue: Prenom[]) {
  const code = d.code
  // [label, sexe 0/1/2, n, rang, tendance, nouveau, nb_car?, nb_syllabes?]
  const parLabel = new Map<string, any[][]>()
  for (const l of d.lignes) {
    const a = parLabel.get(l[0]); a ? a.push(l) : parLabel.set(l[0], [l])
  }
  for (const [label, lignes] of parLabel) {
    let p = parNom.get(label) ?? crees.get(label)
    if (!p) {
      const l0 = lignes[0]!
      const base = sansAccent(label)
      const neuf = {
        l: label, slug: base.replace(/[^a-z]/g, ''), sexe: 'f' as Prenom['sexe'],
        gp: prochainGroupe++, fgp: 0, ngp: 1, tgp: 0,
        u: 0, f: 0, n: 0, t: 0, p: 0, o: 100, r: 0, rv: false, q: false,
        c: l0[6] ?? label.replace(/[- ’']/g, '').length, y: l0[7] ?? 2,
        k: /[- ]/.test(label), i: (base[0] ?? '').toUpperCase(), e: base.slice(-1),
        g: [], m: null, me: null, cf: null, ob: false, obn: null, dm: [],
        sr: null, nb: null, fx: null, hf: true, poids: 0, px: {}, _f: 0, _m: 0
      }
      markRaw(neuf)
      crees.set(label, neuf)
      p = neuf
    }
    // Le chiffre qui va avec CE prénom : son sexe, les deux s'il est mixte.
    const f = lignes.find(l => l[1] === 0), m = lignes.find(l => l[1] === 1), x = lignes.find(l => l[1] === 2)
    const cree = crees.get(label)
    if (cree) {
      cree._f += (f?.[2] ?? 0) + (x ? x[2] / 2 : 0)
      cree._m += (m?.[2] ?? 0) + (x ? x[2] / 2 : 0)
      const tot = cree._f + cree._m
      cree.u = tot ? Math.min(cree._f, cree._m) / tot * 2 : 0
      cree.sexe = cree.u >= 0.35 ? 'fm' : cree._m > cree._f ? 'm' : 'f'
    }
    let v: ChiffreFx | null = null
    if (x) v = { n: x[2], rang: x[3], t: x[4] }
    else if (p.sexe === 'f' && f) v = { n: f[2], rang: f[3], t: f[4] }
    else if (p.sexe === 'm' && m) v = { n: m[2], rang: m[3], t: m[4] }
    else if (p.sexe === 'fm' || cree) {
      const n = (f?.[2] ?? 0) + (m?.[2] ?? 0)
      if (n) v = { n, rang: null, t: null }
    }
    if (v) (p.px ??= {})[code] = v
    else if (p.px) delete p.px[code]
  }
  void catalogue
}

/** Le chiffre d'un prénom dans un pays (la France vient du catalogue). */
export function chiffre(p: Prenom, code: string): ChiffreFx | null {
  if (code === 'fr') {
    if (p.hf || !p.n) return null
    return { n: p.n, rang: null, t: p.n >= seuilDeTendance() ? p.t : null }
  }
  return p.px?.[code] ?? null
}

const HI = Math.log10(80), LO = Math.log10(0.01)
/** Même échelle que l'INSEE (build_metrics) : 0 = le n°1, 100 = quasi inexistant. */
const originalite = (p10k: number) =>
  Math.round(Math.min(100, Math.max(0, 100 * (HI - Math.log10(Math.max(p10k, 0.01))) / (HI - LO))))

/**
 * Pose sur chaque prénom ses chiffres COMMUNS aux pays choisis : naissances
 * cumulées, rareté (moins de 20 en trois ans, le seuil de la pile INSEE),
 * fréquence, originalité, tendance (moyenne des pays pondérée par leurs
 * naissances), et le poids qui ordonne la pile à l'échelle française.
 *
 * France seule : exactement les chiffres INSEE, rien ne bouge.
 */
const poidsInitial = new WeakMap<Prenom, number>()
export function appliquerPays(liste: Prenom[], codes: readonly string[]) {
  const pays = codes.map(paysDe).filter((x): x is Pays => !!x)
  const fr = paysDe('fr')
  const nFrance = fr ? totalPays(fr) : 1
  const seul = pays.length === 1 && pays[0]!.code === 'fr'
  const totSel = pays.reduce((t, p) => t + totalPays(p), 0) || 1
  for (const p of liste) {
    let n = 0, tn = 0, tw = 0
    for (const ps of pays) {
      const c = chiffre(p, ps.code)
      if (!c) continue
      n += c.n
      if (c.t !== null) { tn += c.t * c.n; tw += c.n }
    }
    p.nsel = n
    p.qsel = n < 20
    p.fsel = n / totSel * 10000
    p.osel = seul ? p.o : originalite(p.fsel)
    p.tsel = seul ? (p.n >= seuilDeTendance() ? p.t : null) : n >= 60 && tw ? tn / tw : null
    // Un prénom d'ailleurs garde, en France seule, le poids que le catalogue
    // lui donne (sa part dans le pays où il vit, à l'échelle française).
    if (!poidsInitial.has(p)) poidsInitial.set(p, p.poids)
    p.poids = seul ? (p.hf ? poidsInitial.get(p)! : p.n) : Math.round(n / totSel * nFrance)
  }
}

/** « France », « France et Belgique », « vos 4 pays ». */
export function nomSelection(codes: readonly string[]): string {
  const noms = codes.map(c => paysDe(c)?.nom ?? c)
  if (noms.length <= 2) return noms.join(' et ')
  return `vos ${noms.length} pays`
}

/**
 * Le pays (hors France) où ce prénom pèse le plus, parmi ceux chargés :
 * « en Belgique, 1 garçon sur 284 ». Pour la carte d'un prénom d'ailleurs.
 */
export function meilleurPays(p: Prenom): { pays: Pays; sur: string; en: string; v: ChiffreFx } | null {
  let mieux: { pays: Pays; v: ChiffreFx; part: number; tot: number } | null = null
  for (const [code, v] of Object.entries(p.px ?? {})) {
    const pays = paysDe(code)
    if (!pays) continue
    const tot = totalPour(pays, p.sexe)
    const part = v.n / tot
    if (!mieux || part > mieux.part) mieux = { pays, v, part, tot }
  }
  if (!mieux) return null
  const m = mieux as { pays: Pays; v: ChiffreFx; part: number; tot: number }
  const qui = !m.pays.par_sexe ? 'bébé' : p.sexe === 'f' ? 'fille' : p.sexe === 'm' ? 'garçon' : 'bébé'
  return { pays: m.pays, v: m.v, sur: `1 ${qui} sur ${Math.round(m.tot / m.v.n).toLocaleString('fr-FR')}`,
           en: `${enPays(m.pays)}` }
}

/** « en Belgique », « au Québec », « aux États-Unis », « en Ontario ». */
export function enPays(p: Pays): string {
  if (p.code === 'qc') return 'au Québec'
  if (p.code === 'us') return 'aux États-Unis'
  return `en ${p.nom}`
}
