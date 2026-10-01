import { tempetesDuGroupe, type Tempete } from '~/utils/tempetes'

/**
 * Catalogue embarqué : 19 608 prénoms — tout ce que l'INSEE publie sur
 * 2023-2025 — 435 Ko gzip, chargé une fois puis gardé en mémoire. Tout le
 * filtrage et tout le tri se font ici, côté client : un changement de filtre
 * ne doit jamais coûter un aller-retour réseau.
 *
 * 11 941 d'entre eux portent `q` (rare) : moins de 20 naissances sur 3 ans.
 * L'INSEE arrondissant à 5, leur pente et leur risque ne sont que du bruit
 * d'arrondi, et 12 000 cartes de plus noieraient le swipe. Ils sont donc
 * exclus de la pile par `filtrer()` tant que `inclure_rares` est faux — mais
 * ils restent dans le catalogue, donc trouvables par la recherche.
 */
export interface Prenom {
  l: string; slug: string; sexe: 'f' | 'm' | 'fm'
  /** Groupe de prononciation : Elyo, Élio et Hélio partagent le même. */
  gp: number
  /** Les AUTRES graphies du groupe, la plus fréquente en tête. Rempli au
   *  chargement, sur chaque membre : la fiche d'une graphie minoritaire doit
   *  pouvoir nommer les autres, pas seulement celle qui porte la carte. */
  variantes?: string[]
  /**
   * Fréquence du GROUPE entier, toutes graphies confondues (‰₀ comme `f`).
   *
   * Une classe n'entend pas l'orthographe. Trois Elyo, Élio et Hélio, ce sont
   * trois enfants qui se retournent quand la maîtresse appelle. C'est ce
   * chiffre-là qui dit ce qui va se passer dans la cour, pas `f`.
   * Rempli au chargement, sur CHAQUE membre du groupe.
   */
  fgp: number
  /** Nombre de graphies dans le groupe (1 = le prénom est seul). */
  ngp: number
  /** Tendance du groupe : moyenne des `t` pondérée par `f`. */
  tgp: number
  u: number; f: number; n: number; t: number; p: number
  o: number; r: number; rv: boolean; q: boolean
  c: number; y: number; k: boolean; i: string; e: string
  g: string[]; m: string | null; me: string | null
  /** Confiance dans le sens : 0 basse, 1 moyenne, 2 haute, null si aucun sens. */
  cf: number | null
  ob: boolean; obn: string | null; dm: string[]
  /** Courbe 1986-2025 (pour 10 000 naissances), quand elle veut dire quelque chose. */
  sr: number[] | null
  /**
   * Sans courbe, mais assez donné pour la pile : les naissances elles-mêmes,
   * année par année (`barres` du catalogue, 2011-2025), arrondies à 5 comme
   * l'INSEE les publie. Elïa : 5, 5, 0, 15, 5, 15, 20, 15, 15.
   */
  nb: number[] | null
  /**
   * Les tempêtes qui ont porté ce prénom — ou un prénom qui se dit pareil
   * (Eléanore et la tempête Eleanor). Rempli au chargement sur tout le
   * groupe de prononciation ; absent pour presque tous. Voir utils/tempetes.
   */
  tp?: Tempete[]
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
  inclure_rares: boolean
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
  revival_seulement: false, inclure_rares: false, recherche: ''
})

/**
 * Le catalogue est livré pré-compressé, et c'est là qu'est le piège : selon le
 * serveur, `/data/catalogue.json.gz` arrive soit tel quel, soit déjà décompressé
 * par le navigateur parce que le serveur a ajouté `Content-Encoding: gzip`
 * (c'est ce que fait le serveur de dev). Décompresser à l'aveugle échouait
 * silencieusement dans ce deuxième cas et on retombait sur le .json — 2,9 Mo au
 * lieu de 435 Ko, sans que rien ne le signale.
 *
 * On regarde donc les deux premiers octets : 1f 8b, c'est du gzip, on
 * décompresse ; sinon c'est déjà du texte, on le lit tel quel.
 */
async function chargerJson(): Promise<any> {
  try {
    const r = await fetch('/data/catalogue.json.gz')
    if (r.ok) {
      const brut = new Uint8Array(await r.arrayBuffer())
      const gzip = brut[0] === 0x1f && brut[1] === 0x8b
      if (!gzip) return JSON.parse(new TextDecoder().decode(brut))
      if (typeof DecompressionStream !== 'undefined') {
        const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('gzip'))
        return JSON.parse(await new Response(flux).text())
      }
    }
  } catch { /* on tente le repli */ }
  return $fetch('/data/catalogue.json')
}

let cache: { liste: Prenom[]; origines: string[]; annees: [number, number]
              barres: [number, number] } | null = null

/**
 * Au-dessous de ce nombre de naissances en trois ans (une vingtaine par an),
 * la pente n'est que le bruit de l'arrondi à 5 de l'INSEE : Elïa passait de
 * 5 à 15 bébés par an et la carte annonçait « +14 % par an ». On donne alors
 * le nombre de bébés, pas un pourcentage. Le seuil vient du catalogue
 * (pipeline/export_catalogue.py) : un seul endroit pour le changer.
 */
