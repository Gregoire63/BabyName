/**
 * La tendance des pages publiques et la projection « prénoms 2027 »
 * (scripts/tendance.mjs), sans navigateur ni serveur : le module que lisent
 * seo.mjs, seo-plus.mjs et seo-langues.mjs, sur le vrai catalogue.
 *
 * Jusqu'au 08/11/2026, les pages reprenaient la pente du catalogue, sur dix
 * ans : Alba, en baisse en 2025, y était « en forte hausse » et n°1 des
 * filles en 2027. Ce qui se vérifie ici :
 *  - un prénom qui retombe est dit en baisse, et la projection ne le met plus
 *    en tête (Alba : 2 660 bébés en 2024, 2 360 en 2025) ;
 *  - un petit prénom, ou un prénom absent une des dernières années, garde la
 *    pente sur dix ans : sur quelques bébés par an, quatre points sont du
 *    bruit ;
 *  - une envolée est bornée : +60 % par an ne fait pas plus que ±25 %, amortis ;
 *  - les naissances totales que le calcul retrouve sont celles de l'INSEE ;
 *  - rejouée sur le passé, la projection se trompe moins que l'ancienne
 *    (moyenne des trois ans, pente sur dix ans).
 * Les exemples nommés sont ceux du millésime 2025 : à revoir au suivant.
 *
 *   node essais/essai-projection.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  penteRecente, tendancePublique, projeter, totauxRecents, erreursPassees, SEUIL_RECENT, BORNE
} from '../scripts/tendance.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const d = JSON.parse(readFileSync(resolve(RACINE, 'public/data/catalogue.json'), 'utf8'))
const c = d.cols
const [, AN1] = d.serie_annees
const P = []
for (let k = 0; k < d.n; k++) P.push({ l: c.l[k], sexe: d.sexe[c.s[k]], n: c.n[k], t: c.t[k], sr: c.sr ? c.sr[k] : null })
const tete = nom => P.filter(p => p.l === nom).sort((a, b) => b.n - a.n)[0]

// 1. Un prénom qui retombe.
const alba = tete('Alba')
dit(alba && alba.t > 20 && tendancePublique(alba) < 0,
  `Alba, en baisse en ${AN1} : la pente sur dix ans la disait en hausse (${alba?.t} %/an), la page la dit en baisse (${alba ? tendancePublique(alba) : '?'} %/an)`)

const TOT = totauxRecents(P)
const projection = s => {
  const pool = P.filter(p => p.sexe === s && p.n >= 150 && Array.isArray(p.sr))
  return pool.map(p => ({ l: p.l, v: projeter(p.sr[p.sr.length - 1] * (TOT ? TOT[2] : 1) / 1e4, tendancePublique(p), 2027 - AN1) }))
    .sort((a, b) => b.v - a.v)
}
const filles = projection('f')
const rangAlba = filles.findIndex(x => x.l === 'Alba') + 1
dit(rangAlba > 3, `projection 2027 : Alba n'est plus n°1 des filles (${rangAlba}ᵉ ; n°1 : ${filles[0]?.l})`)

// 2. Quand la pente récente ne veut rien dire, celle du catalogue.
const petit = P.find(p => p.n >= 60 && p.n < SEUIL_RECENT && penteRecente(p.sr) !== null && penteRecente(p.sr) !== p.t)
dit(petit && tendancePublique(petit) === petit.t,
  `un petit prénom (${petit?.l}, ${petit?.n} bébés en trois ans) garde la pente sur dix ans`)
dit(penteRecente([5, 5, 0, 6, 7]) === null && tendancePublique({ n: 500, t: 12.3, sr: [5, 5, 0, 6, 7] }) === 12.3,
  'un prénom absent une des quatre dernières années garde la pente sur dix ans')
dit(penteRecente([10, 10, 10, 10]) === 0 && penteRecente([10, 20, 40, 80]) === 100,
  'la pente : 0 % pour une courbe plate, +100 % par an quand elle double chaque année')

// 3. Une envolée bornée et amortie.
const envolee = projeter(100, 60, 2)
dit(Math.abs(envolee - 100 * (1 + BORNE / 100) * (1 + 0.7 * BORNE / 100)) < 1e-9,
  `+60 %/an sur deux ans : ×${(envolee / 100).toFixed(3)}, pas ×2,56`)

// 4. Les naissances totales, comparées à celles du fichier de l'INSEE.
const brut = resolve(RACINE, '..', 'data', 'raw')
const fichier = existsSync(brut) && readdirSync(brut).filter(f => /^prenoms_insee_\d{4}_packed\.csv$/.test(f)).sort().pop()
if (fichier && TOT) {
  const tot = {}
  for (const l of readFileSync(resolve(brut, fichier), 'utf8').split(/\r?\n/).slice(1)) {
    if (!l) continue
    const [, , fy, v] = l.split(';')
    v.split(',').forEach((x, i) => { const y = +fy + i; tot[y] = (tot[y] || 0) + 5 * x })
  }
  const ecarts = [AN1 - 2, AN1 - 1, AN1].map((y, i) => Math.abs(TOT[i] / tot[y] - 1))
  dit(ecarts.every(e => e < 0.01),
    `naissances retrouvées à 1 % près de l'INSEE (${[AN1 - 2, AN1 - 1, AN1].map((y, i) => `${y} : ${Math.round(TOT[i])} pour ${tot[y]}`).join(' ; ')})`)
} else dit(Boolean(TOT), `naissances ${AN1 - 2}-${AN1} retrouvées (fichier INSEE absent : pas de comparaison)`)

// 5. Rejouée sur le passé, mieux que l'ancienne méthode.
const pente10 = sr => {
  const ys = sr.slice(-10).map(v => Math.log(v + 0.05)), mx = 4.5, my = ys.reduce((a, b) => a + b, 0) / 10
  let nu = 0, de = 0
  ys.forEach((y, x) => { nu += (x - mx) * (y - my); de += (x - mx) ** 2 })
  return (Math.exp(nu / de) - 1) * 100
}
const ancienne = (ps, horizon) => {
  const xs = ps.filter(p => Array.isArray(p.sr)), L = Math.min(...xs.map(p => p.sr.length)), m = []
  for (let k = 0; k < 5; k++) {
    const iC = L - 1 - k, iY = iC - horizon
    const vrais = xs.filter(p => p.sr[iY] > 0).sort((a, b) => b.sr[iC] - a.sr[iC]).slice(0, 50)
    const e = vrais.map(p => {
      const moy = (p.sr[iY] + p.sr[iY - 1] + p.sr[iY - 2]) / 3
      return Math.abs(projeter(moy, pente10(p.sr.slice(0, iY + 1)), horizon + 1) / p.sr[iC] - 1)
    }).sort((a, b) => a - b)
    m.push(e[Math.floor(e.length / 2)])
  }
  return m
}
const moyenne = xs => xs.reduce((a, b) => a + b, 0) / xs.length
for (const [s, nom] of [['f', 'filles'], ['m', 'garçons']]) {
  const ps = P.filter(p => p.sexe === s)
  const nouv = erreursPassees(ps, { horizon: 2027 - AN1 }), anc = ancienne(ps, 2027 - AN1)
  const pc = xs => xs.map(x => Math.round(x * 100)).join(', ')
  dit(nouv.length === 5 && moyenne(nouv) < moyenne(anc),
    `${nom}, rejoué sur cinq millésimes : écart médian ${pc(nouv)} %, contre ${pc(anc)} % avec l'ancienne méthode`)
}

console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
