/**
 * La tendance que montrent les pages publiques (fiches, listes, projection
 * 2027), dans scripts/seo.mjs, seo-plus.mjs et seo-langues.mjs.
 *
 * Le catalogue porte la pente du pipeline (c.t) : l'évolution moyenne par an
 * sur DIX ans (pipeline/build_metrics.py, TREND_WINDOW). L'app s'en sert
 * telle quelle. Mais dix ans ratent les retournements : Alba, en baisse en
 * 2025 (2 660 bébés en 2024, 2 360 en 2025), gardait +52 % par an, hérités de
 * son envolée de 2018 à 2023, et la page « prénoms 2027 » en faisait le n°1
 * des filles. Testée sur les millésimes passés, cette projection se trompait
 * plus que « le même chiffre que l'année d'avant » ; elle avait déjà annoncé
 * Alba n°1 pour 2024 et pour 2025 (c'était Louise). Corrigé le 08/11/2026.
 *
 * Ici : la pente sur les FENETRE dernières années de la courbe (c.sr, bébés
 * pour 10 000 naissances, au dixième près), dès que le prénom est assez donné
 * pour que cet arrondi ne pèse pas (SEUIL_RECENT naissances en trois ans) et
 * qu'il a été donné chacune de ces années. Sinon, la pente sur dix ans : sur
 * vingt bébés par an, quatre points ne sont que du bruit.
 */
export const FENETRE = 4
export const SEUIL_RECENT = 150
/** La projection : bornée à ±BORNE % par an, amortie de AMORTI chaque année
 *  (une envolée ralentit presque toujours). */
export const BORNE = 25
export const AMORTI = 0.7

/** % par an, au dixième : moindres carrés sur le logarithme des FENETRE
 *  dernières valeurs de la courbe. null s'il en manque une, ou si le prénom
 *  n'a pas été donné l'une de ces années. */
export function penteRecente(sr, fenetre = FENETRE) {
  if (!Array.isArray(sr) || sr.length < fenetre) return null
  const ys = sr.slice(-fenetre)
  if (ys.some(v => !(v > 0))) return null
  const lg = ys.map(Math.log)
  const mx = (fenetre - 1) / 2, my = lg.reduce((a, b) => a + b, 0) / fenetre
  let nu = 0, de = 0
  lg.forEach((y, x) => { nu += (x - mx) * (y - my); de += (x - mx) ** 2 })
  const r = Math.round((Math.exp(nu / de) - 1) * 1000) / 10
  return r === 0 ? 0 : r
}

/** La tendance à montrer pour un prénom { n, t, sr } (n : naissances sur trois
 *  ans ; t : la pente sur dix ans du catalogue ; sr : la courbe). */
export function tendancePublique(p) {
  const r = p.n >= SEUIL_RECENT ? penteRecente(p.sr) : null
  return r ?? p.t
}

/** Naissances projetées dans `ans` années : `base`, prolongée de la pente `t`
 *  (% par an) bornée à ±BORNE, et amortie de AMORTI d'année en année. */
export function projeter(base, t, ans) {
  const r = Math.max(-BORNE, Math.min(BORNE, t || 0)) / 100
  let v = base
  for (let i = 0; i < ans; i++) v *= 1 + r * Math.pow(AMORTI, i)
  return v
}

/**
 * Les naissances totales des trois dernières années, [T-2, T-1, T] : la courbe
 * (pour 10 000 naissances) et le nombre de naissances sur trois ans (n) les
 * donnent ensemble, n ≈ Σ sr·T / 10 000. Moindres carrés sur les prénoms assez
 * donnés pour que l'arrondi de la courbe ne pèse pas. null si le calcul ne
 * tient pas (une année aberrante) : l'appelant se rabat sur la moyenne.
 */
export function totauxRecents(ps) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0]
  let vus = 0
  for (const p of ps) {
    if (!(p.n >= 1000) || !Array.isArray(p.sr) || p.sr.length < 3) continue
    const x = p.sr.slice(-3).map(v => v / 1e4)
    for (let i = 0; i < 3; i++) {
      b[i] += x[i] * p.n
      for (let j = 0; j < 3; j++) A[i][j] += x[i] * x[j]
    }
    vus++
  }
  if (vus < 30) return null
  // Élimination de Gauss, pivot partiel.
  const M = A.map((l, i) => [...l, b[i]])
  for (let c = 0; c < 3; c++) {
    let piv = c
    for (let l = c + 1; l < 3; l++) if (Math.abs(M[l][c]) > Math.abs(M[piv][c])) piv = l
    ;[M[c], M[piv]] = [M[piv], M[c]]
    if (!M[c][c]) return null
    for (let l = 0; l < 3; l++) {
      if (l === c) continue
      const f = M[l][c] / M[c][c]
      for (let k = c; k < 4; k++) M[l][k] -= f * M[c][k]
    }
  }
  const T = M.map((l, i) => l[3] / l[i])
  const moy = (T[0] + T[1] + T[2]) / 3
  return T.every(t => t > 0 && Math.abs(t / moy - 1) < 0.15) ? T : null
}

/**
 * La projection rejouée sur le passé : pour chacune des `ans` dernières
 * années publiées, on se place `horizon` ans plus tôt, on projette avec les
 * seules données d'alors, et on compare au top `top` réel. Rend l'erreur
 * médiane de chaque année, la plus récente d'abord. En part des naissances
 * (la courbe), pour ne pas compter la baisse de la natalité comme une erreur.
 * `ps` : les prénoms d'un même sexe, { sr } se terminant à la même année.
 */
export function erreursPassees(ps, { horizon, ans = 5, top = 50 }) {
  const xs = ps.filter(p => Array.isArray(p.sr) && p.sr.length)
  if (!xs.length) return []
  const L = Math.min(...xs.map(p => p.sr.length))
  const medianes = []
  for (let k = 0; k < ans; k++) {
    const iC = L - 1 - k, iY = iC - horizon
    if (iY < FENETRE) break
    const vrais = xs.filter(p => p.sr[iY] > 0).sort((a, b) => b.sr[iC] - a.sr[iC]).slice(0, top)
    const err = vrais.map(p => Math.abs(projeter(p.sr[iY], penteRecente(p.sr.slice(0, iY + 1)) ?? 0, horizon) / p.sr[iC] - 1))
      .sort((a, b) => a - b)
    if (err.length) medianes.push(err[Math.floor(err.length / 2)])
  }
  return medianes
}
