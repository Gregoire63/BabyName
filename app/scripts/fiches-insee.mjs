/**
 * Les fiches des prénoms qui n'ont pas de page statique.
 *
 * Tout prénom publié par l'INSEE doit avoir sa fiche. Mais en écrire une page
 * par prénom (près de 40 000 de plus) dépasserait la limite de fichiers d'un
 * déploiement Cloudflare, et pousserait des dizaines de milliers de pages
 * presque vides. Ces fiches-là sont donc rendues À LA DEMANDE par le Worker
 * (server/routes/prenom/[...chemin].get.ts), à partir de :
 *
 *   - un MODÈLE : une page statique ordinaire (même en-tête, même style, même
 *     pied), avec des jalons __NOM__, __CORPS__… Écrit dans server/assets :
 *     il part dans le Worker.
 *   - les DONNÉES, découpées par les deux premières lettres du prénom
 *     (/statique/fiche-ma.<empreinte>.txt) : le Worker ne lit que la tranche
 *     du prénom demandé, et la garde en mémoire.
 *   - un SOMMAIRE (server/assets/fiches/sommaire.json) : où sont les tranches.
 *
 * Une ligne par prénom : slug, libellé, sexe (f, m, fm), première année,
 * naissances par an divisées par 5 (arrondi INSEE), prénoms proches qui ont
 * une page (slug:Libellé, séparés par « ; »).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** « MARIE-LOU » → « Marie-Lou » (même règle que joli, recherche-client.js). */
export const joli = s => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())

function levenshtein(a, b) {
  if (a === b) return 0
  const v = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prec = v[0]; v[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = v[j]
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1))
      prec = t
    }
  }
  return v[b.length]
}

export function construireFichesInsee({ pages, slugDe, racine }) {
  const brut = resolve(racine, '../data/raw/prenoms_insee_2025_packed.csv')
  if (!existsSync(brut)) return { tranches: new Map(), total: 0, an1: 0 }

  // 1. Tous les prénoms INSEE, regroupés par slug (Maëlys et Maelys, filles
  //    et garçons : une seule fiche), séries alignées sur 1900.
  const AN0 = 1900
  let an1 = AN0
  const parSlug = new Map()
  const lignes = readFileSync(brut, 'utf8').split('\n')
  for (let i = 1; i < lignes.length; i++) {
    if (!lignes[i]) continue
    const [sexe, prenom, premier, vals] = lignes[i].split(';')
    const slug = slugDe(prenom)
    if (!slug || pages.has(slug)) continue
    const v = vals.split(',').map(Number)
    const debut = Number(premier) - AN0
    an1 = Math.max(an1, Number(premier) + v.length - 1)
    let e = parSlug.get(slug)
    if (!e) parSlug.set(slug, e = { slug, graphies: new Map(), f: 0, m: 0, serie: [] })
    let tot = 0
    v.forEach((x, k) => { if (x) { e.serie[debut + k] = (e.serie[debut + k] ?? 0) + x; tot += x } })
    if (sexe === '2') e.f += tot; else e.m += tot
    e.graphies.set(prenom, (e.graphies.get(prenom) ?? 0) + tot)
  }

  // 2. Les proches : des prénoms qui ONT une page, à l'écriture voisine
  //    (même début, distance d'édition), du même sexe quand on le sait.
  const tetes = [...pages.values()].map(e => e[0])
  const parPrefixe = new Map()
  for (const p of tetes) {
    for (const n of [3, 2]) {
      const k = p.slug.slice(0, n)
      const t = parPrefixe.get(k); t ? t.push(p) : parPrefixe.set(k, [p])
    }
  }
  const compatible = (sexe, p) => sexe === 'fm' || p.sexe === 'fm' || p.sexe === sexe
  function proches(slug, sexe) {
    const vus = new Set()
    const cands = []
    for (const n of [3, 2]) {
      for (const p of parPrefixe.get(slug.slice(0, n)) ?? []) {
        if (vus.has(p.slug) || !compatible(sexe, p)) continue
        vus.add(p.slug); cands.push(p)
      }
      if (cands.length >= 8) break
    }
    return cands
      .map(p => [levenshtein(slug, p.slug) - Math.log10(1 + p.n) / 4, p])
      .sort((a, b) => a[0] - b[0]).slice(0, 8).map(([, p]) => `${p.slug}:${p.l}`)
  }

  // 3. Les lignes, par tranche de deux lettres.
  const tranches = new Map()
  for (const e of parSlug.values()) {
    let d = 0
    while (d < e.serie.length && !e.serie[d]) d++
    if (d >= e.serie.length) continue
    const serie = Array.from({ length: e.serie.length - d }, (_, k) => e.serie[d + k] ?? 0)
    const total = e.f + e.m
    const sexe = e.f >= total * 0.9 ? 'f' : e.m >= total * 0.9 ? 'm' : 'fm'
    const libelle = joli([...e.graphies].sort((a, b) => b[1] - a[1])[0][0])
    const ligne = [e.slug, libelle, sexe, AN0 + d, serie.join(','), proches(e.slug, sexe).join(';')].join('\t')
    const k = e.slug.slice(0, 2)
    const t = tranches.get(k); t ? t.push(ligne) : tranches.set(k, [ligne])
  }
  return {
    tranches: new Map([...tranches].map(([k, t]) => [k, t.sort().join('\n')])),
    total: parSlug.size,
    an1
  }
}
