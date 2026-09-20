/**
 * Catalogue embarqué : 7 667 prénoms, 180 Ko gzip, chargé une fois puis gardé
 * en mémoire. Tout le filtrage et tout le tri se font ici, côté client :
 * un changement de filtre ne doit jamais coûter un aller-retour réseau.
 */
export interface Prenom {
  l: string; slug: string; sexe: 'f' | 'm' | 'fm'
  u: number; f: number; n: number; t: number; p: number
  o: number; r: number; rv: boolean
  c: number; y: number; k: boolean; i: string; e: string
  g: string[]; m: string | null; me: string | null
  ob: boolean; obn: string | null; dm: string[]
  sr: number[] | null
}

export interface Filtres {
  sexe: ('f' | 'm' | 'fm')[]
  origines_in: string[]
  origines_out: string[]
  car: [number, number]
  syllabes: [number, number]
  compose: boolean | null
  originalite: [number, number]
  risque_max: number
  sens_requis: boolean
  exclure_objet: boolean
  initiales_out: string[]
  finales_out: string[]
  revival_seulement: boolean
  recherche: string
}

export const filtresParDefaut = (): Filtres => ({
  sexe: ['f', 'm', 'fm'],
  origines_in: [], origines_out: [],
  car: [2, 14], syllabes: [1, 6],
  compose: null,
  originalite: [0, 100], risque_max: 100,
  sens_requis: false, exclure_objet: false,
  initiales_out: [], finales_out: [],
  revival_seulement: false, recherche: ''
})

/** Le catalogue est livré pré-compressé. On le décompresse dans le navigateur ;
 *  si DecompressionStream manque, on retombe sur le .json non compressé. */
async function chargerJson(): Promise<any> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const r = await fetch('/data/catalogue.json.gz')
      if (r.ok && r.body) {
        const flux = r.body.pipeThrough(new DecompressionStream('gzip'))
        return JSON.parse(await new Response(flux).text())
      }
    } catch { /* on tente le repli */ }
  }
  return $fetch('/data/catalogue.json')
}

let cache: { liste: Prenom[]; origines: string[]; annees: [number, number] } | null = null
let enCours: Promise<typeof cache> | null = null

export const sansAccent = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export async function chargerCatalogue() {
  if (cache) return cache
  if (enCours) return enCours
  enCours = (async () => {
    const d: any = await chargerJson()
    const c = d.cols
    const liste: Prenom[] = new Array(d.n)
    for (let k = 0; k < d.n; k++) {
      liste[k] = {
        l: c.l[k], slug: sansAccent(c.l[k]).replace(/[^a-z]/g, ''),
        sexe: d.sexe[c.s[k]], u: c.u[k], f: c.f[k], n: c.n[k], t: c.t[k], p: c.p[k],
        o: c.o[k], r: c.r[k], rv: !!c.rv[k],
        c: c.c[k], y: c.y[k], k: !!c.k[k], i: c.i[k], e: c.e[k],
        g: c.g[k].map((x: number) => d.origines[x]),
        m: c.m[k], me: c.me[k], ob: !!c.ob[k], obn: c.obn[k], dm: c.dm[k],
        sr: c.sr ? c.sr[k] : null
      }
    }
    cache = { liste, origines: d.origines, annees: d.serie_annees ?? [1986, 2025] }
    return cache
  })()
  return enCours
}

export function filtrer(liste: Prenom[], f: Filtres): Prenom[] {
  const rech = f.recherche ? sansAccent(f.recherche) : ''
  const oin = new Set(f.origines_in)
  const oout = new Set(f.origines_out)
  const iout = new Set(f.initiales_out.map(x => x.toUpperCase()))
  const eout = new Set(f.finales_out.map(x => sansAccent(x)))
  const sexes = new Set(f.sexe)

  return liste.filter(p => {
    if (!sexes.has(p.sexe)) return false
    if (p.c < f.car[0] || p.c > f.car[1]) return false
    if (p.y < f.syllabes[0] || p.y > f.syllabes[1]) return false
    if (f.compose !== null && p.k !== f.compose) return false
    if (p.o < f.originalite[0] || p.o > f.originalite[1]) return false
    if (p.r > f.risque_max) return false
    if (f.sens_requis && !p.m) return false
    if (f.exclure_objet && p.ob) return false
    if (iout.size && iout.has(p.i)) return false
    if (eout.size && eout.has(sansAccent(p.e))) return false
    if (f.revival_seulement && !p.rv) return false
    if (oout.size && p.g.some(o => oout.has(o))) return false
    if (oin.size && !p.g.some(o => oin.has(o))) return false
    if (rech && !p.slug.includes(rech)) return false
    return true
  })
}

/**
 * Ordre de présentation du swipe. Au début : les plus courants d'abord, pour
 * que les premiers écrans parlent. Dès qu'il y a des « oui », on remonte ce
 * qui leur ressemble (origine, syllabes, initiale, rareté comparable) — sinon
 * l'utilisateur abandonne avant d'avoir vu ce qui l'intéresse.
 */
export function ordonner(liste: Prenom[], aimes: Prenom[]): Prenom[] {
  if (aimes.length < 3) return [...liste].sort((a, b) => b.n - a.n)

  const orig = new Map<string, number>()
  let sylTot = 0, oTot = 0
  const init = new Map<string, number>()
  for (const p of aimes) {
    for (const o of p.g) orig.set(o, (orig.get(o) ?? 0) + 1)
    init.set(p.i, (init.get(p.i) ?? 0) + 1)
    sylTot += p.y; oTot += p.o
  }
  const sylMoy = sylTot / aimes.length
  const oMoy = oTot / aimes.length
  const n = aimes.length

  const affinite = (p: Prenom) => {
    let s = 0
    for (const o of p.g) s += 2.2 * ((orig.get(o) ?? 0) / n)
    s += 1.0 * ((init.get(p.i) ?? 0) / n)
    s += 1.4 * Math.max(0, 1 - Math.abs(p.y - sylMoy) / 2)
    s += 1.0 * Math.max(0, 1 - Math.abs(p.o - oMoy) / 40)
    s += 0.6 * Math.min(1, p.n / 3000)        // un peu de popularité, pas trop
    return s
  }
  return [...liste].sort((a, b) => affinite(b) - affinite(a))
}

/** Toutes les variantes d'une même famille (Jean-*, Mael/Maël/Maëlle…). */
export function famille(liste: Prenom[], p: Prenom): string[] {
  const racine = p.slug.slice(0, Math.max(4, Math.floor(p.slug.length * 0.7)))
  return liste.filter(x => x.slug.startsWith(racine)).map(x => x.l)
}

/**
 * « 51,6 pour 10 000 » ne parle a personne. « 1 sur 194 » se comprend d'un coup
 * d'oeil et se compare sans calcul. Une seule ecriture partout dans l'app.
 */
export function frequenceLisible(f: number): string {
  if (!f || f <= 0) return 'quasi jamais'
  const n = Math.round(10000 / f)
  return `1 sur ${n.toLocaleString('fr-FR')}`
}
