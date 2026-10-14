/**
 * Le fichier des prénoms de l'INSEE (data/raw/prenoms_insee_2025_packed.csv),
 * lu UNE fois par build : scripts/seo.mjs y prend l'histoire de chaque fiche
 * depuis 1900, scripts/fiches-insee.mjs les fiches que rend le Worker,
 * scripts/recherche.mjs l'INSEE complet de la recherche. Trois lectures du
 * même fichier, c'était trois façons de le comprendre.
 *
 * Une ligne par prénom et par sexe : sexe (1 garçons, 2 filles), prénom tel
 * que l'INSEE l'écrit (MAËLYS), première année, puis les naissances de
 * chaque année divisées par 5 (l'INSEE arrondit à 5).
 *
 * Absent (un dépôt sans data/raw) : null, et chaque script fait sans.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const AN0_INSEE = 1900
const lus = new Map()

export function lireInsee(racine) {
  const brut = resolve(racine, '../data/raw/prenoms_insee_2025_packed.csv')
  if (lus.has(brut)) return lus.get(brut)
  if (!existsSync(brut)) { lus.set(brut, null); return null }
  const lignes = []
  let an1 = AN0_INSEE
  const txt = readFileSync(brut, 'utf8').split('\n')
  for (let i = 1; i < txt.length; i++) {
    if (!txt[i]) continue
    const [sexe, prenom, premier, vals] = txt[i].split(';')
    const v = vals.split(',').map(x => Number(x) * 5)
    an1 = Math.max(an1, Number(premier) + v.length - 1)
    lignes.push({ sexe: sexe === '2' ? 'f' : 'm', prenom, premier: Number(premier), v })
  }
  // Toutes les naissances de chaque année, par sexe : le dénominateur d'une
  // part (« 1 fille sur 35 en 1963 »), comme pipeline/build_metrics.py le
  // calcule (sur ce même fichier, prénoms rares exclus par l'INSEE).
  const n = an1 - AN0_INSEE + 1
  const totaux = { f: new Array(n).fill(0), m: new Array(n).fill(0) }
  for (const l of lignes) l.v.forEach((x, k) => { if (x) totaux[l.sexe][l.premier - AN0_INSEE + k] += x })
  const r = { an0: AN0_INSEE, an1, lignes, totaux }
  lus.set(brut, r)
  return r
}
