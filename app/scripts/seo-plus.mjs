#!/usr/bin/env node
/**
 * Pages SEO « plus » : ce que seo.mjs ne fait pas encore, genere APRES lui
 * (npm run build : seo.mjs puis seo-plus.mjs), dans le meme dossier.
 *
 *   - Un OUTIL : « tester un prenom avec son nom de famille ». La requete est
 *     tapee par tous les couples, la premiere page Google n'y oppose que des
 *     petits sites, et c'est la fonction phare de l'app en version d'essai.
 *     Le test est CELUI de l'app (useNomComplet.ts, compile ici par esbuild) :
 *     la page ne peut pas dire autre chose que l'app.
 *   - Des LISTES tirees des chiffres, la ou la concurrence (blogs de marques
 *     de puericulture) publie des selections au gout du jour : prenoms 2027
 *     (projection), courts, mixtes, composes, par terminaison.
 *   - Une page CADEAU (idee cadeau futurs parents -> /offrir).
 *
 * Pourquoi un second script : seo.mjs etait en cours de refonte ailleurs.
 * Celui-ci reprend le gabarit des pages que seo.mjs vient d'ecrire (en-tete,
 * styles, pied de page) et n'en change que le contenu : une seule charte, et
 * aucune copie du gabarit a maintenir. S'il ne retrouve pas un repere du
 * gabarit, il s'arrete : le build casse avant de publier une page bancale.
 *
 * Il complete aussi ce que seo.mjs a produit : liens vers les nouvelles pages
 * (pied de page de toutes les pages, portail /prenoms/), sitemap, llms.txt,
 * et les empreintes lues par scripts/indexnow.mjs.
 *
 * A fondre dans seo.mjs quand ce sera possible.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(RACINE, 'public')
const SORTIE = process.env.SEO_SORTIE ? resolve(process.env.SEO_SORTIE) : PUBLIC
const SITE = (process.env.NUXT_PUBLIC_SITE_URL || 'https://babynamed.fr').replace(/\/$/, '')
const MARQUE = 'babyNamed'
const PRIX = (process.env.NUXT_PUBLIC_PRIX_LISTE || '6 €').trim()
const MAJ = '2026-09-28'
const OUTIL = '/tester-prenom-nom-de-famille/'
const CADEAU = '/idee-cadeau-futurs-parents/'

// ---------------------------------------------------------------- données
const d = JSON.parse(readFileSync(resolve(PUBLIC, 'data/catalogue.json'), 'utf8'))
const c = d.cols
const [, AN1] = d.serie_annees ?? [1986, 2025]
const SEUIL_TENDANCE = d.seuil_tendance ?? 60
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const slugDe = s => sansAccent(s).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
const ORIGINE_LIB = o => o === 'moderne-inventé' ? 'moderne' : o

// Une entree par fiche que seo.mjs a ecrite : la graphie la plus donnee.
const tetes = new Map()
for (let k = 0; k < d.n; k++) {
  const p = {
    l: c.l[k], slug: slugDe(c.l[k]), sexe: d.sexe[c.s[k]], n: c.n[k], t: c.t[k],
    m: c.m[k], g: c.g[k].map(x => d.origines[x]), q: !!(c.q && c.q[k])
  }
  if (!p.slug || !existsSync(resolve(SORTIE, 'prenom', p.slug, 'index.html'))) continue
  const e = tetes.get(p.slug)
  if (!e || e.n < p.n) tetes.set(p.slug, p)
}
const T = [...tetes.values()]
const aSens = p => !!p.m || p.g.length > 0
const sexeOk = (p, s) => p.sexe === s || p.sexe === 'fm'
const url = p => `/prenom/${p.slug}/`

// ---------------------------------------------------------------- mise en forme
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const nf = x => Math.round(x).toLocaleString('fr-FR')
const dec = (x, n = 1) => x.toLocaleString('fr-FR', { maximumFractionDigits: n, minimumFractionDigits: 0 })
const h1 = t => `<h1${t.length > 20 ? ' class="long"' : ''}>${esc(t)}</h1>`

// ---------------------------------------------------------------- gabarit
const MODELE_CHEMIN = resolve(SORTIE, 'prenoms/tendance/filles/index.html')
if (!existsSync(MODELE_CHEMIN)) throw new Error('[seo-plus] lancer scripts/seo.mjs avant : pas de page modele')
const MODELE = readFileSync(MODELE_CHEMIN, 'utf8')

function remplacer(h, motif, par, quoi) {
  if (!motif.test(h)) throw new Error(`[seo-plus] repere introuvable dans le gabarit : ${quoi}`)
  return h.replace(motif, () => par)
}

function page({ chemin, titre, description, fil, corps, jsonld = [], style = '', script = '' }) {
  // script : l'ADRESSE d'un fichier. Les pages statiques n'executent aucun
  // script en ligne (politique de contenu, server/entetes-securite.ts).
  const canon = SITE + chemin
  const bc = [{ n: 'Prénoms', u: '/prenoms/' }, ...fil]
  const ld = [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: bc.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.n, item: SITE + x.u }))
  }, ...jsonld]
  let h = MODELE
  h = remplacer(h, /<title>[\s\S]*?<\/title>/, `<title>${esc(titre)}</title>`, 'title')
  h = remplacer(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`, 'description')
  h = remplacer(h, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canon}">`, 'canonical')
  h = remplacer(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titre)}">`, 'og:title')
  h = remplacer(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`, 'og:description')
  h = remplacer(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canon}">`, 'og:url')
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '')
  h = remplacer(h, /<\/head>/, ld.map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n')
    + (style ? `\n<style>${style}</style>` : '') + '\n</head>', '</head>')
  h = h.replace(/ aria-current="page"/g, '')
  const ariane = `<nav class="fil" aria-label="Fil d'Ariane">${bc.map((x, i) =>
    i < bc.length - 1 ? `<a href="${x.u}">${esc(x.n)}</a>` : esc(x.n)).join(' › ')}</nav>`
  h = remplacer(h, /<main class="l" id="contenu">[\s\S]*<\/main>/,
    `<main class="l" id="contenu">\n${ariane}\n${corps}\n</main>`, '<main>')
  if (script) h = remplacer(h, /<\/body>/, `<script src="${script}" defer></script>\n</body>`, '</body>')
  return h
}

// Le bloc d'appel vers l'app : repris du gabarit, avec la provenance.
const ctaModele = MODELE.match(/<section class="cta r">[\s\S]*?<\/section>/)?.[0]
if (!ctaModele) throw new Error('[seo-plus] repere introuvable dans le gabarit : section cta')
// Les duels n'existent plus dans l'app : on ne les promet pas ici.
const cta = (ref = 'seo') => ctaModele.replace(/href="\/\?ref=seo"/, `href="/?ref=${ref}"`)
  .replace(/, puis vous les départagez en duels\./, '.')
const offrirModele = MODELE.match(/<aside class="offrir r"[\s\S]*?<\/aside>/)?.[0] ?? ''

const bascule = (base, s) => `<nav class="bascule" aria-label="Filles ou garçons"><a href="${base}filles/"${s === 'f' ? ' aria-current="page"' : ''}>Filles</a><a href="${base}garcons/"${s === 'm' ? ' aria-current="page"' : ''}>Garçons</a></nav>`

// Même règle que scripts/seo.mjs : sur téléphone, l'entier arrondi et des
// en-têtes courts (le CSS, partagé, choisit entre les deux formes).
const deuxFormes = (long, court) => long === court ? long
  : `<span class="v-long">${long}</span><span class="v-court">${court}</span>`
const tete2 = (long, court, titre = long) =>
  `<span class="long">${long}</span><abbr class="court" title="${titre}">${court}</abbr>`
// Arrondi d'abord, signe et couleur ensuite : jamais « -0 % » en rouge (0 est
// gris, classe .nul). Même règle que tendanceHtml dans scripts/seo.mjs.
const arrondi = (t, n = 1) => { const r = Number(t.toFixed(n)); return r === 0 ? 0 : r }
const pctTendance = (t, n = 1) => { const r = arrondi(t, n); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${dec(Math.abs(r), n)}` }
const classeTendance = (t, n = 1) => { const r = arrondi(t, n); return r > 0 ? 'monte' : r < 0 ? 'baisse' : 'nul' }
const tend = p => {
  if (p.n < SEUIL_TENDANCE) return '<span>–</span>'
  const long = `<span class="${classeTendance(p.t)}">${pctTendance(p.t)}\u202f%</span>`
  const court = `<span class="${classeTendance(p.t, 0)}">${pctTendance(p.t, 0)}\u202f%</span>`
  return deuxFormes(long, court)
}

function tableau(xs, legende, cols = 'standard') {
  const tete = cols === 'projection'
    ? `<th scope="col" class="rg">#</th><th scope="col">Prénom</th><th scope="col" class="n">${tete2(`Rang ${AN1 - 2}-${AN1}`, 'Rang')}</th><th scope="col" class="n">${tete2('Naissances/an en 2027', 'En 2027', 'Naissances par an en 2027')}</th>`
    : `<th scope="col" class="rg">#</th><th scope="col">Prénom</th><th scope="col" class="o">Origine</th><th scope="col" class="n">${tete2('Naissances', 'Naiss.')}</th><th scope="col" class="n">Tendance</th>`
  const ligne = (x, i) => {
    const nom = `<td><a href="${url(x)}"><b>${esc(x.l)}</b></a></td>`
    return cols === 'projection'
      ? `<tr><td class="rg">${i + 1}</td>${nom}<td class="n">${x.rangActuel ? nf(x.rangActuel) : '–'}${x.entree ? ' <span class="monte">nouveau</span>' : ''}</td><td class="n"><span class="v-long">≈ </span>${nf(x.proj)}</td></tr>`
      : `<tr><td class="rg">${i + 1}</td>${nom}<td class="o">${esc(x.g.map(ORIGINE_LIB).join(', '))}</td><td class="n">${nf(x.n)}</td><td class="n">${tend(x)}</td></tr>`
  }
  return `<div class="tableau r"><table><caption>${esc(legende)}</caption>
<thead><tr>${tete}</tr></thead><tbody>
${xs.map(ligne).join('')}
</tbody></table></div>`
}

const ecrites = new Map()                       // chemin -> html, pour le sitemap et IndexNow
function ecrire(chemin, html) {
  const f = resolve(SORTIE, '.' + chemin, 'index.html')
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, html)
  ecrites.set(chemin, html)
}

const LEGENDE = `Naissances en France de ${AN1 - 2} à ${AN1} (INSEE) ; tendance : évolution moyenne par an sur les dernières années (« – » sous ${SEUIL_TENDANCE} naissances, l’arrondi INSEE ne permet pas de la calculer).`

// ---------------------------------------------------------------- listes
const listes = []
const nomSexe = { f: 'filles', m: 'garçons' }
const motSexe = { f: 'filles', m: 'garcons' }
const fille = { f: 'fille', m: 'garçon' }

// 1. Prénoms 2027 : projection.
//    Base : naissances moyennes sur 3 ans (annee du milieu = AN1 - 1),
//    prolongees de la tendance annuelle jusqu'en 2027, tendance bornee pour
//    qu'un +60 %/an sur 150 bebes ne projette pas un prenom inconnu dans le
//    top. Seulement les prenoms assez donnes pour que la pente ait un sens.
const CIBLE = 2027
for (const s of ['f', 'm']) {
  // Sans les mixtes : leurs naissances sont celles des deux sexes reunis,
  // Charlie serait compte deux fois (voir /prenoms/mixtes/).
  const pool = T.filter(p => p.sexe === s && p.n >= 150 && Number.isFinite(p.t))
  const actuel = [...pool].sort((a, b) => b.n - a.n)
  actuel.forEach((p, i) => { p[`rang_${s}`] = i + 1 })
  const proj = pool.map(p => {
    // Tendance bornee puis amortie d'annee en annee (x 0,7) : les envolees ralentissent.
    const t = Math.max(-25, Math.min(25, p.t)) / 100
    let proj = p.n / 3
    for (let i = 0; i < CIBLE - (AN1 - 1); i++) proj *= 1 + t * Math.pow(0.7, i)
    return { ...p, rangActuel: p[`rang_${s}`], proj }
  }).sort((a, b) => b.proj - a.proj).slice(0, 50)
  proj.forEach(p => { p.entree = p.rangActuel > 50 })
  const entrees = proj.filter(p => p.entree)
  const chemin = `/prenoms/${CIBLE}/${motSexe[s]}/`
  listes.push({
    chemin, sexe: s, base: `/prenoms/${CIBLE}/`,
    titre: `Prénoms ${fille[s]} ${CIBLE} : le top 50 projeté d’après l’INSEE`,
    description: `Les 50 prénoms de ${nomSexe[s]} qui devraient être les plus donnés en ${CIBLE}, projetés à partir des naissances INSEE et de leur tendance. ${entrees.length} nouveaux venus dans le top.`,
    h1: `Prénoms de ${nomSexe[s]} en ${CIBLE}`,
    sous: `Le top 50 attendu en ${CIBLE}, calculé et non choisi : ${entrees.length ? `${entrees.slice(0, 3).map(p => p.l).join(', ')}${entrees.length > 3 ? '…' : ''} y entrent` : 'peu de changements attendus'}.`,
    avant: entrees.length ? `<section class="bloc r"><h2>Ils entrent dans le top 50</h2><ul class="puces">${entrees.map(p => `<li><a href="${url(p)}">${esc(p.l)} <small>${nf(p.rangActuel)}ᵉ aujourd’hui</small></a></li>`).join('')}</ul></section>` : '',
    tableau: tableau(proj, `Projection ${CIBLE} : naissances moyennes ${AN1 - 2}-${AN1} (INSEE) prolongées de la tendance annuelle de chaque prénom, bornée à ±25 % et amortie d’année en année. Rang actuel : parmi les prénoms de ${nomSexe[s]} donnés au moins 150 fois en trois ans. Les prénoms mixtes, comptés pour les deux sexes par l’INSEE, sont à part.`, 'projection'),
    apres: `<section class="bloc r"><h2>Comment c’est calculé</h2><p>On part du nombre de bébés ayant reçu chaque prénom en France de ${AN1 - 2} à ${AN1} (fichier des prénoms de l’INSEE), et de sa tendance annuelle. On prolonge cette tendance jusqu’en ${CIBLE}, bornée et amortie : un prénom qui s’envole ralentit presque toujours. Les prénoms mixtes (Charlie, Eden…) sont comptés à part, sur la <a href="/prenoms/mixtes/">page des prénoms mixtes</a>, parce que l’INSEE les compte pour les deux sexes. Ce n’est pas une prédiction au bébé près, mais c’est un calcul, refait à chaque publication de l’INSEE, pas une sélection au goût du jour.</p>
<p class="doute">Vous cherchez un prénom qui ne sera pas dans toute la classe ? Regardez surtout la colonne « Rang » : un prénom au 40e rang aujourd’hui qui monte vite sera probablement porté par plusieurs enfants de la même école.</p></section>`
  })
}

// 2. Prénoms courts.
for (const s of ['f', 'm']) {
  const xs = T.filter(p => sexeOk(p, s) && aSens(p) && p.n >= 20 && !p.l.includes('-')
    && sansAccent(p.l).replace(/[^a-z]/g, '').length <= 4).sort((a, b) => b.n - a.n).slice(0, 120)
  listes.push({
    chemin: `/prenoms/courts/${motSexe[s]}/`, sexe: s, base: '/prenoms/courts/',
    titre: `Prénoms courts de ${fille[s]} : ${xs.length} prénoms en 4 lettres ou moins`,
    description: `Prénoms de ${nomSexe[s]} courts (3 ou 4 lettres) donnés en France, avec leur signification, leur origine et leur nombre de naissances INSEE.`,
    h1: `Prénoms courts de ${nomSexe[s]}`,
    sous: `${xs.length} prénoms de 4 lettres ou moins, du plus donné au plus rare, avec leur sens.`,
    tableau: tableau(xs, LEGENDE),
    apres: `<section class="bloc r"><h2>Un prénom court avec un nom long</h2><p>Un prénom court équilibre un nom de famille long ou composé, et l’inverse. Mais deux mots courts qui se touchent accrochent plus facilement : une voyelle à la fin du prénom et au début du nom (« Léa Arnaud ») s’entend comme une hésitation. <a href="${OUTIL}">Testez-le avec votre nom</a>.</p></section>`
  })
}

// 3. Prénoms composés.
for (const s of ['f', 'm']) {
  const xs = T.filter(p => sexeOk(p, s) && p.l.includes('-') && p.n >= 20).sort((a, b) => b.n - a.n).slice(0, 100)
  listes.push({
    chemin: `/prenoms/composes/${motSexe[s]}/`, sexe: s, base: '/prenoms/composes/',
    titre: `Prénoms composés de ${fille[s]} : les ${xs.length} plus donnés en France`,
    description: `Les prénoms composés de ${nomSexe[s]} les plus donnés en France de ${AN1 - 2} à ${AN1}, d’après l’INSEE, avec leur tendance.`,
    h1: `Prénoms composés de ${nomSexe[s]}`,
    sous: `Les ${xs.length} prénoms composés les plus donnés en France, avec leur évolution.`,
    tableau: tableau(xs, LEGENDE),
    apres: `<section class="bloc r"><h2>À l’état civil, le trait d’union compte</h2><p>Avec un trait d’union, les deux prénoms forment un seul prénom d’usage : l’enfant s’appellera « ${esc(xs[0]?.l ?? 'Lily-Rose')} » partout. Sans trait d’union, le second n’est qu’un prénom secondaire, que l’on n’utilise pas au quotidien. Comptez aussi les syllabes avec le nom : un composé et un nom long font vite huit syllabes. <a href="${OUTIL}">Faites le test</a>.</p></section>`
  })
}

// 4. Prénoms mixtes (une seule page).
{
  const xs = T.filter(p => p.sexe === 'fm' && p.n >= 20).sort((a, b) => b.n - a.n).slice(0, 120)
  listes.push({
    chemin: '/prenoms/mixtes/',
    titre: `Prénoms mixtes : ${xs.length} prénoms donnés aux filles et aux garçons`,
    description: `Les prénoms mixtes (épicènes) réellement donnés aux filles comme aux garçons en France, avec signification et naissances INSEE.`,
    h1: 'Prénoms mixtes',
    sous: `${xs.length} prénoms donnés en France aux filles comme aux garçons, du plus au moins porté.`,
    tableau: tableau(xs, LEGENDE),
    apres: `<section class="bloc r"><h2>Mixte sur le papier, pas toujours à l’usage</h2><p>Un prénom est classé mixte ici quand l’INSEE l’enregistre de façon notable pour les deux sexes. Beaucoup penchent nettement d’un côté : Camille ou Charlie restent partagés, d’autres sont surtout féminins ou masculins selon la génération. La fiche de chaque prénom donne sa courbe.</p></section>`
  })
}

// 5. Par terminaison : les fins que l'on cherche vraiment.
const FINS = { f: ['a', 'ine', 'elle', 'ie'], m: ['o', 'an', 'in', 'el'] }
for (const s of ['f', 'm']) {
  for (const fin of FINS[s]) {
    const xs = T.filter(p => sexeOk(p, s) && aSens(p) && p.n >= 20
      && sansAccent(p.l).endsWith(fin)).sort((a, b) => b.n - a.n).slice(0, 100)
    if (xs.length < 30) continue
    listes.push({
      chemin: `/prenoms/terminaison/${motSexe[s]}-en-${fin}/`, fin: { s, fin },
      titre: `Prénoms de ${fille[s]} en -${fin} : les ${xs.length} plus donnés, avec leur sens`,
      description: `Prénoms de ${nomSexe[s]} qui finissent par « ${fin} », classés par nombre de naissances en France (INSEE), avec leur signification et leur origine.`,
      h1: `Prénoms de ${nomSexe[s]} en -${fin}`,
      sous: `${xs.length} prénoms de ${nomSexe[s]} qui finissent par « ${fin} », avec leur sens.`,
      tableau: tableau(xs, LEGENDE),
      apres: `<section class="bloc r"><h2>La fin du prénom, le début du nom</h2><p>C’est la fin du prénom qui rencontre votre nom de famille. ${/^[aeiouy]/.test(fin.at(-1)) ? `Un prénom qui finit par une voyelle accroche sur un nom qui commence par une voyelle (« ${esc(xs[0].l)} Arnaud »).` : `Un prénom qui finit par un son de consonne bute sur un nom qui commence par le même son.`} <a href="${OUTIL}">Vérifiez avec votre nom</a>.</p></section>`
    })
  }
}

for (const L of listes) {
  const fil = [{ n: L.h1, u: L.chemin }]
  ecrire(L.chemin, page({
    chemin: L.chemin, titre: L.titre, description: L.description, fil,
    corps: `<section class="hero court">${h1(L.h1)}<p class="sous">${esc(L.sous)}</p></section>
${L.base ? bascule(L.base, L.sexe) : ''}${L.avant ?? ''}${L.tableau}
${L.apres ?? ''}
${offrirModele}
${cta()}`
  }))
}

// ---------------------------------------------------------------- l'outil
async function scriptOutil() {
  const esbuild = await import('esbuild')
  const r = await esbuild.build({
    stdin: {
      contents: `import { tester } from '~/composables/useNomComplet'\nwindow.__tester = tester`,
      resolveDir: RACINE, loader: 'ts'
    },
    bundle: true, write: false, format: 'iife', minify: true, target: 'es2019',
    plugins: [{
      name: 'alias-nuxt',
      setup(b) {
        b.onResolve({ filter: /^~\// }, a => {
          const base = resolve(RACINE, 'app', a.path.slice(2))
          return { path: existsSync(base + '.ts') ? base + '.ts' : base }
        })
      }
    }]
  })
  return r.outputFiles[0].text
}

const OUTIL_STYLE = `.outil{display:grid;gap:14px;padding:20px;border-radius:24px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
.outil label{display:grid;gap:6px;font-weight:800}
.outil input,.outil textarea{font:inherit;font-weight:500;padding:12px 14px;border-radius:14px;border:1px solid var(--trait);background:var(--fond);color:var(--encre)}
.outil textarea{min-height:76px;resize:vertical}
.outil small{font-weight:500;color:var(--doux)}
.outil button{justify-self:start;border:0;cursor:pointer;font:inherit}
.resultats{display:grid;gap:12px;margin:18px 0 0;padding:0;list-style:none}
.resultats>li{padding:16px 18px;border-radius:20px;background:var(--carte);border:1px solid var(--trait)}
.resultats h3{margin:0 0 8px}
.resultats ul{margin:0;padding:0 0 0 1.1em}
.resultats .accroche{color:var(--non)}.resultats .attention{color:var(--doux)}.resultats .bien{color:var(--oui)}
.resultats .meta{margin:8px 0 0;font-size:15px;color:var(--doux)}`

const OUTIL_JS = `(function(){
var f=document.getElementById('outil'),out=document.getElementById('resultats');
var fiches=null;
function slug(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'')}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function charger(){if(fiches)return Promise.resolve(fiches);return fetch('__FICHES__').then(function(r){return r.ok?r.text():''}).then(function(t){fiches=new Set(t.split('\\n'));return fiches}).catch(function(){fiches=new Set();return fiches})}
function lancer(maj){
  var prenoms=f.prenoms.value.split(/[,;\\n]+/).map(function(x){return x.trim()}).filter(Boolean).slice(0,30);
  var nom=f.nom.value.trim();
  if(!prenoms.length||!nom){out.innerHTML='';return}
  charger().then(function(fi){
    out.innerHTML=prenoms.map(function(p){
      var v=window.__tester(p,nom);if(!v)return'';
      var s=slug(p),lien=fi.has(s)?' · <a href="/prenom/'+s+'/">la fiche '+esc(p)+'</a>':'';
      return '<li><h3>'+esc(p)+' '+esc(nom)+'</h3><ul>'+v.remarques.map(function(r){return'<li class="'+r.gravite+'">'+esc(r.texte)+'</li>'}).join('')+'</ul><p class="meta">'+v.syllabes+' syllabes · initiales '+esc(v.initiales)+lien+'</p></li>'
    }).join('');
    if(maj){var u=new URL(location.href);u.searchParams.set('prenoms',prenoms.join(','));u.searchParams.set('nom',nom);history.replaceState(null,'',u.pathname+u.search)}
  });
}
f.addEventListener('submit',function(e){e.preventDefault();lancer(true)});
var q=new URLSearchParams(location.search);
if(q.get('prenoms'))f.prenoms.value=q.get('prenoms').split(',').join(', ');
if(q.get('nom'))f.nom.value=q.get('nom');
if(q.get('prenoms')&&q.get('nom'))lancer(false);
})();`

// Fichier au nom hache : /statique/ est servi comme immuable.
function statique(nom, ext, contenu) {
  const h = createHash('sha1').update(contenu).digest('hex').slice(0, 10)
  mkdirSync(resolve(SORTIE, 'statique'), { recursive: true })
  writeFileSync(resolve(SORTIE, 'statique', `${nom}.${h}.${ext}`), contenu)
  return `/statique/${nom}.${h}.${ext}`
}

async function pageOutil() {
  const test = await scriptOutil()
  const fiches = statique('fiches', 'txt', T.map(p => p.slug).join('\n'))
  const js = statique('outil-nom', 'js', test + '\n' + OUTIL_JS.replace('__FICHES__', fiches))
  // Des exemples calcules par le test lui-meme : le texte ne peut pas mentir sur ce qu'il fait.
  const tester = new Function('window', test + ';return window.__tester')({})
  const ex = (p, n) => { const v = tester(p, n); return v.remarques.map(r => r.texte).join(' ') }
  // Les exemples du texte doivent rester vrais si le test change.
  for (const [p, n, attendu] of [['Léa', 'Arnaud', 'accroche'], ['Léa', 'Bernard', 'bien'], ['Marc', 'Cordier', 'accroche'], ['Manon', 'Pichon', 'attention']]) {
    if (!tester(p, n).remarques.some(r => r.gravite === attendu)) throw new Error(`[seo-plus] l'exemple « ${p} ${n} » ne donne plus « ${attendu} » : revoir le texte de ${OUTIL}`)
  }
  const titre = 'Tester un prénom avec son nom de famille : sonorité, initiales, rime'
  const description = 'Test gratuit : votre prénom accroche-t-il avec votre nom de famille ? Voyelles qui se touchent, sons qui butent, rime, initiales gênantes, nombre de syllabes.'
  const corps = `<section class="hero court">${h1('Ça donne quoi avec notre nom ?')}<p class="sous">Tapez un ou plusieurs prénoms et votre nom de famille : le test dit ce qui s’entend, sans note sur 10.</p></section>
<form class="outil r" id="outil" autocomplete="off">
<label>Prénoms <small>un ou plusieurs, séparés par des virgules</small><textarea name="prenoms" placeholder="Léa, Jules, Alba" required></textarea></label>
<label>Nom de famille <small>simple ou composé</small><input name="nom" placeholder="Arnaud" required></label>
<button class="b" type="submit">Tester</button>
<small>Rien n’est envoyé : le test tourne dans votre navigateur.</small>
</form>
<ul class="resultats" id="resultats" aria-live="polite"></ul>
<section class="bloc r"><h2>Ce que le test écoute</h2>
<h3>Deux voyelles qui se touchent</h3><p>C’est le défaut le plus audible et le seul qu’on ne voit pas à l’écrit. ${esc(ex('Léa', 'Arnaud'))} Avec « Léa Bernard », tout coule.</p>
<h3>Le même son de part et d’autre</h3><p>Quand le prénom finit par le son qui ouvre le nom, la langue bute. Pour « Marc Cordier », le test répond : ${esc(ex('Marc', 'Cordier'))}</p>
<h3>La rime</h3><p>Pour « Manon Pichon » : ${esc(ex('Manon', 'Pichon'))} C’est un goût : le test le signale, sans le condamner.</p>
<h3>Les initiales</h3><p>Elles suivront l’enfant sur ses cahiers, ses mails, sa signature. Le test repère les sigles qu’on préfère éviter : W.C., P.Q., F.N.… Pensez au deuxième prénom s’il apparaît sur les documents.</p>
<h3>Le nombre de syllabes</h3><p>Au-delà de huit syllabes, prénom et nom deviennent longs à dire ; à deux, c’est très sec. Entre les deux, aucune règle : un prénom court équilibre un nom long, et l’inverse.</p></section>
<section class="bloc r"><h2>Pourquoi à l’oral et pas à l’écrit</h2><p>« Léa Arnaud » et « Léa Bernard » ont l’air aussi simples l’un que l’autre sur le papier. C’est à voix haute que la différence apparaît. Le test travaille sur la prononciation : il neutralise ce qui ne s’entend pas (h muet, lettres doublées, e final) avant de comparer la fin du prénom et le début du nom.</p></section>
<section class="bloc r"><h2>Et pour toute une liste ?</h2><p>Dans ${MARQUE}, le test s’applique à chaque prénom pendant que vous triez, et vous pouvez écarter d’un geste tous ceux qui accrochent avec votre nom. Vous triez chacun de votre côté ; seuls les prénoms qui vous plaisent à tous les deux remontent.</p></section>
${cta('outil-nom')}`
  ecrire(OUTIL, page({
    chemin: OUTIL, titre, description, fil: [{ n: 'Tester avec son nom', u: OUTIL }], corps,
    style: OUTIL_STYLE, script: js,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Test prénom et nom de famille',
      url: SITE + OUTIL, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', inLanguage: 'fr-FR',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, isPartOf: { '@type': 'WebSite', name: MARQUE, url: SITE + '/' }
    }]
  }))
}

// ---------------------------------------------------------------- cadeau
function pageCadeau() {
  const corps = `<section class="hero court">${h1('Une idée cadeau pour des futurs parents')}<p class="sous">Le seul cadeau qui sert avant la naissance : les aider à trouver le prénom, à deux, sans se disputer.</p></section>
<section class="bloc r"><h2>Pourquoi ce cadeau</h2><p>Les bodies, la gigoteuse et la veilleuse arriveront en dizaines. Le prénom, lui, occupe les futurs parents pendant des mois, et c’est souvent là que ça coince : l’un propose, l’autre dit non, et la liste ne bouge plus. ${MARQUE} leur permet de trier chacun de leur côté, sans s’influencer, et ne leur montre que les prénoms qui leur plaisent à tous les deux.</p></section>
<section class="bloc r"><h2>Comment ça marche</h2><ol>
<li>Vous achetez sur la page Offrir, sans créer de compte : ${esc(PRIX)}.</li>
<li>Vous recevez un lien et un code, à glisser dans une carte ou un message.</li>
<li>Les futurs parents l’utilisent quand ils veulent, dans les 2 ans : il débloque leur liste, pour eux deux et pour ceux qu’ils y invitent.</li>
</ol><p class="doute">Grands-parents, parrain, marraine : une fois invités, vous pouvez même donner votre avis sur les prénoms qu’ils ont en commun. Sans voter à leur place.</p>
<p><a class="b" rel="nofollow" href="/offrir">Offrir ${MARQUE}</a></p></section>
<section class="bloc r"><h2>Ce que la liste débloquée ajoute</h2><ul>
<li>Trier sans limite, au lieu de quelques prénoms par jour.</li>
<li>Essayer chaque prénom avec le nom de famille.</li>
<li>L’imaginer dans une classe, avec les prénoms de sa génération.</li>
<li>Comprendre ce qui les sépare quand ils ne sont pas d’accord.</li>
</ul><p class="doute">Sans publicité, sans abonnement : un seul paiement pour toute la liste.</p></section>
<section class="bloc r"><h2>Questions</h2>
<h3>Et s’ils ont déjà choisi ?</h3><p>Tant que le code n’a pas servi, vous pouvez vous rétracter pendant 14 jours. Au-delà, il reste valable 2 ans : pour le prochain.</p>
<h3>Faut-il qu’ils installent une application ?</h3><p>Non : tout se passe dans le navigateur, sur téléphone ou ordinateur. Le second parent rejoint par un simple lien.</p></section>
${cta('cadeau')}`
  ecrire(CADEAU, page({
    chemin: CADEAU,
    titre: `Idée cadeau futurs parents : les aider à choisir le prénom (${PRIX})`,
    description: `Un cadeau original pour une future maman ou un futur papa : ${MARQUE}, pour choisir le prénom à deux. ${PRIX}, sans compte, un lien et un code valables 2 ans.`,
    fil: [{ n: 'Idée cadeau futurs parents', u: CADEAU }], corps
  }))
}

// ---------------------------------------------------------------- liens
// Sans lien, une page n'existe pas pour Google : pied de page de toutes les
// pages, et un bloc sur le portail.
function liensPartout() {
  const ajout = `<li><a href="${OUTIL}">Tester avec son nom</a></li><li><a href="/prenoms/${CIBLE}/filles/">Prénoms ${CIBLE}</a></li><li><a href="/prenoms/courts/filles/">Prénoms courts</a></li><li><a href="/prenoms/mixtes/">Prénoms mixtes</a></li>`
  const ajoutMarque = `<li><a href="${CADEAU}">Idée cadeau futurs parents</a></li>`
  const motifExplorer = /(<p class="t">Explorer<\/p><ul>)/
  const motifMarque = /(<p class="t">babyNamed<\/p><ul>)/
  let n = 0, rates = 0
  const parcourir = dossier => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const f = join(dossier, e.name)
      if (e.isDirectory()) { if (e.name !== 'statique' && e.name !== 'data') parcourir(f); continue }
      if (e.name !== 'index.html') continue
      let h = readFileSync(f, 'utf8')
      if (h.includes(`href="${OUTIL}">Tester avec son nom`)) continue
      if (!motifExplorer.test(h)) { rates++; continue }
      h = h.replace(motifExplorer, (m) => m + ajout).replace(motifMarque, (m) => m + ajoutMarque)
      writeFileSync(f, h); n++
    }
  }
  for (const r of ['prenom', 'prenoms', 'choisir-un-prenom-a-deux', ...[...ecrites.keys()].map(c => c.split('/')[1])]) {
    const f = resolve(SORTIE, r)
    if (existsSync(f) && statSync(f).isDirectory()) parcourir(f)
  }
  // Le modele des fiches rendues par le Worker (scripts/fiches-insee.mjs) :
  // meme pied de page que les autres.
  const modele = resolve(RACINE, 'server/assets/fiches/modele.html')
  if (existsSync(modele)) {
    const m = readFileSync(modele, 'utf8')
    if (!m.includes(`href="${OUTIL}">Tester avec son nom`) && motifExplorer.test(m)) {
      writeFileSync(modele, m.replace(motifExplorer, (x) => x + ajout).replace(motifMarque, (x) => x + ajoutMarque))
    }
  }
  // Portail : un bloc « Pour choisir » avant les listes.
  const portail = resolve(SORTIE, 'prenoms/index.html')
  let h = readFileSync(portail, 'utf8')
  if (!h.includes('id="pour-choisir"')) {
    const bloc = `<section class="bloc r" id="pour-choisir"><h2>Pour choisir</h2><ul class="puces">
<li><a href="${OUTIL}">Tester avec votre nom de famille</a></li>
<li><a href="/prenoms/${CIBLE}/filles/">Prénoms de filles ${CIBLE}</a></li><li><a href="/prenoms/${CIBLE}/garcons/">Prénoms de garçons ${CIBLE}</a></li>
<li><a href="/prenoms/courts/filles/">Courts (filles)</a></li><li><a href="/prenoms/courts/garcons/">Courts (garçons)</a></li>
<li><a href="/prenoms/composes/filles/">Composés (filles)</a></li><li><a href="/prenoms/composes/garcons/">Composés (garçons)</a></li>
<li><a href="/prenoms/mixtes/">Mixtes</a></li>
${listes.filter(L => L.fin).map(L => `<li><a href="${L.chemin}">${esc(L.h1.replace('Prénoms de ', '').replace(/^./, ch => ch.toUpperCase()))}</a></li>`).join('\n')}
</ul></section>`
    const avant = h
    h = h.replace(/(<section class="hero[^>]*>[\s\S]*?<\/section>)/, (m) => m + '\n' + bloc)
    if (h === avant) throw new Error('[seo-plus] repere introuvable sur le portail : hero')
    writeFileSync(portail, h)
  }
  return { n, rates }
}

// ---------------------------------------------------------------- sitemap, llms.txt, IndexNow
function completer() {
  const sm = resolve(SORTIE, 'sitemap.xml')
  let x = readFileSync(sm, 'utf8')
  const nouvelles = [...ecrites.keys()].filter(u => !x.includes(`<loc>${SITE}${u}</loc>`))
  x = x.replace('</urlset>', () => nouvelles.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${MAJ}</lastmod></url>`).join('\n') + '\n</urlset>')
  writeFileSync(sm, x)

  const llms = resolve(SORTIE, 'llms.txt')
  if (existsSync(llms)) {
    let t = readFileSync(llms, 'utf8')
    if (!t.includes(OUTIL)) {
      t = t.trimEnd() + `\n\n## Outils et listes calculées\n- [Tester un prénom avec son nom de famille](${SITE}${OUTIL}): hiatus, sons qui butent, rime, initiales, syllabes ; gratuit, dans le navigateur\n- [Prénoms ${CIBLE}](${SITE}/prenoms/${CIBLE}/filles/): top 50 projeté d’après les naissances INSEE et leur tendance\n- [Prénoms courts](${SITE}/prenoms/courts/filles/), [composés](${SITE}/prenoms/composes/filles/), [mixtes](${SITE}/prenoms/mixtes/)\n- [Idée cadeau futurs parents](${SITE}${CADEAU}): offrir ${MARQUE}, ${PRIX}, sans compte\n`
      writeFileSync(llms, t)
    }
  }

  // Empreintes : les pages existantes ont change (pied de page) ; on les recalcule toutes.
  const fe = SORTIE === PUBLIC ? resolve(RACINE, '.seo-empreintes.json') : resolve(SORTIE, '.seo-empreintes.json')
  if (existsSync(fe)) {
    const e = JSON.parse(readFileSync(fe, 'utf8'))
    for (const u of [...Object.keys(e.urls), ...nouvelles]) {
      const f = resolve(SORTIE, '.' + u, 'index.html')
      if (u !== '/' && existsSync(f)) e.urls[u] = createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 16)
    }
    writeFileSync(fe, JSON.stringify(e, null, 1))
  }
  return nouvelles.length
}

await pageOutil()
pageCadeau()
const { n, rates } = liensPartout()
const ajoutees = completer()
console.log(`[seo-plus] ${listes.length} listes, outil nom de famille, page cadeau ; liens ajoutés sur ${n} pages${rates ? ` (${rates} sans pied de page reconnu)` : ''} ; sitemap +${ajoutees} URL`)
