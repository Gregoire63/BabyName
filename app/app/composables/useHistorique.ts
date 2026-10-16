import { chargerJson } from '~/composables/useCatalogue'
import { prononciation } from '~/composables/usePhonetique'

/**
 * L'HISTORIQUE des prénoms que le catalogue n'a pas (pipeline/export_historique.py) :
 * pour chacun des 29 555 prénoms que l'INSEE publie depuis 1900 sans qu'ils
 * aient été donnés ces trois dernières années, ses naissances par décennie.
 *
 * Il ne sert qu'aux prénoms AJOUTÉS à une liste (useAjouts) : du catalogue,
 * Jeannine n'a rien ; de l'INSEE, 218 695 naissances, surtout dans les années
 * 1930, la dernière en 2015. C'est ce qui remplit sa carte — des chiffres
 * publiés, rien d'estimé. 239 Ko compressés, demandés la première fois qu'une
 * carte ajoutée s'affiche, puis gardés le temps de la page.
 *
 * Il peut manquer (le réseau, un navigateur sans DecompressionStream) :
 * `chargerHistorique` rend alors null, et l'app ne prétend rien — surtout pas
 * qu'un prénom est absent des chiffres de l'INSEE quand elle n'a simplement
 * pas pu les lire.
 */
export interface Historique {
  /** L'écriture de l'INSEE, à la française (« Jeannine », « Marie-Thérèse »). */
  l: string
  /** Les décennies (1900, 1910, … 2020 : cette dernière s'arrête en 2025). */
  decennies: number[]
  /** Naissances par décennie, filles et garçons ensemble. */
  parDecennie: number[]
  total: number
  /** La décennie la plus donnée (1930 : les années 1930). */
  pic: number
  premiere: number
  derniere: number
  /** La règle du catalogue (build_metrics.py) : mixte dès que le moins donné
   *  des deux fait plus de 35 % de la moitié. */
  sexe: 'f' | 'm' | 'fm'
}

interface Index {
  decennies: number[]
  unite: number
  noms: string[]
  f: (0 | number[])[]
  m: (0 | number[])[]
  a: [number, number][]
  rang: Map<string, number>
}

let index: Promise<Index | null> | null = null

export function chargerHistorique(): Promise<Index | null> {
  return index ??= (async () => {
    const d: any = await chargerJson('/data/historique.json', false).catch(() => null)
    if (!d?.noms?.length) return null
    const rang = new Map<string, number>()
    d.noms.forEach((n: string, i: number) => rang.set(n, i))
    return { decennies: d.decennies, unite: d.unite ?? 5, noms: d.noms, f: d.f, m: d.m, a: d.a, rang }
  })().then((x) => {
    // Raté (hors ligne), on retentera à la prochaine carte : pas pour toute la page.
    if (!x) index = null
    return x
  })
}

/** L'écriture du catalogue (titlecase_fr, pipeline/build_metrics.py). */
export function aLaFrancaise(nom: string): string {
  return nom.toLowerCase().split(/([- ’'])/)
    .map(p => /^[- ’']?$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

function deplier(x: 0 | number[], n: number, unite: number): number[] {
  const out = new Array<number>(n).fill(0)
  if (!x) return out
  for (let k = 1; k < x.length; k++) out[x[0]! + k - 1] = x[k]! * unite
  return out
}

function lire(ix: Index, i: number): Historique {
  const n = ix.decennies.length
  const f = deplier(ix.f[i]!, n, ix.unite)
  const m = deplier(ix.m[i]!, n, ix.unite)
  const parDecennie = f.map((v, k) => v + m[k]!)
  const filles = f.reduce((a, b) => a + b, 0)
  const garcons = m.reduce((a, b) => a + b, 0)
  const total = filles + garcons
  const max = Math.max(...parDecennie)
  const unisexe = total ? Math.min(filles, garcons) / total * 2 : 0
  return {
    l: aLaFrancaise(ix.noms[i]!), decennies: ix.decennies, parDecennie, total,
    pic: ix.decennies[parDecennie.indexOf(max)]!,
    premiere: ix.a[i]![0], derniere: ix.a[i]![1],
    sexe: unisexe >= 0.35 ? 'fm' : garcons >= filles ? 'm' : 'f'
  }
}

/** L'historique de CETTE écriture-là : l'INSEE l'écrit en capitales, accents
 *  compris quand il les a (Jérôme et Jerome sont deux lignes chez lui). */
export function historiqueDe(ix: Index, nom: string): Historique | null {
  const i = ix.rang.get(nom.toLocaleUpperCase('fr'))
  return i === undefined ? null : lire(ix, i)
}

/** Une pause rendue au navigateur : un long calcul en tranches ne fige pas
 *  le geste en cours. */
export const souffler = () => new Promise<void>(r => setTimeout(r, 0))

let parCle: Promise<Map<string, number>> | null = null

/**
 * Le prénom de l'historique qui se dit comme `cle` (usePhonetique), le plus
 * donné s'ils sont plusieurs : Jeaninne se dit comme Jeannine.
 *
 * 29 555 clés à calculer, la première fois : une centaine de millisecondes
 * sur un ordinateur, plusieurs fois plus sur un téléphone. Par tranches, une
 * fois pour la page, et seulement quand une carte en a besoin.
 */
export async function jumeauHistorique(ix: Index, cle: string): Promise<Historique | null> {
  parCle ??= (async () => {
    const m = new Map<string, number>()
    const poids = new Map<string, number>()
    const total = (x: 0 | number[]) => x ? x.reduce((a, b, k) => k ? a + b : a, 0) : 0
    for (let i = 0; i < ix.noms.length; i++) {
      const k = prononciation(ix.noms[i]!)
      const t = total(ix.f[i]!) + total(ix.m[i]!)
      if ((poids.get(k) ?? -1) < t) { m.set(k, i); poids.set(k, t) }
      if (i % 2000 === 1999) await souffler()
    }
    return m
  })()
  const i = (await parCle).get(cle)
  return i === undefined ? null : lire(ix, i)
}