let seuilTendance = 60
export const tendanceFiable = (p: Pick<Prenom, 'n'>) => p.n >= seuilTendance
/** « +14 % », « −3 % », et « 0 % » plutôt que « -0 % » pour une pente de -0,3. */
export function pourcentAn(t: number): string {
  const r = Math.round(t)
  return r > 0 ? `+${r} %` : r < 0 ? `−${-r} %` : '0 %'
}
/** Bébés par an, en moyenne sur les trois dernières années publiées. */
export const bebesParAn = (p: Pick<Prenom, 'n'>) => Math.max(1, Math.round(p.n / 3))
/** Premières et dernières années des barres (`nb`). */
export const anneesBarres = (): [number, number] => cache?.barres ?? [2011, 2025]
let enCours: Promise<typeof cache> | null = null

export const sansAccent = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Retrouve un pr\u00e9nom \u00e9crit dans une adresse : `?prenom=louise`,
 * `jean-baptiste`, `Chlo\u00e9`\u2026
 *
 * Les fiches publiques (scripts/seo.mjs) \u00e9crivent leur slug avec des tirets,
 * le catalogue colle tout. On cherche d'abord l'\u00e9criture exacte de la fiche,
 * puis la forme coll\u00e9e : \u00ab jean-baptiste \u00bb doit donner Jean-Baptiste, pas un
 * Jeanbaptiste plus rare. \u00c0 \u00e9criture \u00e9gale (Ma\u00ebl et Mael font \u00ab mael \u00bb), le
 * plus donn\u00e9 gagne \u2014 c'est aussi lui que la fiche pr\u00e9sente.
 */
export function trouverPrenom(liste: Prenom[], brut: string): Prenom | null {
  const s = sansAccent(String(brut ?? '').trim())
  const colle = s.replace(/[^a-z]/g, '')
  if (!colle) return null
  const tirets = s.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
  let exact: Prenom | null = null
  let proche: Prenom | null = null
  for (const p of liste) {
    if (p.slug !== colle) continue
    if (!proche || p.n > proche.n) proche = p
    const t = sansAccent(p.l).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
    if (t === tirets && (!exact || p.n > exact.n)) exact = p
  }
  return exact ?? proche
}

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
        gp: c.gp ? c.gp[k] : k, fgp: 0, ngp: 1, tgp: 0,
        sexe: d.sexe[c.s[k]], u: c.u[k], f: c.f[k], n: c.n[k], t: c.t[k], p: c.p[k],
        o: c.o[k], r: c.r[k], rv: !!c.rv[k], q: !!(c.q && c.q[k]),
        c: c.c[k], y: c.y[k], k: !!c.k[k], i: c.i[k], e: c.e[k],
        g: c.g[k].map((x: number) => d.origines[x]),
        m: c.m[k], me: c.me[k], cf: c.cf ? c.cf[k] ?? null : null,
        ob: !!c.ob[k], obn: c.obn[k], dm: c.dm[k],
        sr: c.sr ? c.sr[k] : null,
        // l'INSEE publie par multiples de 5 : le catalogue les stocke divisés
        nb: c.nb?.[k] ? c.nb[k].map((x: number) => x * 5) : null
      }
    }
    // Le catalogue est trie par frequence : le premier de chaque groupe est
    // donc la graphie la plus repandue, c'est elle qui portera la carte, et
    // `variantes` sort dans le meme ordre. On calcule au passage ce que la
    // classe ENTEND (fgp) plutot que ce qu'elle ecrit (f).
    const groupes = new Map<number, Prenom[]>()
    for (const p of liste) {
      const g = groupes.get(p.gp)
      if (g) g.push(p); else groupes.set(p.gp, [p])
    }
    for (const membres of groupes.values()) {
      let f = 0, ft = 0
      for (const m of membres) { f += m.f; ft += m.f * m.t }
      const fgp = Math.round(f * 100) / 100
      // Une graphie confidentielle qui explose ne doit pas tirer tout le
      // groupe : la tendance se pondere par le poids reel de chaque graphie.
      const tgp = f > 0 ? Math.round((ft / f) * 10) / 10 : membres[0]!.t
      // Une tempête s'entend sur tout le groupe : Ugo se dit comme Hugo.
      const tp = tempetesDuGroupe(membres.map(m => m.l))
      for (const m of membres) {
        m.fgp = fgp; m.ngp = membres.length; m.tgp = tgp
        if (membres.length > 1) m.variantes = membres.filter(x => x !== m).map(x => x.l)
        if (tp) m.tp = tp
      }
    }
    if (typeof d.seuil_tendance === 'number') seuilTendance = d.seuil_tendance
    cache = { liste, origines: d.origines, annees: d.serie_annees ?? [1986, 2025],
              barres: d.barres_annees ?? [2011, 2025] }
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
    if (p.q && !f.inclure_rares) return false
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
