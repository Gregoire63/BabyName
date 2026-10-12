/**
 * La courbe des naissances d'un prénom (pour 10 000 bébés, une valeur par
 * année), partagée par les fiches françaises (scripts/seo.mjs) et anglaises
 * (scripts/seo-langues.mjs) : un seul dessin, seuls les libellés changent.
 *
 * Un viewBox de 400 de large, pour que le texte y reste lisible sur un
 * téléphone (à 640, les années tombaient à 7 px). Classes pour l'animation
 * (le CSS du gabarit) : `trait` (tracé, pathLength 1), `aire`, `pic`.
 *
 *   sr     la série, de an0 à an1
 *   aria   le libellé accessible, DÉJÀ échappé
 *   pic    (max, année) -> l'étiquette du point le plus haut, déjà échappée
 */
export function dessinerCourbe(sr, { an0, an1, aria, pic }) {
  if (!sr || !sr.some(v => v > 0)) return ''
  const W = 400, H = 200, G = 8, D = 8, B = 26, T = 34
  const max = Math.max(...sr)
  const x = i => G + (i / (sr.length - 1)) * (W - G - D)
  const y = v => T + (1 - v / max) * (H - T - B)
  const pts = sr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const iMax = sr.indexOf(max)
  const graduations = [an0, 2000, 2010, an1].filter(a => a >= an0 && a <= an1)
  return `<svg class="courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<path class="aire" d="M${x(0).toFixed(1)},${H - B} L${pts.join(' L')} L${x(sr.length - 1).toFixed(1)},${H - B} Z"/>
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--texte);stroke-opacity:.3" stroke-width="1.5"/>
<polyline class="trait" pathLength="1" points="${pts.join(' ')}" fill="none" style="stroke:var(--texte)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
${graduations.map((a, i) => `<text x="${x(a - an0).toFixed(1)}" y="${H - 6}" font-size="13" font-weight="800" style="fill:var(--texte)" text-anchor="${i === 0 ? 'start' : i === graduations.length - 1 ? 'end' : 'middle'}">${a}</text>`).join('')}
<circle class="pic" cx="${x(iMax).toFixed(1)}" cy="${y(max).toFixed(1)}" r="5" style="fill:var(--texte);stroke:var(--champ);stroke-width:3"/>
<text class="etiquette-pic" x="${Math.min(Math.max(x(iMax), 78), W - 78).toFixed(1)}" y="${Math.max(y(max) - 13, 15).toFixed(1)}" font-size="13" font-weight="800" style="fill:var(--texte)" text-anchor="middle">${pic(max, an0 + iMax)}</text>
</svg>`
}
