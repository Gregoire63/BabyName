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
  /**
   * Le même prénom au Québec, en Belgique et en Suisse, dans l'ordre de
   * `sourcesFrancophonie()` : null si aucun des trois ne le publie, sinon
   * une case par pays, null quand il y est absent ou sous le seuil.
   */
  fx: (ChiffreFx | null)[] | null
  /**
   * Donné au Québec, en Belgique ou en Suisse, mais pas en France sur
   * 2023-2025 : ses chiffres français sont nuls (n = 0, originalité 100) et
   * c'est `fx` qui dit où il vit. Peut avoir été donné ici avant (courbe).
   */
  hf: boolean
  /** Chiffres par pays chargé (usePays) : code -> naissances, rang, tendance. */
  px?: Record<string, ChiffreFx>
  /** Pour les pays choisis par la liste (usePays.appliquerPays) : naissances
   *  cumulées, rareté, fréquence (‰₀), originalité et tendance communes. */
  nsel?: number; qsel?: boolean; fsel?: number; osel?: number; tsel?: number | null
  /**
   * Poids pour l'ordre de la pile, à l'échelle des naissances françaises
   * sur 3 ans : `n` pour un prénom donné ici ; pour un prénom d'ailleurs, sa
   * part des naissances dans le pays où il est le plus donné, ramenée à la
   * France puis divisée par deux — il entre dans la pile, sans passer devant
   * ce qu'on entend tous les jours dans les cours d'école d'ici.
   */
  poids: number
}

/** Un prénom dans un pays : naissances 2023-2025, rang, tendance %/an. */
export interface ChiffreFx { n: number; rang: number | null; t: number | null }

/** D'où vient chaque chiffre « ailleurs » : ce que montre le badge. */
export interface SourceFx {
  id: 'qc' | 'be' | 'ch'; pays: string; organisme: string; jeu: string
  licence: string; url: string; annees: [number, number]
  /** false : l'effectif publié compte filles et garçons ensemble (Québec). */
  par_sexe: boolean; note: string
  /** Naissances de la fenêtre : un nombre, ou par sexe. */
  total: number | { f: number; m: number }
}

let sourcesFx: SourceFx[] = []
/** Les sources des chiffres « ailleurs en francophonie », une fois le catalogue chargé. */
export const sourcesFrancophonie = () => sourcesFx

/**
 * Le pays où ce prénom pèse le plus (Québec, Belgique, Suisse), en une
 * ligne : « 1 garçon sur 380 ». Null s'il n'est donné dans aucun des trois.
 * C'est ce que montre la carte d'un prénom d'ailleurs, à la place des
 * chiffres français qu'il n'a pas.
 */
export function meilleurAilleurs(p: Pick<Prenom, 'fx' | 'sexe'>):
  { pays: string; sur: string; n: number; rang: number | null; source: SourceFx } | null {
  if (!p.fx) return null
  let mieux: { part: number; i: number; tot: number } | null = null
  sourcesFx.forEach((s, i) => {
    const v = p.fx![i]
    if (!v) return
    const tot = typeof s.total === 'number' ? s.total
      : p.sexe === 'f' || p.sexe === 'm' ? s.total[p.sexe] : s.total.f + s.total.m
    const part = v.n / tot
    if (!mieux || part > mieux.part) mieux = { part, i, tot }
  })
  if (!mieux) return null
  const { i, tot } = mieux as { part: number; i: number; tot: number }
  const s = sourcesFx[i]!, v = p.fx[i]!
  const qui = !s.par_sexe ? 'bébé' : p.sexe === 'f' ? 'fille' : p.sexe === 'm' ? 'garçon' : 'bébé'
  return { pays: s.pays, sur: `1 ${qui} sur ${Math.round(tot / v.n).toLocaleString('fr-FR')}`,
           n: v.n, rang: v.rang, source: s }
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
  /** Les prénoms donnés au Québec, en Belgique ou en Suisse mais pas en France
   *  (avant le choix des pays ; ignoré quand `pays` est renseigné). */
  inclure_ailleurs: boolean
  /** Pays de référence (usePays) : la pile et les chiffres de la carte. */
  pays: string[]
  recherche: string
}

/** La France par défaut : on ajoute les autres pays à la création de la liste. */
export const PAYS_DEFAUT = ['fr'] as const

