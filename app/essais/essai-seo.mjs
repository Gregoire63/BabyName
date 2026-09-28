/**
 * Ce que lisent les moteurs et les robots d'IA.
 *
 * Ce qui se vérifie ici, sur les fichiers que scripts/seo.mjs produit (dans un
 * dossier temporaire : public/ n'est pas touché) et sur la coquille servie :
 *  - la page de l'application existe, statique, avec ses données structurées
 *    (WebApplication, FAQPage) et des limites du gratuit qui sont celles du
 *    schéma, pas une copie ;
 *  - llms.txt résume l'app, avec des liens absolus sur le bon domaine ;
 *  - robots.txt ferme les liens des fiches vers l'app (/?…), laisse le reste ;
 *  - le bouton des fiches est en nofollow, et chaque page mène aux mentions
 *    légales ;
 *  - un titre ne promet pas de signification quand il n'y en a pas ;
 *  - le lastmod du sitemap ne change pas à chaque build ;
 *  - la coquille « / » dit ce qu'est l'app à qui n'exécute pas le JavaScript ;
 *  - le service worker ne met pas ces pages à la place de la coquille ;
 *  - la navigation : rubriques (la courante marquée), filles ou garçons d'un
 *    geste sur un classement, la fiche qui mène aux classements où elle
 *    figure, l'accueil qui montre ce que contient chaque classement, les
 *    origines de la plus représentée à la plus rare ;
 *  - rien ne dépasse à droite sur un téléphone de 360 px, tableaux compris
 *    (ils débordaient le 28/09).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compteur, lancer, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://exemple-babynamed.test'
const sortie = mkdtempSync(join(tmpdir(), 'seo-'))
const journal = execFileSync('node', [join(RACINE, 'scripts/seo.mjs')], {
  env: { ...process.env, SEO_SORTIE: sortie, NUXT_PUBLIC_SITE_URL: SITE }, encoding: 'utf8'
})
console.log('   ' + journal.trim())
const lire = chemin => readFileSync(join(sortie, chemin), 'utf8')
const jsonld = html => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
  .map(m => JSON.parse(m[1]))

// ---------- la page de l'application --------------------------------------
const app = lire('choisir-un-prenom-a-deux/index.html')
const blocs = jsonld(app)
const webapp = blocs.find(b => b['@type'] === 'WebApplication')
const faq = blocs.find(b => b['@type'] === 'FAQPage')
dit(!!webapp && webapp.url === `${SITE}/` && webapp.offers?.length === 2,
  'la page de l’app déclare une WebApplication, gratuite avec une option payante')
dit(faq?.mainEntity?.length >= 4, `et sa FAQ en données structurées (${faq?.mainEntity?.length} questions)`)
dit(app.includes(`<link rel="canonical" href="${SITE}/choisir-un-prenom-a-deux/">`), 'avec son URL canonique')
const schema = readFileSync(join(RACINE, 'server/assets/migrations/0001_initial.sql'), 'utf8')
const depart = schema.match(/quota_depart\s+\w+\s+not null default (\d+)/)[1]
const jour = schema.match(/quota_par_jour\s+\w+\s+not null default (\d+)/)[1]
dit(app.includes(`${depart} prénoms pour commencer, puis ${jour} par jour`),
  `les limites du gratuit sont celles du schéma (${depart} puis ${jour} par jour)`)

// ---------- llms.txt -------------------------------------------------------
const llms = lire('llms.txt')
dit(/^# babyNamed\n\n> /.test(llms), 'llms.txt suit le format : titre, puis résumé en citation')
const liens = [...llms.matchAll(/\]\((.*?)\)/g)].map(m => m[1])
dit(liens.length >= 10 && liens.every(u => u.startsWith(SITE)),
  `ses ${liens.length} liens sont absolus, sur le domaine du build`)
dit(llms.includes(`${depart} prénoms pour commencer`) && /\d+ € TTC par liste/.test(llms),
  'il dit ce qui est gratuit et ce qui est payant')

// ---------- robots.txt -----------------------------------------------------
const robots = lire('robots.txt')
dit(/^Disallow: \/\?$/m.test(robots) && /^Allow: \/$/m.test(robots),
  'robots.txt ferme /?… (les liens vers l’app) et laisse le reste')
dit(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'et donne le sitemap')
dit(!/GPTBot|ClaudeBot|PerplexityBot|Google-Extended/.test(robots),
  'aucun robot d’IA n’est écarté')

// ---------- une fiche ------------------------------------------------------
const louise = lire('prenom/louise/index.html')
dit(/<a class="b" rel="nofollow" href="\/\?ref=seo&amp;prenom=louise">/.test(louise),
  'le bouton de la fiche vers l’app est en nofollow, et garde le prénom')
dit(louise.includes('href="/choisir-un-prenom-a-deux/"'), 'la fiche mène à la page de l’app')
dit(['/mentions-legales', '/confidentialite', '/conditions'].every(u => louise.includes(`href="${u}"`)),
  'et aux mentions légales, à la confidentialité et aux conditions')
const sitemap = lire('sitemap.xml')
let sansSens = null
for (const m of sitemap.matchAll(/<loc>[^<]*\/prenom\/([a-z-]+)\/<\/loc>/g)) {
  const h = lire(`prenom/${m[1]}/index.html`)
  if (h.includes('ne sont pas établies de façon fiable') || h.includes('sa signification n’est pas établie')) { sansSens = h; break }
}
dit(!!sansSens && !/<title>[^<]*signification/.test(sansSens),
  'une fiche sans sens établi ne promet pas de « signification » dans son titre')
// Ni sens ni origine : la fiche existe, mais n'est ni indexée ni au sitemap.
const { readdirSync } = await import('node:fs')
let mince = null
for (const s of readdirSync(join(sortie, 'prenom'))) {
  const h = lire(`prenom/${s}/index.html`)
  if (h.includes('ne sont pas établies de façon fiable')) { mince = s; break }
}
dit(!!mince && /<meta name="robots" content="noindex, follow">/.test(lire(`prenom/${mince}/index.html`))
    && !sitemap.includes(`/prenom/${mince}/<`),
  `une fiche mince (ni sens ni origine : ${mince}) est en noindex et hors du sitemap`)
dit(!/noindex/.test(louise), 'une fiche pleine reste indexable')

// ---------- la mise en page -------------------------------------------------
// Aucun script exécutable : la politique de contenu des fiches n'en admet pas
// en ligne (seul le JSON-LD, qui n'est pas du code).
dit([...louise.matchAll(/<script\b([^>]*)>/g)].every(m => /type="application\/ld\+json"/.test(m[1])),
  'aucun script exécutable sur une fiche : les animations sont du CSS')
const polices = [...louise.matchAll(/url\((\/statique\/nunito-[a-z-]+-\d+\.[0-9a-f]{10}\.woff2)\)/g)].map(m => m[1])
dit(polices.length === 4 && polices.every(u => { try { readFileSync(join(sortie, u)); return true } catch { return false } }),
  `Nunito servie par le site, sous des noms à empreinte (${polices.length} fichiers présents)`)
dit([...louise.matchAll(/<link rel="preload" href="(\/statique\/[^"]+)" as="font" type="font\/woff2" crossorigin>/g)].length === 2,
  'les deux graisses du texte latin sont préchargées')
const css = louise.match(/<style>(.*?)<\/style>/s)?.[1] ?? ''
const horsMouvement = css.split('@media (prefers-reduced-motion:no-preference)')[0]
dit(!/animation(-name)?:/.test(horsMouvement) && /animation:/.test(css),
  'toutes les animations vivent sous prefers-reduced-motion: no-preference')
dit(/class="trait" pathLength="1"/.test(louise) && /<figure class="carte graphe">/.test(louise),
  'la courbe est prête à se tracer (pathLength) dans sa carte')

// ---------- la navigation ------------------------------------------------------
const tendF = lire('prenoms/tendance/filles/index.html')
const rubriques = tendF.match(/<nav class="rubriques"[^>]*>(.*?)<\/nav>/s)?.[1] ?? ''
dit(/<a href="\/prenoms\/tendance\/filles\/" aria-current="page">Tendances<\/a>/.test(rubriques)
    && /href="\/prenoms\/populaires\/filles\/"/.test(rubriques) && /href="\/prenoms\/origines\/"/.test(rubriques),
  'les rubriques en haut de chaque page, la courante marquée')
dit(/<a href="\/prenoms\/tendance\/garcons\/">Garçons<\/a>/.test(tendF.match(/<nav class="bascule"[^>]*>(.*?)<\/nav>/s)?.[1] ?? ''),
  'un classement passe des filles aux garçons d’un geste')
dit(/<caption>Naissances en France de \d{4} à \d{4}/.test(tendF) && !/<th[^>]*>Naissances \d/.test(tendF),
  'les années du tableau sont dans sa légende, pas dans l’en-tête (qui débordait)')
dit(/1<sup>er<\/sup><\/b><span>des prénoms de filles les plus donnés<\/span>/.test(louise)
    && louise.includes('href="/prenoms/populaires/filles/"'),
  'la fiche de Louise mène au classement où elle est 1re')
const portail = lire('prenoms/index.html')
const cartes = [...portail.matchAll(/<article class="carte classement r">(.*?)<\/article>/gs)].map(m => m[1])
dit(cartes.length === 3 && cartes.every(c => (c.match(/<a href="\/prenom\//g) ?? []).length === 6),
  'l’accueil montre chaque classement par ses trois premiers prénoms, filles et garçons')
const origines = lire('prenoms/origines/index.html')
const totaux = [...origines.matchAll(/<span>([\d\u202f\u00a0 ]+) prénoms<\/span>/g)].map(m => Number(m[1].replace(/\D/g, '')))
dit(totaux.length >= 20 && totaux.every((n, i) => i === 0 || n <= totaux[i - 1]) && sitemap.includes('/prenoms/origines/<'),
  `la page des origines les range de la plus représentée à la plus rare (${totaux.length} origines), et elle est au sitemap`)
const lettreL = lire('prenoms/lettre/l/index.html')
dit(/aria-current="page" aria-label="Prénoms en L">L<\/a>/.test(lettreL) && /rel="prev">← Prénoms en K/.test(lettreL),
  'une page de lettre marque sa lettre et mène aux voisines')

// ---------- rien ne dépasse, sur un téléphone ------------------------------------
const serveur = createServer((q, r) => {
  const f = join(sortie, decodeURIComponent(q.url.split('?')[0]), q.url.endsWith('/') ? 'index.html' : '')
  if (!existsSync(f)) { r.writeHead(404); r.end(); return }
  r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' })
  r.end(readFileSync(f))
}).listen(0)
const port = serveur.address().port
const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 360, height: 780 } })
const onglet = await ctx.newPage()
const debords = []
for (const chemin of ['/prenoms/', '/prenoms/tendance/filles/', '/prenoms/rares/garcons/', '/prenoms/populaires/filles/',
  '/prenoms/origine/arabe/', '/prenoms/origines/', '/prenoms/lettre/l/', '/prenom/louise/', '/choisir-un-prenom-a-deux/']) {
  await onglet.goto(`http://127.0.0.1:${port}${chemin}`, { waitUntil: 'networkidle' })
  const d = await onglet.evaluate(() => [document.documentElement, ...document.querySelectorAll('.tableau, nav.rubriques ul')]
    .map(e => e.scrollWidth - e.clientWidth).reduce((a, b) => Math.max(a, b), 0))
  if (d > 0) debords.push(`${chemin} (+${d} px)`)
}
await nav.close()
serveur.close()
dit(debords.length === 0, `à 360 px, rien ne dépasse à droite : ni la page, ni un tableau, ni les rubriques (${debords.join(', ') || 'aucun débordement'})`)

// ---------- sitemap --------------------------------------------------------
const dates = new Set([...sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map(m => m[1]))
const aujourdhui = new Date().toISOString().slice(0, 10)
dit(dates.size === 1 && /^\d{4}-\d{2}-\d{2}$/.test([...dates][0]),
  `un seul lastmod, fixé à la main (${[...dates].join(', ')})`)
dit(sitemap.includes(`<loc>${SITE}/choisir-un-prenom-a-deux/</loc>`), 'la page de l’app est dans le sitemap')
console.log(`   (aujourd’hui : ${aujourdhui} — le lastmod ne suit pas le build)`)

// ---------- la coquille, pour qui n'exécute pas le JavaScript ---------------
const coquille = await fetch(`${BASE}/`).then(r => r.text()).catch(() => '')
const noscript = coquille.match(/<noscript>(.*?)<\/noscript>/s)?.[1] ?? ''
dit(/<meta name="description" content="[^"]*à deux/.test(coquille), 'la coquille a une vraie description')
dit(/choisir-un-prenom-a-deux/.test(noscript) && /\/prenoms\//.test(noscript),
  'et, sans JavaScript, un texte et deux liens lisibles')

// ---------- le service worker ne s'en mêle pas ---------------------------------
const sw = readFileSync(join(RACINE, 'public/sw.js'), 'utf8')
dit(/choisir-un-prenom-a-deux/.test(sw) && /'\/llms\.txt'/.test(sw),
  'le service worker laisse la page de l’app et llms.txt au réseau')

rmSync(sortie, { recursive: true, force: true })
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
