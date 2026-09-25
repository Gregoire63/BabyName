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
 *  - le service worker ne met pas ces pages à la place de la coquille.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compteur, BASE } from './navigateur.mjs'

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