export const filtresParDefaut = (): Filtres => ({
  sexe: ['f', 'm', 'fm'],
  origines_in: [], origines_out: [],
  car: [2, 14], syllabes: [1, 6],
  compose: null,
  originalite: [0, 100], risque_max: 100,
  sens_requis: false, exclure_objet: false,
  initiales_out: [], finales_out: [],
  revival_seulement: false, inclure_rares: false, inclure_ailleurs: true, pays: [...PAYS_DEFAUT], recherche: ''
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
export async function chargerJson(chemin = '/data/catalogue.json'): Promise<any> {
  try {
    const r = await fetch(`${chemin}.gz`)
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
  return $fetch(chemin)
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
export const seuilDeTendance = () => seuilTendance
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
        nb: c.nb?.[k] ? c.nb[k].map((x: number) => x * 5) : null,
        fx: c.fx?.[k] ? c.fx[k].map((v: any) => v ? { n: v[0], rang: v[1], t: v[2] } : null) : null,
        hf: !!c.hf?.[k], poids: c.n[k]
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
    // LE CATALOGUE N'EST PAS RÉACTIF, et il ne doit jamais le devenir.
    //
    // 19 608 fiches qui ne changent plus une fois chargées. Posées dans un
    // `ref`, Vue les enveloppait une à une : chaque `p.sexe`, chaque `p.y` lu
    // par un filtre ou un tri passait par un intermédiaire qui note qui lit
    // quoi. Refaire la pile après un vote coûtait ainsi un quart de seconde
    // sur un ordinateur, près d'une seconde processeur ralenti quatre fois
    // (un téléphone moyen) — à CHAQUE geste —, et 35 Mo de mémoire. `markRaw`
    // dit à Vue de les laisser telles quelles, où qu'on les range ensuite
    // (une fiche ouverte, une épingle, la tête de pile).
    for (const p of liste) markRaw(p)
    if (typeof d.seuil_tendance === 'number') seuilTendance = d.seuil_tendance
    if (Array.isArray(d.fx_sources)) sourcesFx = d.fx_sources
    // Le poids d'un prénom d'ailleurs, à l'échelle française (voir `poids`).
    const naissancesFrance = liste.reduce((t, p) => t + p.n, 0)
    for (const p of liste) {
      if (!p.hf || !p.fx) continue
      let part = 0
      sourcesFx.forEach((s, i) => {
        const v = p.fx![i]
        // part de TOUTES les naissances du pays (la France compte les deux sexes)
        const tot = typeof s.total === 'number' ? s.total : s.total.f + s.total.m
        if (v && tot) part = Math.max(part, v.n / tot)
      })
      p.poids = Math.round(part * naissancesFrance / 2)
    }
    cache = { liste: markRaw(liste), origines: d.origines, annees: d.serie_annees ?? [1986, 2025],
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
  // Les réglages se lisent UNE fois, avant la boucle : `f` est réactif, et le
  // relire champ par champ pour chacun des 19 608 prénoms coûtait plus cher
  // que le filtre lui-même.
  const rares = f.inclure_rares, compose = f.compose, risque = f.risque_max
  const ailleurs = f.inclure_ailleurs !== false
  // Pays choisis (usePays.appliquerPays) : la pile, ce sont les prénoms donnés
  // dans l'un d'eux, et la rareté comme l'originalité se mesurent sur eux.
  // France seule : les chiffres INSEE, et les prénoms d'ailleurs francophones
  // selon `inclure_ailleurs`, comme avant le choix des pays.
  const parPays = (f.pays?.length ?? 0) > 0 && !(f.pays.length === 1 && f.pays[0] === 'fr')
  const carMin = f.car[0], carMax = f.car[1]
  const sylMin = f.syllabes[0], sylMax = f.syllabes[1]
  const oMin = f.originalite[0], oMax = f.originalite[1]
  const sens = f.sens_requis, objet = f.exclure_objet, revival = f.revival_seulement

  return liste.filter(p => {
    if (parPays && p.nsel !== undefined) {
      if (p.nsel === 0) return false
      if (p.qsel && !rares) return false
    } else {
      if (p.q && !rares) return false
      if (p.hf && !ailleurs) return false
    }
    if (!sexes.has(p.sexe)) return false
    if (p.c < carMin || p.c > carMax) return false
    if (p.y < sylMin || p.y > sylMax) return false
    if (compose !== null && p.k !== compose) return false
    const o = parPays && p.osel !== undefined ? p.osel : p.o
    if (o < oMin || o > oMax) return false
    if (p.r > risque) return false
    if (sens && !p.m) return false
    if (objet && p.ob) return false
    if (iout.size && iout.has(p.i)) return false
    if (eout.size && eout.has(sansAccent(p.e))) return false
    if (revival && !p.rv) return false
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
 *
 * `noteur` rend la note d'un prénom pour ces oui-là ; l'ordre est celui des
 * notes, de la plus haute à la plus basse, et à note égale celui de la liste
 * (le catalogue : du plus donné au moins donné).
 */
function noteur(aimes: Prenom[]): (p: Prenom) => number {
  if (aimes.length < 3) return p => p.poids

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

  return (p: Prenom) => {
    let s = 0
    for (const o of p.g) s += 2.2 * ((orig.get(o) ?? 0) / n)
    s += 1.0 * ((init.get(p.i) ?? 0) / n)
    s += 1.4 * Math.max(0, 1 - Math.abs(p.y - sylMoy) / 2)
    s += 1.0 * Math.max(0, 1 - Math.abs(p.o - oMoy) / 40)
    s += 0.6 * Math.min(1, p.poids / 3000)    // un peu de popularité, pas trop
    return s
  }
}

/** Toute la pile, dans l'ordre. */
export function ordonner(liste: Prenom[], aimes: Prenom[]): Prenom[] {
  // Une note par prénom, calculée UNE fois, puis le tri sur les notes : la
  // calculer dans la comparaison la refaisait deux fois par comparaison.
  const note = noteur(aimes)
  const notes = liste.map((p, i) => ({ i, s: note(p) }))
  notes.sort((a, b) => b.s - a.s)
  return notes.map(x => liste[x.i]!)
}

/**
 * Les `k` premiers de cet ordre — exactement `ordonner(liste, aimes).slice(0, k)`
 * — sans ranger toute la pile.
 *
 * Le tri ne montre que deux cartes à la fois. Ranger 7 500 prénoms après
 * chaque vote pour n'en lire que la tête était du travail perdu ; un seul
 * passage qui retient les meilleurs suffit.
 */
export function premiers(liste: Prenom[], aimes: Prenom[], k: number): Prenom[] {
  const note = noteur(aimes)
  const tete: { p: Prenom; s: number }[] = []
  for (const p of liste) {
    const s = note(p)
    // À note égale, celui qui était déjà là reste devant (ordre de la liste).
    if (tete.length === k && s <= tete[k - 1]!.s) continue
    let j = tete.length
    while (j > 0 && tete[j - 1]!.s < s) j--
    tete.splice(j, 0, { p, s })
    if (tete.length > k) tete.pop()
  }
  return tete.map(x => x.p)
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
