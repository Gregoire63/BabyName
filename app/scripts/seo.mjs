#!/usr/bin/env node
/**
 * Pages SEO : une fiche statique par prénom, des pages de liste, sitemap et
 * robots.txt — générées AVANT `nuxt build` dans public/, donc servies telles
 * quelles par Cloudflare (fichiers statiques), sans SSR ni JavaScript — et
 * sans passer par le Worker.
 *
 * Pourquoi un script et pas le prérendu de Nuxt : l'app est en `ssr: false`
 * et doit le rester (catalogue embarqué, tout se joue côté client). Passer
 * l'app en SSR pour 7 000 pages de lecture, c'était risquer tout le reste.
 * Ici, rien ne touche à l'app : si ce script casse, le build casse avant.
 *
 * Qui a une page : les prénoms de la pile (≥ 20 naissances sur 3 ans) et les
 * rares qui ont un sens connu. Un rare sans sens n'aurait que des chiffres
 * d'arrondi INSEE à montrer : page mince, que Google sanctionne sur tout le
 * site. Il reste trouvable dans l'app.
 *
 * Les graphies qui ne diffèrent que par les accents (Léa / Lea) partagent
 * une URL : c'est la même recherche Google. La plus fréquente porte la page.
 *
 * Domaine : NUXT_PUBLIC_SITE_URL, sinon babynamed.fr.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(RACINE, 'public')
// Pour relire le rendu sans toucher public/ : SEO_SORTIE=/tmp/seo node scripts/seo.mjs
const SORTIE = process.env.SEO_SORTIE ? resolve(process.env.SEO_SORTIE) : PUBLIC
const SITE = (process.env.NUXT_PUBLIC_SITE_URL || 'https://babynamed.fr').replace(/\/$/, '')
const MARQUE = 'babyNamed'
/**
 * La date de derniere modification des pages, pour le sitemap. PAS la date du
 * build : a chaque push, 7 500 URL se seraient declarees modifiees, et Google
 * apprend vite a ignorer un lastmod qui ment. A monter quand les donnees ou
 * les gabarits changent vraiment.
 */
const MAJ = '2026-09-28'
/** La page qui presente l'application elle-meme, statique : c'est elle que
 *  lisent les robots et les IA, la racine « / » n'etant qu'une coquille JS. */
const APP = '/choisir-un-prenom-a-deux/'
const PRIX = (process.env.NUXT_PUBLIC_PRIX_LISTE || '6 €').trim()
const PRIX_NOMBRE = Number(PRIX.replace(',', '.').replace(/[^\d.]/g, '')) || 6
// Les limites du gratuit viennent du schema, pas d'une copie : si elles
// changent en base, la page qui les annonce change au build suivant.
// Les limites du gratuit, lues dans les migrations de la base : la page ne
// peut pas annoncer autre chose que ce que fait l'app.
const MIGRATIONS = resolve(RACINE, 'server/assets/migrations')
const SCHEMA = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(resolve(MIGRATIONS, f), 'utf8')).join('\n')
const defaut = (col, repli) => Number(SCHEMA.match(new RegExp(`${col}\\s+\\w+\\s+not null default (\\d+)`))?.[1] ?? repli)
const QUOTA_DEPART = defaut('quota_depart', 150)
const QUOTA_JOUR = defaut('quota_par_jour', 15)
// Les blocages secrets : la constante que l'app applique, pas une copie.
const BLOCAGES = Number(readFileSync(resolve(RACINE, 'shared/utils/exclusions.ts'), 'utf8')
  .match(/BLOCAGES_SECRETS = (\d+)/)?.[1] ?? 5)
// La validité d'un code cadeau : celle que l'app applique et que les
// conditions annoncent.
const CADEAU_ANS = Number(readFileSync(resolve(RACINE, 'shared/utils/editeur.ts'), 'utf8')
  .match(/cadeauMois: (\d+)/)?.[1] ?? 24) / 12

// ---------------------------------------------------------------- données
const d = JSON.parse(readFileSync(resolve(PUBLIC, 'data/catalogue.json'), 'utf8'))
const c = d.cols
const [AN0, AN1] = d.serie_annees ?? [1986, 2025]
// Sous ce nombre de naissances en trois ans, la pente n'est que l'arrondi à 5
// de l'INSEE : la fiche donne le nombre de bébés par an, pas un pourcentage.
const SEUIL_TENDANCE = d.seuil_tendance ?? 60
const [B0, B1] = d.barres_annees ?? [2011, 2025]
const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const slugDe = s => sansAccent(s).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

const tous = []
for (let k = 0; k < d.n; k++) {
  tous.push({
    k, l: c.l[k], slug: slugDe(c.l[k]), sexe: d.sexe[c.s[k]],
    f: c.f[k], n: c.n[k], t: c.t[k], p: c.p[k], o: c.o[k], q: !!(c.q && c.q[k]),
    y: c.y[k], i: c.i[k], gp: c.gp ? c.gp[k] : k,
    g: c.g[k].map(x => d.origines[x]), m: c.m[k], cf: c.cf ? c.cf[k] ?? null : null,
    dm: c.dm[k] ?? [], sr: c.sr ? c.sr[k] : null, rv: !!c.rv[k],
    nb: c.nb?.[k] ? c.nb[k].map(x => x * 5) : null
  })
}

// Rang par sexe (le catalogue est trié par fréquence, on retrie par sûreté).
for (const s of ['f', 'm', 'fm']) {
  tous.filter(p => p.sexe === s || (s !== 'fm' && p.sexe === 'fm'))
    .sort((a, b) => b.n - a.n).forEach((p, i) => { (p.rang ??= {})[s] = i + 1 })
}

// Groupes de prononciation, graphie la plus fréquente en tête.
const groupes = new Map()
for (const p of tous) { const g = groupes.get(p.gp); g ? g.push(p) : groupes.set(p.gp, [p]) }
for (const g of groupes.values()) g.sort((a, b) => b.n - a.n)

// Qui a une page, et sous quelle URL.
const pages = new Map()                        // slug -> [entrées, la plus fréquente d'abord]
for (const p of tous) {
  if (p.q && !p.m) continue
  if (!p.slug) continue
  const e = pages.get(p.slug); e ? e.push(p) : pages.set(p.slug, [p])
}
for (const e of pages.values()) e.sort((a, b) => b.n - a.n)
const aPage = p => pages.has(p.slug)
/**
 * Fiche MINCE : ni sens ni origine connus. Il ne reste que des chiffres (859
 * fiches, 35 naissances en trois ans en mediane) : la page existe pour qui y
 * arrive par un lien, mais on ne la presente pas a Google (noindex, follow)
 * et elle sort du sitemap. Des centaines de pages presque vides pesent sur
 * tout le site ; on elargira quand le domaine aura fait ses preuves.
 */
const mince = p => !p.m && !p.g.length
const url = p => `/prenom/${p.slug}/`

// ---------------------------------------------------------------- mise en forme
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const nf = x => Math.round(x).toLocaleString('fr-FR')
const dec = (x, n = 1) => x.toLocaleString('fr-FR', { maximumFractionDigits: n, minimumFractionDigits: 0 })
const unSur = f => f > 0 ? `1 bébé sur ${nf(10000 / f)}` : 'quasi jamais'
const GENRE = { f: 'féminin', m: 'masculin', fm: 'mixte' }
const genreNom = { f: 'filles', m: 'garçons', fm: 'mixtes' }
const ORIGINE_LIB = o => o === 'moderne-inventé' ? 'moderne' : o
// « d'origine latine », pas « d'origine latin » : l'adjectif s'accorde avec origine.
const FEMININ = { 'latin': 'latine', 'grec': 'grecque', 'français': 'française', 'espagnol': 'espagnole',
  'italien': 'italienne', 'anglo-saxon': 'anglo-saxonne', 'persan': 'persane', 'turc': 'turque',
  'africain': 'africaine', 'amérindien': 'amérindienne', 'albanais': 'albanaise', 'araméen': 'araméenne',
  'arménien': 'arménienne', 'finno-ougrien': 'finno-ougrienne', 'géorgien': 'géorgienne', 'indien': 'indienne',
  'océanien': 'océanienne', 'portugais': 'portugaise', 'égyptien': 'égyptienne' }
const ORIGINE_F = o => { const l = ORIGINE_LIB(o); return FEMININ[l] ?? l }
const slugOrigine = o => slugDe(ORIGINE_LIB(o))
const liste = (xs) => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' et ' + xs.at(-1)
const lettreDe = p => (sansAccent(p.l)[0] || '').replace(/[^a-z]/, '')

/**
 * La description d'une fiche, 155 caractères au plus : Bing la signale
 * au-delà de 160, Google la coupe vers 155. Un quart des fiches dépassait
 * (jusqu'à 247 : origines multiples, sens composé). On retire d'abord ce qui
 * sert le moins (« graphies et prénoms proches », puis la tendance, puis les
 * origines au-delà de la première), et en dernier on raccourcit le sens, au
 * mot près : le prénom, son genre et son chiffre restent toujours.
 */
const DESCRIPTION_MAX = 155
function descriptionFiche({ nom, genre, origines, sens, chiffre, tendance }) {
  const faire = (o, s, t, fin) => `${nom}, prénom ${genre}${o.length ? ` d’origine ${liste(o)}` : ''}`
    + `${s ? ` : « ${s} »` : ''}. ${chiffre}${t}${fin}`
  const essais = [
    faire(origines, sens, tendance, ', graphies et prénoms proches.'),
    faire(origines, sens, tendance, '.'),
    faire(origines, sens, '', '.'),
    faire(origines.slice(0, 1), sens, '', '.')
  ]
  const bon = essais.find(d => d.length <= DESCRIPTION_MAX)
  if (bon) return bon
  // Le sens, raccourci au mot près, avec « … » : il reste lisible.
  const base = faire(origines.slice(0, 1), '', '', '.')
  if (!sens) return base.length <= DESCRIPTION_MAX ? base : base.slice(0, DESCRIPTION_MAX - 1) + '…'
  const place = DESCRIPTION_MAX - base.length - ' : « … »'.length
  let court = ''
  for (const mot of sens.split(/\s+/)) {
    const suivant = court ? `${court} ${mot}` : mot
    if (suivant.length > place) break
    court = suivant
  }
  court = court.replace(/[\s,;:+(–-]+$/, '')
  return court ? faire(origines.slice(0, 1), `${court}…`, '', '.') : base
}

function tendanceMot(t) {
  if (t >= 12) return 'en forte hausse'
  if (t >= 4) return 'en hausse'
  if (t > -4) return 'stable'
  if (t > -12) return 'en baisse'
  return 'en net recul'
}

// ---------------------------------------------------------------- polices
/**
 * Nunito, la police de l'app, sur les fiches aussi : copiée depuis
 * app/assets/fonts dans /statique/, sous un nom qui porte son empreinte — un
 * nom ne change jamais de contenu, le cache peut le garder un an
 * (modules/entetes-cache.ts). Deux graisses seulement, 500 pour le texte et
 * 800 pour les titres et le gras, toutes deux préchargées. `optional` :
 * la police n'est jamais échangée en cours de lecture, rien ne saute à
 * l'écran ; si elle arrive trop tard, la page garde celle du système.
 */
const POLICES = resolve(RACINE, 'app/assets/fonts')
const PLAGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
}
rmSync(resolve(SORTIE, 'statique'), { recursive: true, force: true })
mkdirSync(resolve(SORTIE, 'statique'), { recursive: true })
const polices = []
for (const poids of [500, 800]) {
  for (const [jeu, plage] of Object.entries(PLAGES)) {
    const octets = readFileSync(resolve(POLICES, `nunito-${jeu}-${poids}-normal.woff2`))
    const nom = `nunito-${jeu}-${poids}.${createHash('sha256').update(octets).digest('hex').slice(0, 10)}.woff2`
    writeFileSync(resolve(SORTIE, 'statique', nom), octets)
    polices.push({ poids, jeu, plage, url: `/statique/${nom}` })
  }
}
const FONTES = polices.map(p => `@font-face{font-family:Nunito;font-style:normal;font-weight:${p.poids};font-display:optional;src:url(${p.url}) format("woff2");unicode-range:${p.plage}}`).join('')
const PRECHARGE = polices.filter(p => p.jeu === 'latin')
  .map(p => `<link rel="preload" href="${p.url}" as="font" type="font/woff2" crossorigin>`).join('\n')

// ---------------------------------------------------------------- gabarit
/**
 * Lire d'abord : du texte à 17-18 px, des lignes qui respirent, une idée par
 * bloc. Les chiffres en cartes, les faits en liste, la FAQ repliée.
 *
 * Les animations sont du CSS, rien d'autre (la politique de contenu des
 * fiches n'admet aucun script en ligne) : l'en-tête et les chiffres montent
 * au chargement, les sections apparaissent quand on y arrive, la courbe se
 * trace et les barres poussent quand elles entrent à l'écran — là où le
 * navigateur sait lier une animation au défilement (@supports), sinon au
 * chargement. Toutes vivent dans `prefers-reduced-motion: no-preference` :
 * qui a demandé moins de mouvement voit la page finie, d'emblée.
 */
const CSS = `
${FONTES}
:root{--encre:#1a234e;--menthe:#cae1d9;--peche:#ecbbb6;--sable:#dfd2cc;--fond:#fbfaf9;--carte:#fff;--trait:#e9e3de;--texte:#1a234e;--doux:#5b6079;--oui:#2c7a5f;--non:#b4463e;--bouton:#1a234e;--sur-bouton:#fff;--voile:rgba(255,255,255,.62);--ombre:0 1px 2px rgba(26,35,78,.05),0 10px 28px -16px rgba(26,35,78,.3)}
@media (prefers-color-scheme:dark){:root{--fond:#101321;--carte:#191d2e;--trait:#2a2f45;--texte:#eef0f7;--doux:#a3a9c2;--encre:#eef0f7;--menthe:#2c4a44;--peche:#4d3330;--sable:#33313c;--oui:#62d2a2;--non:#f08d86;--bouton:#eef0f7;--sur-bouton:#101321;--voile:rgba(255,255,255,.08);--ombre:0 1px 2px rgba(0,0,0,.35),0 12px 30px -16px rgba(0,0,0,.75)}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:500 17px/1.65 Nunito,ui-rounded,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--texte);background:var(--fond);-webkit-font-smoothing:antialiased}
@media (min-width:760px){body{font-size:18px}}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1px}
.nw{white-space:nowrap}
a:focus-visible,summary:focus-visible{outline:3px solid var(--encre);outline-offset:3px;border-radius:10px}
b,strong,th{font-weight:800}
p{margin:0 0 1em;text-wrap:pretty}
h1,h2,h3{font-weight:800;text-wrap:balance;letter-spacing:-.015em}
.l{max-width:760px;margin:0 auto;padding:0 18px}
.aller{position:absolute;left:-999px;top:8px;z-index:9;padding:8px 14px;border-radius:12px;background:var(--carte);font-weight:800}
.aller:focus{left:12px}
header.h{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--fond) 82%,transparent);-webkit-backdrop-filter:saturate(1.5) blur(14px);backdrop-filter:saturate(1.5) blur(14px);border-bottom:1px solid color-mix(in srgb,var(--trait) 70%,transparent)}
header.h .l{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;padding-bottom:10px}
header.h a.m{display:flex;gap:9px;align-items:center;font-weight:800;font-size:18px;text-decoration:none}
header.h img{width:30px;height:30px;border-radius:9px}
.b{display:inline-block;background:var(--bouton);color:var(--sur-bouton);text-decoration:none;font-weight:800;padding:13px 24px;border-radius:999px;transition:transform .18s,box-shadow .18s}
.b:hover{transform:translateY(-2px);box-shadow:0 12px 26px -12px rgba(26,35,78,.6)}
.b:focus-visible{outline:3px solid var(--encre);outline-offset:3px}
.b.p{padding:9px 16px;font-size:15px}
nav.rubriques{border-bottom:1px solid var(--trait)}
nav.rubriques ul{display:flex;gap:14px;margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
nav.rubriques ul::-webkit-scrollbar{display:none}
@media (min-width:560px){nav.rubriques ul{gap:26px}}
@media (max-width:400px){nav.rubriques ul{gap:12px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 18px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 18px),transparent)}nav.rubriques a{font-size:14px}}
nav.rubriques a{display:block;padding:12px 0 9px;border-bottom:3px solid transparent;white-space:nowrap;font-size:15px;font-weight:800;line-height:1.3;text-decoration:none;color:var(--doux);transition:color .15s,border-color .15s}
nav.rubriques a:hover{color:var(--texte);border-bottom-color:var(--trait)}
nav.rubriques a[aria-current="page"]{color:var(--texte);border-bottom-color:var(--encre)}
nav.fil{margin:14px 0 0;font-size:14px;color:var(--doux)}
nav.fil a{color:var(--doux)}
.bascule{display:inline-flex;gap:4px;margin:0 0 14px;padding:4px;border-radius:999px;background:var(--carte);border:1px solid var(--trait)}
.bascule a{padding:8px 20px;border-radius:999px;font-weight:800;text-decoration:none;color:var(--doux)}
.bascule a:hover{color:var(--texte)}
.bascule a[aria-current="page"]{color:var(--sur-bouton);background:var(--bouton)}
.alphabet{display:flex;flex-wrap:wrap;gap:5px;margin:0;padding:0;list-style:none}
.alphabet a{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;font-size:16px;background:var(--carte);border:1px solid var(--trait);text-decoration:none;font-weight:800;transition:transform .18s,background .18s}
.alphabet a:hover{transform:translateY(-2px);background:var(--menthe)}
.alphabet a[aria-current="page"]{color:var(--sur-bouton);background:var(--bouton);border-color:var(--bouton)}
.voisins{display:flex;justify-content:space-between;gap:12px;margin:28px 0 0;font-weight:800}
.voisins a{text-decoration:none}
.voisins a:hover{text-decoration:underline}
.hero{position:relative;isolation:isolate;overflow:hidden;margin:12px 0 22px;padding:36px 24px 30px;border-radius:30px;background:linear-gradient(135deg,var(--menthe),var(--sable) 55%,var(--peche))}
.hero::before,.hero::after{content:"";position:absolute;z-index:-1;border-radius:50%;background:radial-gradient(circle,var(--voile),transparent 68%)}
.hero::before{width:260px;height:260px;right:-80px;top:-100px}
.hero::after{width:200px;height:200px;left:-70px;bottom:-110px}
h1{margin:0;font-size:clamp(42px,12vw,68px);line-height:1.02;letter-spacing:-.03em}
h1.long{font-size:clamp(31px,8.4vw,50px);line-height:1.08}
.hero .sous{margin:12px 0 0;max-width:36em;font-size:17px;line-height:1.55}
.hero.court{margin-bottom:16px;padding:26px 22px 22px}
.sens{margin:10px 0 0;font-size:clamp(21px,5.8vw,28px);line-height:1.25;font-weight:800}
.sens small{display:inline-block;vertical-align:middle;margin-left:6px;padding:3px 10px;border-radius:999px;background:var(--voile);font-size:13px;letter-spacing:0}
.etiquettes{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0 0;padding:0;list-style:none}
.etiquettes li{padding:5px 12px;border-radius:999px;background:var(--voile);font-size:14px;font-weight:800}
.hero .b{margin-top:22px}
.chapo{font-size:19px;line-height:1.6}
.bloc{margin:48px 0 0}
h2{margin:0 0 14px;font-size:clamp(23px,6vw,28px);line-height:1.2}
h2::before{content:"";display:block;width:36px;height:5px;margin:0 0 12px;border-radius:5px;background:linear-gradient(90deg,var(--menthe),var(--peche))}
h3{margin:22px 0 6px;font-size:19px;line-height:1.3}
.chiffres{display:flex;flex-wrap:wrap;gap:10px}
.chiffres>div{flex:1 1 150px;padding:15px 16px;border-radius:20px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
.chiffres b{display:block;font-size:clamp(22px,6vw,28px);line-height:1.15;letter-spacing:-.02em}
.chiffres>div>span{display:block;margin-top:5px;font-size:14px;line-height:1.35;color:var(--doux)}
.carte{padding:18px 20px;border-radius:22px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
.carte>p:last-child{margin-bottom:0}
.doute{margin:.6em 0 0;font-size:15px;color:var(--doux)}
.graphe{margin:0;padding:16px 14px 12px}
.graphe figcaption{margin:8px 6px 0;font-size:14px;color:var(--doux)}
svg.courbe{display:block;width:100%;height:auto;overflow:visible}
.popularite{display:grid;gap:14px}
.faits{display:grid;gap:10px;margin:0;padding:0;list-style:none}
.faits li{display:flex;gap:12px;align-items:flex-start;padding:13px 16px;border-radius:18px;background:var(--carte);border:1px solid var(--trait);line-height:1.5}
@media (min-width:760px){.chiffres>div{flex-basis:200px}.popularite{grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:start}}
.faits li::before{content:"";flex:none;width:10px;height:10px;margin-top:.5em;border-radius:50%;background:linear-gradient(135deg,var(--menthe),var(--peche))}
.puces{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.puces a,.puces span{display:inline-flex;align-items:baseline;gap:6px;padding:8px 15px;border-radius:999px;background:var(--carte);border:1px solid var(--trait);text-decoration:none;font-weight:800;font-size:16px;transition:transform .18s,box-shadow .18s,border-color .18s}
.puces a:hover{transform:translateY(-2px);box-shadow:var(--ombre);border-color:color-mix(in srgb,var(--encre) 28%,var(--trait))}
.puces small{color:var(--doux);font-size:13px}
.cta{position:relative;isolation:isolate;overflow:hidden;margin:52px 0;padding:32px 22px 26px;text-align:center;border-radius:30px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
.cta::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(120% 90% at 50% -10%,color-mix(in srgb,var(--menthe) 70%,transparent),transparent 62%)}
.cta h2::before{margin:0 auto 14px}
.cta p{max-width:32em;margin:0 auto 1.2em}
.cta .doute{margin:1em auto 0}
.offrir{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:18px 0 22px;padding:16px 18px;border-radius:22px;background:linear-gradient(135deg,var(--peche),var(--sable));color:var(--texte)}
.offrir b{display:block;font-size:17px}
.offrir span{display:block;margin-top:2px;font-size:15px;line-height:1.45}
.offrir .b{flex:none}
.tableau{overflow-x:auto;border-radius:22px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
table{width:100%;border-collapse:separate;border-spacing:0;font-size:16px}
caption{padding:14px 14px 10px;text-align:left;font-size:14px;line-height:1.45;color:var(--doux)}
td,th{padding:12px 10px;border-bottom:1px solid var(--trait);text-align:left;vertical-align:top}
th.rg,td.rg{width:2.6em;padding-right:0;text-align:right}
tbody tr:last-child td{border-bottom:0}
th{font-size:13px;color:var(--doux);background:color-mix(in srgb,var(--sable) 28%,var(--carte))}
td:first-child{color:var(--doux);font-variant-numeric:tabular-nums}
tbody tr{transition:background .15s}
tbody tr:hover{background:color-mix(in srgb,var(--menthe) 25%,var(--carte))}
td a{text-decoration:none}
td a:hover{text-decoration:underline}
td small{display:block;margin-top:2px;font-size:14px;line-height:1.35;color:var(--doux)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.monte{color:var(--oui);font-weight:800}
.baisse{color:var(--non);font-weight:800}
@media (max-width:560px){.o{display:none}table{font-size:15px}td,th{padding:11px 6px}td.n,th.n{padding-left:4px}td small{overflow-wrap:anywhere}}
@media (max-width:360px){table{font-size:14px}th{font-size:12px}td,th{padding:10px 4px}th.rg,td.rg{width:2em}}
ul.noms{columns:2 9em;column-gap:20px;margin:0;padding:0;list-style:none}
@media (min-width:760px){ul.noms{columns:4 9em}}
ul.noms li{break-inside:avoid;padding:3px 0}
ul.noms a{text-decoration:none}
ul.noms a:hover{text-decoration:underline}
ul.noms a.courant{font-weight:800}
.classements{display:grid;gap:14px}
.classement h3{margin:0 0 4px;font-size:21px}
.classement>p{margin:0 0 16px;font-size:15px;line-height:1.45;color:var(--doux)}
.duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 22px}
.duo .genre{margin:0 0 6px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--doux)}
ol.apercu{display:grid;gap:5px;margin:0 0 12px;padding:0;list-style:none}
ol.apercu li{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
ol.apercu a{overflow:hidden;font-weight:800;text-overflow:ellipsis;white-space:nowrap;text-decoration:none}
ol.apercu a:hover{text-decoration:underline}
ol.apercu small{flex:none;font-size:14px;font-variant-numeric:tabular-nums;color:var(--doux)}
a.suite{font-size:15px;font-weight:800;text-decoration:none}
a.suite::after{content:" →"}
a.suite:hover{text-decoration:underline}
.origines{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:10px;margin:0;padding:0;list-style:none}
.origines a{display:block;height:100%;padding:14px 16px;border-radius:18px;background:var(--carte);border:1px solid var(--trait);text-decoration:none;box-shadow:var(--ombre);transition:transform .18s,border-color .18s}
.origines a:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--encre) 28%,var(--trait))}
.origines b{display:block;font-size:18px;line-height:1.25}
.origines span{display:block;font-size:14px;color:var(--doux)}
.origines small{display:block;margin-top:8px;font-size:14px;line-height:1.35}
@media (min-width:760px){.origines.six{grid-template-columns:repeat(3,minmax(0,1fr))}}
.suite-bloc{margin:14px 0 0}
h2 small{margin-left:4px;font-size:.62em;color:var(--doux);letter-spacing:0}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
section[id]{scroll-margin-top:84px}
.rangs{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.rangs a{display:flex;align-items:baseline;gap:12px;padding:12px 16px;border-radius:18px;background:var(--carte);border:1px solid var(--trait);text-decoration:none;transition:border-color .18s}
.rangs a:hover{border-color:color-mix(in srgb,var(--encre) 28%,var(--trait))}
.rangs b{flex:none;min-width:2.6em;font-size:19px}
ol.etapes{display:grid;gap:12px;margin:0;padding:0;list-style:none;counter-reset:e}
ol.etapes li{position:relative;counter-increment:e;padding:16px 18px 16px 66px;border-radius:22px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
ol.etapes li::before{content:counter(e);position:absolute;left:16px;top:15px;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;font-weight:800;background:linear-gradient(135deg,var(--menthe),var(--peche))}
.offres{display:grid;gap:12px}
@media (min-width:760px){.offres{grid-template-columns:1fr 1fr}}
.offre .prix{display:block;margin:0 0 10px;font-size:30px;font-weight:800;line-height:1.1;letter-spacing:-.02em}
.offre .prix small{font-size:16px;letter-spacing:0;color:var(--doux)}
.offre.plus{background:linear-gradient(165deg,color-mix(in srgb,var(--menthe) 50%,var(--carte)),var(--carte) 72%)}
.faq{display:grid;gap:10px}
.faq details{padding:0 18px;border-radius:20px;background:var(--carte);border:1px solid var(--trait);box-shadow:var(--ombre)}
.faq summary{position:relative;padding:15px 30px 15px 0;list-style:none;cursor:pointer}
.faq summary::-webkit-details-marker{display:none}
.faq summary h3{margin:0;font-size:17px;line-height:1.4;letter-spacing:0}
.faq summary::after{content:"";position:absolute;right:4px;top:50%;width:9px;height:9px;border-right:2.5px solid currentColor;border-bottom:2.5px solid currentColor;transform:translateY(-75%) rotate(45deg);transition:transform .25s}
.faq details[open] summary::after{transform:translateY(-25%) rotate(-135deg)}
.faq details p{margin:0 0 16px}
footer{margin:64px 0 0;border-top:1px solid var(--trait);font-size:14px;color:var(--doux);background:color-mix(in srgb,var(--sable) 16%,var(--fond))}
footer .l{padding-top:30px;padding-bottom:40px}
footer a{color:var(--doux);text-decoration:none}
footer a:hover{color:var(--texte);text-decoration:underline}
.plan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 18px;margin:0 0 26px}
@media (min-width:760px){.plan{grid-template-columns:repeat(4,minmax(0,1fr))}}
.plan .t{margin:0 0 8px;font-weight:800;color:var(--texte)}
.plan ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}}
@keyframes monte{from{opacity:0;transform:translateY(18px)}}
@keyframes apparait{from{opacity:0}}
@keyframes flotte{to{transform:translate(-24px,18px) scale(1.12)}}
@keyframes trace{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes pousse{from{transform:scaleY(0)}}
@keyframes pop{from{opacity:0;transform:scale(.2)}}
@keyframes ouvre{from{opacity:0;transform:translateY(-6px)}}
@media (prefers-reduced-motion:no-preference){
.hero{animation:apparait .6s ease-out both}
.hero>*,.chiffres>div{animation:monte .7s cubic-bezier(.2,.75,.25,1) both}
.hero>:nth-child(2){animation-delay:.08s}.hero>:nth-child(3){animation-delay:.16s}.hero>:nth-child(4){animation-delay:.24s}
.chiffres>div:nth-child(1){animation-delay:.2s}.chiffres>div:nth-child(2){animation-delay:.27s}.chiffres>div:nth-child(3){animation-delay:.34s}.chiffres>div:nth-child(4){animation-delay:.41s}.chiffres>div:nth-child(5){animation-delay:.48s}.chiffres>div:nth-child(6){animation-delay:.55s}
.hero::before{animation:flotte 9s ease-in-out infinite alternate}
.hero::after{animation:flotte 12s ease-in-out infinite alternate-reverse}
.courbe .trait{stroke-dasharray:1;animation:trace 1.8s .4s cubic-bezier(.45,0,.2,1) both}
.courbe .aire{animation:apparait 1.2s 1s ease-out both}
.courbe .pic{transform-box:fill-box;transform-origin:center;animation:pop .5s 2s cubic-bezier(.3,1.5,.5,1) both}
.courbe .etiquette-pic{animation:apparait .5s 2.1s ease-out both}
.courbe .barre{transform-box:fill-box;transform-origin:50% 100%;animation:pousse .7s calc(.3s + var(--i,0) * 50ms) cubic-bezier(.2,.75,.25,1) both}
.courbe .val{animation:apparait .4s calc(.7s + var(--i,0) * 50ms) ease-out both}
.faq details[open]>p{animation:ouvre .3s ease-out}
@supports (animation-timeline:view()){
.r{animation:monte linear both;animation-timeline:view();animation-range:entry 0% entry 160px}
.graphe{view-timeline:--graphe}
.courbe .trait{animation:trace linear both;animation-timeline:--graphe;animation-range:entry 30% cover 45%}
.courbe .aire{animation:apparait linear both;animation-timeline:--graphe;animation-range:entry 60% cover 42%}
.courbe .pic,.courbe .etiquette-pic{animation:pop linear both;animation-timeline:--graphe;animation-range:cover 40% cover 46%}
.courbe .etiquette-pic{animation-name:apparait}
.courbe .barre{animation:pousse linear both;animation-timeline:--graphe;animation-range:entry calc(25% + var(--i,0) * 3%) cover calc(30% + var(--i,0) * 1%)}
.courbe .val{animation:apparait linear both;animation-timeline:--graphe;animation-range:cover calc(26% + var(--i,0) * 1%) cover calc(32% + var(--i,0) * 1%)}
}
}
`.replace(/\n/g, '')

/** Un long titre n'a pas la taille d'un prénom. */
const h1 = t => `<h1${t.length > 20 ? ' class="long"' : ''}>${esc(t)}</h1>`

/**
 * La navigation, sur toutes les pages : les rubriques sous l'en-tête (une
 * rangée qui défile d'un doigt sur téléphone, la rubrique courante marquée),
 * le fil d'Ariane, et un pied de page en colonnes. Les classements gardent le
 * genre en cours : depuis les garçons qui montent, « Top 100 » mène aux
 * garçons les plus donnés.
 */
const genreDe = s => s === 'm' ? 'garcons' : 'filles'
const RUBRIQUES = g => [
  ['tendance', 'Tendances', `/prenoms/tendance/${g}/`],
  ['populaires', 'Top 100', `/prenoms/populaires/${g}/`],
  ['rares', 'Rares', `/prenoms/rares/${g}/`],
  ['origines', 'Origines', '/prenoms/origines/'],
  ['lettres', 'A–Z', '/prenoms/#lettres']
]
const actuel = oui => oui ? ' aria-current="page"' : ''
const PLAN = `<nav class="plan" aria-label="Plan du site">
${[['filles', 'Filles'], ['garcons', 'Garçons']].map(([g, t]) => `<div><p class="t">${t}</p><ul>
<li><a href="/prenoms/tendance/${g}/">Qui montent</a></li><li><a href="/prenoms/populaires/${g}/">Les plus donnés</a></li><li><a href="/prenoms/rares/${g}/">Rares</a></li></ul></div>`).join('\n')}
<div><p class="t">Explorer</p><ul><li><a href="/prenoms/">Tous les prénoms</a></li><li><a href="/prenoms/origines/">Par origine</a></li><li><a href="/prenoms/#lettres">Par lettre</a></li></ul></div>
<div><p class="t">${MARQUE}</p><ul><li><a href="${APP}">L’application</a></li><li><a href="/offrir" rel="nofollow">Offrir ${MARQUE}</a></li></ul></div>
</nav>`

function page({ chemin, titre, description, fil = [], corps, jsonld = [], ariane = null, indexer = true,
  rubrique = null, genre = 'filles', appel = { texte: 'Choisir à deux', href: APP } }) {
  const canon = SITE + chemin
  const bc = ariane ?? [{ n: 'Prénoms', u: '/prenoms/' }, ...fil]
  jsonld = [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: bc.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.n, item: SITE + x.u }))
  }, ...jsonld]
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${indexer ? '' : '\n<meta name="robots" content="noindex, follow">'}
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${MARQUE}">
<meta property="og:title" content="${esc(titre)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canon}"><meta property="og:image" content="${SITE}/icone-512.png">
<meta name="theme-color" content="#fbfaf9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101321" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/logo.png" type="image/png">
${PRECHARGE}
<style>${CSS}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head><body>
<a class="aller" href="#contenu">Aller au contenu</a>
<header class="h"><div class="l"><a class="m" href="/prenoms/"><img src="/logo.png" alt="" width="30" height="30">${MARQUE}</a>
<a class="b p" href="${appel.href}">${esc(appel.texte)}</a></div></header>
<nav class="rubriques" aria-label="Rubriques"><div class="l"><ul>
${RUBRIQUES(genre).map(([id, t, u]) => `<li><a href="${u}"${actuel(id === rubrique)}>${t}</a></li>`).join('')}
</ul></div></nav>
<main class="l" id="contenu">
${bc.length > 1 ? `<nav class="fil" aria-label="Fil d'Ariane">${bc.map((x, i) => i === bc.length - 1 ? esc(x.n) : `<a href="${x.u}">${esc(x.n)}</a>`).join(' › ')}</nav>` : ''}
${corps}
</main>
<footer><div class="l">
${PLAN}
<p>Chiffres : INSEE, fichier des prénoms (naissances en France de ${AN0} à ${AN1}). Origines et significations : Wiktionnaire et relecture ; quand le sens est incertain, la fiche le dit.</p>
<p><a href="/mentions-legales">Mentions légales</a> · <a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions</a> · <a href="/accessibilite">Accessibilité</a></p>
</div></footer>
</body></html>`
}

const cta = (p) => `<section class="cta r">
<h2>${p ? `${esc(p.l)} vous plaît ?` : 'Trouver le prénom à deux'}</h2>
<p>Swipez chacun de votre côté, sans vous influencer. Vous ne voyez que les prénoms qui vous plaisent à tous les deux, puis vous les départagez en duels.</p>
<a class="b" rel="nofollow" href="/?ref=seo${p ? `&amp;prenom=${encodeURIComponent(p.slug)}` : ''}">Commencer gratuitement</a>
<p class="doute">Sans publicité. Votre partenaire rejoint par un simple lien, sans rien installer.</p>
</section>`

/**
 * Les graphiques : un viewBox de 400 de large, pour que le texte y reste
 * lisible sur un téléphone (à 640, les années tombaient à 7 px). Classes
 * pour l'animation : `trait` (tracé, pathLength 1), `aire`, `pic`, `barre`
 * et `val` (décalées par --i).
 */
function courbe(p) {
  if (!p.sr || !p.sr.some(v => v > 0)) return ''
  const W = 400, H = 200, G = 8, D = 8, B = 26, T = 34
  const max = Math.max(...p.sr)
  const x = i => G + (i / (p.sr.length - 1)) * (W - G - D)
  const y = v => T + (1 - v / max) * (H - T - B)
  const pts = p.sr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const iMax = p.sr.indexOf(max)
  const graduations = [AN0, 2000, 2010, AN1].filter(a => a >= AN0 && a <= AN1)
  return `<svg class="courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Naissances de ${esc(p.l)} pour 10 000 bébés, de ${AN0} à ${AN1}">
<defs><linearGradient id="degrade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--menthe)"/><stop offset="1" style="stop-color:var(--menthe);stop-opacity:.2"/></linearGradient></defs>
<path class="aire" d="M${x(0).toFixed(1)},${H - B} L${pts.join(' L')} L${x(p.sr.length - 1).toFixed(1)},${H - B} Z" style="fill:url(#degrade)"/>
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--trait)" stroke-width="1.5"/>
<polyline class="trait" pathLength="1" points="${pts.join(' ')}" fill="none" style="stroke:var(--encre)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
${graduations.map((a, i) => `<text x="${x(a - AN0).toFixed(1)}" y="${H - 6}" font-size="13" style="fill:var(--doux)" text-anchor="${i === 0 ? 'start' : i === graduations.length - 1 ? 'end' : 'middle'}">${a}</text>`).join('')}
<circle class="pic" cx="${x(iMax).toFixed(1)}" cy="${y(max).toFixed(1)}" r="5" style="fill:var(--encre)"/>
<text class="etiquette-pic" x="${Math.min(Math.max(x(iMax), 78), W - 78).toFixed(1)}" y="${Math.max(y(max) - 13, 15).toFixed(1)}" font-size="13" font-weight="800" style="fill:var(--texte)" text-anchor="middle">${dec(max)} / 10 000 en ${AN0 + iMax}</text>
</svg>`
}

// Les petits prénoms, sans courbe : leurs naissances année par année.
function barres(p) {
  if (!p.nb || !p.nb.some(v => v > 0)) return ''
  const W = 400, H = 180, G = 4, D = 4, B = 26, T = 22
  const max = Math.max(...p.nb)
  const pas = (W - G - D) / p.nb.length
  const y = v => T + (1 - v / max) * (H - T - B)
  // Le nombre sur chaque barre, les années dessous : des barres muettes ne
  // se lisent pas (même règle que BarresPrenom dans l'app).
  const cx = i => (G + i * pas + pas / 2).toFixed(1)
  const annees = p.nb.map((_, i) => B0 + i)
    .filter(a => a === B0 || a === B1 || (a % 5 === 0 && a - B0 >= 3 && B1 - a >= 3))
  return `<svg class="courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Naissances de ${esc(p.l)} par an, de ${B0} à ${B1}, arrondies à 5 par l’INSEE : au plus ${max}">
${p.nb.map((v, i) => v > 0 ? `<rect class="barre" style="--i:${i};fill:var(--menthe);stroke:var(--encre)" x="${(G + i * pas + pas * 0.16).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(pas * 0.68).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="3" stroke-width="1.5"/><text class="val" style="--i:${i};fill:var(--texte)" x="${cx(i)}" y="${(y(v) - 5).toFixed(1)}" font-size="12" font-weight="800" text-anchor="middle">${v}</text>` : '').join('')}
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--trait)" stroke-width="1.5"/>
${annees.map(a => `<text x="${cx(a - B0)}" y="${H - 6}" font-size="13" style="fill:var(--doux)" text-anchor="middle">${a}</text>`).join('')}
</svg>`
}

// Prénoms proches : même sexe, origine commune, rareté et longueur voisines.
const parSexe = { f: [], m: [], fm: [] }
for (const e of pages.values()) parSexe[e[0].sexe].push(e[0])
function proches(p, n = 12) {
  const vus = new Set((groupes.get(p.gp) ?? []).map(x => x.slug))
  const cands = p.sexe === 'fm' ? [...parSexe.fm, ...parSexe.f, ...parSexe.m] : [...parSexe[p.sexe], ...parSexe.fm]
  const og = new Set(p.g)
  return cands.filter(x => !vus.has(x.slug) && x.slug !== p.slug)
    .map(x => {
      let s = 0
      for (const o of x.g) if (og.has(o)) s += 3
      s -= Math.abs(x.o - p.o) / 12
      s -= Math.abs(x.y - p.y) * 0.8
      if (x.i === p.i) s += 0.5
      return [s, x]
    })
    .sort((a, b) => b[0] - a[0]).slice(0, n).map(([, x]) => x)
}

// ---------------------------------------------------------------- fiche
function fiche(entrees) {
  const p = entrees[0]
  const autresGraphies = entrees.slice(1)
  const groupe = (groupes.get(p.gp) ?? []).filter(x => x.slug !== p.slug)
  const nTot = entrees.reduce((s, x) => s + x.n, 0)
  const fGroupe = (groupes.get(p.gp) ?? [p]).reduce((s, x) => s + x.f, 0)
  const rang = p.sexe === 'fm' ? p.rang.fm : p.rang[p.sexe]
  const origines = p.g.map(ORIGINE_F)
  const genre = GENRE[p.sexe]

  const phraseSens = p.m
    ? `${esc(p.l)} ${p.cf === 2 ? 'signifie' : 'signifierait'} « ${esc(p.m)} »${origines.length ? `, d’origine ${esc(liste(origines))}` : ''}.`
    : origines.length ? `${esc(p.l)} est un prénom d’origine ${esc(liste(origines))} ; sa signification n’est pas établie de façon fiable.` : `L’origine et la signification de ${esc(p.l)} ne sont pas établies de façon fiable : nous préférons ne rien inventer.`
  const doute = p.m && p.cf !== 2
    ? `<p class="doute">${p.cf === 1 ? 'Sens probable : les sources concordent en partie.' : 'Sens incertain : les sources divergent ou sont rares.'}</p>` : ''

  const ecole = fGroupe / 10000 * 200
  const phraseClasse = ecole >= 1
    ? `Dans une école de 200 enfants nés ces années-là, on compterait en moyenne <b>${dec(ecole)}</b> ${esc(p.l)}${groupe.length ? ' en comptant les graphies qui se prononcent pareil' : ''}.`
    : `Dans des écoles de 200 enfants nés ces années-là, on trouverait en moyenne un${p.sexe === 'f' ? 'e' : ''} ${esc(p.l)} toutes les <b>${1 / ecole < 10 ? dec(1 / ecole) : nf(1 / ecole)}</b> écoles${groupe.length ? ', toutes graphies confondues' : ''}.`

  const pic = p.p && p.p < AN0 ? `Depuis 1900, son année record reste ${p.p}.` : p.p ? `Ce prénom a atteint son pic en ${p.p}.` : ''
  const titre = p.m
    ? `${p.l} : signification, origine et popularité du prénom`
    : `${p.l} : origine et popularité du prénom`
  const fiable = p.n >= SEUIL_TENDANCE
  const parAn = Math.max(1, Math.round(p.n / 3))
  const description = descriptionFiche({
    nom: p.l, genre, origines, sens: p.m,
    chiffre: `${nf(nTot)} naissances en France de ${AN1 - 2} à ${AN1}`,
    tendance: fiable ? `, tendance ${tendanceMot(p.t)}` : ''
  })

  // L'essentiel d'abord, en haut : le sens, le genre, l'origine. Les phrases
  // longues restent plus bas, pour qui veut le détail.
  const sensTete = p.m
    ? `<p class="sens">« ${esc(p.m)} »${p.cf === 2 ? '' : `<small>${p.cf === 1 ? 'sens probable' : 'sens incertain'}</small>`}</p>` : ''
  const etiquettes = [`Prénom ${genre}`, ...(origines.length ? [`Origine ${liste(origines)}`] : []),
    ...(p.rv ? ['Prénom rétro qui revient'] : [])]
  // La popularité en trois faits, pas en un paragraphe.
  const faits = [pic, fiable
    ? `Sur les dernières années, ${esc(p.l)} est ${tendanceMot(p.t)} (${p.t > 0 ? '+' : ''}${dec(p.t)} % par an).`
    : `Avec environ ${nf(parAn)} bébé${parAn > 1 ? 's' : ''} par an, ${esc(p.l)} reste trop peu donné pour dessiner une tendance fiable : l’INSEE arrondit chaque année à 5.`,
  phraseClasse].filter(Boolean)
  const graphies = [...autresGraphies, ...groupe.filter(x => !autresGraphies.includes(x))].slice(0, 20)
  const lettre = lettreDe(p)
  // Les classements où il figure (avec son rang), puis ses origines et sa
  // lettre : de la fiche, on rejoint toujours une liste.
  const classe = rangs.get(p.slug) ?? []
  const voir = [
    ...classe.map(({ L, rang }) => `<li><a href="${L.chemin}"><b>${rang}<sup>${rang === 1 ? 'er' : 'e'}</sup></b><span>${esc(L.phrase)}</span></a></li>`),
    ...p.g.map(o => listes.find(L => L.origine === o)).filter(L => L && !classe.some(r => r.L === L))
      .map(L => `<li><a href="${L.chemin}"><b aria-hidden="true">→</b><span>Les prénoms d’origine ${esc(ORIGINE_F(L.origine))}</span></a></li>`),
    `<li><a href="/prenoms/lettre/${lettre}/"><b aria-hidden="true">${lettre.toUpperCase()}</b><span>Tous les prénoms en ${lettre.toUpperCase()}</span></a></li>`
  ]

  const corps = `
<section class="hero">${h1(p.l)}${sensTete}
<ul class="etiquettes">${etiquettes.map(e => `<li>${esc(e)}</li>`).join('')}</ul></section>

<div class="chiffres">
<div><b>${nf(nTot)}</b><span>naissances en <span class="nw">${AN1 - 2}-${AN1}</span></span></div>
<div><b>${unSur(p.f)}</b><span>en France, filles et garçons</span></div>
${rang <= 2000 ? `<div><b>${rang}<sup>${rang === 1 ? 'er' : 'e'}</sup></b><span>prénom ${p.sexe === 'fm' ? 'le plus donné' : p.sexe === 'f' ? 'féminin' : 'masculin'}</span></div>` : ''}
${fiable
  ? `<div><b>${p.t > 0 ? '+' : p.t < 0 ? '−' : ''}${dec(Math.abs(p.t))} %/an</b><span>tendance récente : ${tendanceMot(p.t)}</span></div>`
  : `<div><b>≈ ${nf(parAn)}</b><span>bébé${parAn > 1 ? 's' : ''} par an</span></div>`}
<div><b>${nf(p.o)}/100</b><span>originalité</span></div>
</div>

<section class="bloc r"><h2>Signification et origine de ${esc(p.l)}</h2>
<div class="carte"><p>${phraseSens}</p>${doute}</div></section>

<section class="bloc r"><h2>Popularité de ${esc(p.l)} depuis ${p.sr || !p.nb ? AN0 : B0}</h2>
<div class="popularite"><figure class="carte graphe">${p.sr ? courbe(p) : barres(p)}
<figcaption>${p.sr ? 'Naissances pour 10 000 bébés nés en France, année par année (INSEE).' : 'Naissances par an en France, arrondies à 5 par l’INSEE.'}</figcaption></figure>
<ul class="faits">${faits.map(f => `<li><span>${f}</span></li>`).join('')}</ul></div></section>

${graphies.length ? `<section class="bloc r"><h2>Même prononciation, autres graphies</h2>
<ul class="puces">${graphies.map(x =>
  aPage(x) && x.slug !== p.slug ? `<li><a href="${url(x)}">${esc(x.l)} <small>${nf(x.n)}</small></a></li>` : `<li><span>${esc(x.l)} <small>${nf(x.n)}</small></span></li>`).join('')}</ul>
<p class="doute">Nombre de naissances ${AN1 - 2}-${AN1}. À l’école, on les entend pareil : c’est ce total qui compte pour savoir si l’enfant sera seul à porter son prénom.</p></section>` : ''}

${p.dm.length ? `<section class="bloc r"><h2>Diminutifs</h2><ul class="puces">${p.dm.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></section>` : ''}

${cta(p)}

<section class="bloc r"><h2>Prénoms proches de ${esc(p.l)}</h2>
<ul class="puces">${proches(p).map(x => `<li><a href="${url(x)}">${esc(x.l)}</a></li>`).join('')}</ul></section>

<section class="bloc r"><h2>${classe.length ? `${esc(p.l)} dans les classements` : 'À voir aussi'}</h2>
<ul class="rangs">${voir.join('')}</ul></section>
`
  return page({
    chemin: url(p), titre, description, corps, indexer: !mince(p), genre: genreDe(p.sexe),
    fil: [{ n: `Lettre ${lettre.toUpperCase()}`, u: `/prenoms/lettre/${lettre}/` }, { n: p.l, u: url(p) }]
  })
}

/**
 * Offrir : sur les pages de classement, juste après le tableau. Qui cherche
 * « prénoms de fille tendance » n'est pas toujours le futur parent — c'est
 * souvent la sœur, l'amie, la grand-mère qui prépare un cadeau de naissance.
 * En tête de page, il repoussait le classement sous la ligne de flottaison :
 * on vient pour la liste, l'offre arrive une fois qu'on l'a lue.
 */
const offrir = `<aside class="offrir r" aria-label="Offrir ${MARQUE}"><div><b>Un bébé en route autour de vous&nbsp;?</b>
<span>Offrez ${MARQUE} aux futurs parents : une liste débloquée pour choisir le prénom à deux. ${esc(PRIX)}, un lien et un code, sans compte.</span></div>
<a class="b p" rel="nofollow" href="/offrir">Offrir</a></aside>`

// ---------------------------------------------------------------- listes
/**
 * Le classement : un vrai tableau, dans une carte qui défile d'elle-même si
 * un écran très étroit ne le contient pas. Les en-têtes tiennent en un mot
 * (« Naissances 2023-2025 » débordait à droite sur téléphone) : les années
 * et l'unité sont dans la légende, lue avant le tableau.
 */
function tableau(xs, colonne = 'tendance') {
  const tend = t => `<span class="${t > 0 ? 'monte' : t < 0 ? 'baisse' : ''}">${t > 0 ? '+' : ''}${dec(t)} %</span>`
  const legende = `Naissances en France de ${AN1 - 2} à ${AN1} (INSEE)${colonne === 'tendance'
    ? ' ; tendance : évolution moyenne par an sur les dernières années.' : ' ; originalité sur 100 : plus elle est haute, plus le prénom est rare.'}`
  return `<div class="tableau r"><table><caption>${legende}</caption>
<thead><tr><th scope="col" class="rg">#</th><th scope="col">Prénom</th><th scope="col" class="o">Origine</th><th scope="col" class="n">Naissances</th><th scope="col" class="n">${colonne === 'tendance' ? 'Tendance' : 'Originalité'}</th></tr></thead><tbody>
${xs.map((x, i) => `<tr><td class="rg">${i + 1}</td><td><a href="${url(x)}"><b>${esc(x.l)}</b></a>${x.m ? `<small>${esc(x.m)}</small>` : ''}</td><td class="o">${esc(liste(x.g.map(ORIGINE_LIB)))}</td><td class="n">${nf(x.n)}</td><td class="n">${colonne === 'tendance' ? tend(x.t) : `${nf(x.o)}/100`}</td></tr>`).join('')}
</tbody></table></div>`
}

const tetes = [...pages.values()].map(e => e[0])
/** Une graphie par prononciation, la plus donnée : dans une sélection, Sayf
 *  et Saïf sont un seul prénom (la fiche montre les autres graphies). */
const unParSon = xs => { const vus = new Set(); return xs.filter(x => !vus.has(x.gp) && vus.add(x.gp)) }
const sexeOk = (x, s) => x.sexe === s || x.sexe === 'fm'
const listes = []

for (const [s, mot] of [['f', 'filles'], ['m', 'garcons']]) {
  const nom = genreNom[s]
  // Tendances : assez de volume pour que la pente veuille dire quelque chose.
  const tend = unParSon(tetes.filter(x => sexeOk(x, s) && x.n >= 150 && x.t > 0).sort((a, b) => b.t - a.t)).slice(0, 60)
  listes.push({
    chemin: `/prenoms/tendance/${mot}/`, type: 'tendance', sexe: s,
    titre: `Prénoms de ${nom} tendance en ${AN1 + 1} : ceux qui montent vraiment`,
    description: `Les 60 prénoms de ${nom} qui progressent le plus en France, calculés sur les naissances INSEE jusqu’en ${AN1}, pas une sélection au goût du jour.`,
    h1: `Prénoms de ${nom} qui montent`,
    sous: `Les ${tend.length} prénoms de ${nom} qui progressent le plus en France.`,
    phrase: `des prénoms de ${nom} qui montent`,
    intro: `Classés par progression annuelle sur les dernières années de naissances INSEE, parmi les prénoms donnés au moins 150 fois de ${AN1 - 2} à ${AN1}. Un prénom qui monte vite peut devenir courant d’ici l’entrée à l’école : regardez aussi le nombre de naissances.`,
    xs: tend, col: 'tendance'
  })
  // Rares mais portables : originaux, avec un sens connu, pas des graphies d'un seul foyer.
  const rares = unParSon(tetes.filter(x => sexeOk(x, s) && !x.q && x.o >= 60 && x.m && x.cf === 2).sort((a, b) => b.n - a.n)).slice(0, 80)
  listes.push({
    chemin: `/prenoms/rares/${mot}/`, type: 'rares', sexe: s,
    titre: `Prénoms de ${nom} rares (et qui ont du sens) : liste ${AN1 + 1}`,
    description: `80 prénoms de ${nom} rares en France mais portés : originalité mesurée sur les naissances INSEE, signification vérifiée.`,
    h1: `Prénoms de ${nom} rares`,
    sous: `${rares.length} prénoms de ${nom} peu donnés, mais portés, dont le sens est établi.`,
    phrase: `des prénoms de ${nom} rares`,
    intro: `Des prénoms peu donnés en France (originalité ≥ 60/100, mesurée sur les naissances INSEE), dont la signification est établie. Classés du plus porté au plus confidentiel.`,
    xs: rares, col: 'originalite'
  })
  const pop = tetes.filter(x => sexeOk(x, s)).sort((a, b) => b.n - a.n).slice(0, 100)
  listes.push({
    chemin: `/prenoms/populaires/${mot}/`, type: 'populaires', sexe: s,
    titre: `Les 100 prénoms de ${nom} les plus donnés en France (${AN1 - 2}-${AN1})`,
    description: `Classement des prénoms de ${nom} les plus donnés en France selon l’INSEE, avec origine, signification et tendance.`,
    h1: `Les 100 prénoms de ${nom} les plus donnés`,
    sous: `Le classement des naissances en France, de ${AN1 - 2} à ${AN1}.`,
    phrase: `des prénoms de ${nom} les plus donnés`,
    intro: `Naissances cumulées de ${AN1 - 2} à ${AN1}, source INSEE. Un prénom mixte compte dans les deux classements.`,
    xs: pop, col: 'tendance'
  })
}

const origines = [...new Set(tetes.flatMap(x => x.g))].sort((a, b) => a.localeCompare(b, 'fr'))
for (const o of origines) {
  const xs = tetes.filter(x => x.g.includes(o)).sort((a, b) => b.n - a.n).slice(0, 150)
  if (xs.length < 8) continue
  const lib = ORIGINE_F(o)
  listes.push({
    chemin: `/prenoms/origine/${slugOrigine(o)}/`, type: 'origine',
    titre: `Prénoms d’origine ${lib} : liste, signification et popularité`,
    description: `Les prénoms d’origine ${lib} donnés en France, filles et garçons, avec leur signification et leur nombre de naissances.`,
    h1: `Prénoms d’origine ${lib}`,
    sous: `Les ${xs.length} prénoms d’origine ${lib} les plus donnés en France, filles et garçons.`,
    phrase: `des prénoms d’origine ${lib}`,
    intro: `Classés par naissances de ${AN1 - 2} à ${AN1}. L’origine indiquée est la racine la plus ancienne connue, pas la langue par laquelle le prénom est arrivé en France.`,
    xs, col: 'tendance', origine: o,
    // Pour la page des origines : combien de prénoms en tout, pas seulement les 150 de la liste.
    total: tetes.filter(x => x.g.includes(o)).length
  })
}

// ---------------------------------------------------------------- écriture
const sortie = chemin => resolve(SORTIE, '.' + chemin, 'index.html')
function ecrire(chemin, html) {
  const f = sortie(chemin)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, html)
}

rmSync(resolve(SORTIE, 'prenom'), { recursive: true, force: true })
rmSync(resolve(SORTIE, 'prenoms'), { recursive: true, force: true })
rmSync(resolve(SORTIE, '.' + APP), { recursive: true, force: true })

/** Où chaque prénom figure, et à quel rang : la fiche le dit, et y mène. */
const ORDRE = { populaires: 0, tendance: 1, rares: 2, origine: 3 }
const rangs = new Map()
for (const L of listes) {
  L.xs.forEach((x, i) => { const r = rangs.get(x.slug) ?? []; r.push({ L, rang: i + 1 }); rangs.set(x.slug, r) })
}
for (const r of rangs.values()) r.sort((a, b) => ORDRE[a.L.type] - ORDRE[b.L.type] || a.rang - b.rang)

const urls = []
for (const e of pages.values()) {
  ecrire(url(e[0]), fiche(e))
  if (!mince(e[0])) urls.push(url(e[0]))
}

// Les origines, de la plus représentée à la plus rare : c'est l'ordre dans
// lequel on les cherche (latine avant finno-ougrienne), pas l'alphabet.
const listesOrigines = listes.filter(L => L.origine).sort((a, b) => b.total - a.total)
const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1)
const carteOrigine = L => `<li><a href="${L.chemin}"><b>${esc(majuscule(ORIGINE_F(L.origine)))}</b><span>${nf(L.total)} prénoms</span><small>${L.xs.slice(0, 3).map(x => esc(x.l)).join(', ')}</small></a></li>`

for (const L of listes) {
  // Filles ou garçons : le même classement, d'un geste.
  const bascule = L.sexe ? `<nav class="bascule" aria-label="Filles ou garçons">${[['f', 'Filles'], ['m', 'Garçons']].map(([s, t]) =>
    `<a href="${listes.find(x => x.type === L.type && x.sexe === s).chemin}"${actuel(s === L.sexe)}>${t}</a>`).join('')}</nav>` : ''
  const autresOrigines = L.origine ? `<section class="bloc r"><h2>Autres origines</h2><ul class="puces">${listesOrigines.filter(x => x !== L)
    .map(x => `<li><a href="${x.chemin}">${esc(ORIGINE_LIB(x.origine))} <small>${nf(x.total)}</small></a></li>`).join('')}</ul></section>` : ''
  ecrire(L.chemin, page({
    chemin: L.chemin, titre: L.titre, description: L.description,
    rubrique: L.origine ? 'origines' : L.type, genre: genreDe(L.sexe),
    fil: L.origine ? [{ n: 'Origines', u: '/prenoms/origines/' }, { n: L.h1, u: L.chemin }] : [{ n: L.h1, u: L.chemin }],
    corps: `<section class="hero court">${h1(L.h1)}<p class="sous">${esc(L.sous)}</p></section>
${bascule}${tableau(L.xs, L.col)}
<p class="doute">${esc(L.intro)}</p>
${autresOrigines}
${offrir}
${cta(null)}`
  }))
  urls.push(L.chemin)
}

// Les origines, toutes, avec de quoi reconnaître chacune.
ecrire('/prenoms/origines/', page({
  chemin: '/prenoms/origines/', rubrique: 'origines',
  fil: [{ n: 'Origines', u: '/prenoms/origines/' }],
  titre: `Prénoms par origine : ${listesOrigines.length} origines, signification et popularité`,
  description: `Les prénoms donnés en France classés par origine, de la ${ORIGINE_F(listesOrigines[0].origine)} à la ${ORIGINE_F(listesOrigines.at(-1).origine)} : signification, popularité et naissances INSEE.`,
  corps: `<section class="hero court">${h1('Prénoms par origine')}<p class="sous">${listesOrigines.length} origines, de la plus représentée à la plus rare. L’origine est la racine la plus ancienne connue du prénom.</p></section>
<ul class="origines r">${listesOrigines.map(carteOrigine).join('')}</ul>
${cta(null)}`
}))
urls.push('/prenoms/origines/')

const lettres = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(l => tetes.some(x => lettreDe(x) === l))
const alphabet = courante => `<nav aria-label="Prénoms par lettre"><ul class="alphabet">${lettres.map(l =>
  `<li><a href="/prenoms/lettre/${l}/"${actuel(l === courante)} aria-label="Prénoms en ${l.toUpperCase()}">${l.toUpperCase()}</a></li>`).join('')}</ul></nav>`
/** En gras dans les pages par lettre : de quoi repérer les prénoms courants
 *  au milieu des rares, sans ouvrir chaque fiche. */
const COURANT = 500
lettres.forEach((l, i) => {
  const xs = tetes.filter(x => lettreDe(x) === l).sort((a, b) => a.l.localeCompare(b.l, 'fr'))
  const bloc = (s, t) => {
    const ys = xs.filter(x => sexeOk(x, s))
    return ys.length ? `<section class="bloc r"><h2>${t} <small>${ys.length}</small></h2><ul class="noms">${ys.map(x =>
      `<li><a href="${url(x)}"${x.n >= COURANT ? ' class="courant"' : ''}>${esc(x.l)}</a></li>`).join('')}</ul></section>` : ''
  }
  const [avant, apres] = [lettres[i - 1], lettres[i + 1]]
  const chemin = `/prenoms/lettre/${l}/`
  const L = l.toUpperCase()
  ecrire(chemin, page({
    chemin, rubrique: 'lettres', fil: [{ n: `Lettre ${L}`, u: chemin }],
    titre: `Prénoms en ${L} : ${xs.length} prénoms de fille et de garçon`,
    description: `Tous les prénoms commençant par ${L} donnés en France : filles, garçons et mixtes, avec signification, origine et popularité.`,
    corps: `<section class="hero court">${h1(`Prénoms en ${L}`)}<p class="sous">${xs.length} prénoms donnés en France. En gras, les plus courants : plus de ${COURANT} naissances de ${AN1 - 2} à ${AN1}.</p></section>
${alphabet(l)}
${bloc('f', 'Filles')}${bloc('m', 'Garçons')}
<nav class="voisins" aria-label="Lettres voisines">${avant ? `<a href="/prenoms/lettre/${avant}/" rel="prev">← Prénoms en ${avant.toUpperCase()}</a>` : '<span></span>'}${apres ? `<a href="/prenoms/lettre/${apres}/" rel="next">Prénoms en ${apres.toUpperCase()} →</a>` : ''}</nav>`
  }))
  urls.push(chemin)
})

/**
 * L'accueil des prénoms : les classements d'abord, chacun avec ses trois
 * premiers prénoms — on voit ce qu'il contient avant de cliquer —, puis les
 * origines (les plus représentées, avec des exemples), puis l'alphabet.
 */
const CLASSEMENTS = [
  { type: 'tendance', titre: 'Qui montent', desc: `La plus forte progression par an, parmi les prénoms donnés au moins 150 fois de ${AN1 - 2} à ${AN1}.`,
    stat: x => `${x.t > 0 ? '+' : ''}${dec(x.t, 0)} %`, nom: 'qui montent' },
  { type: 'populaires', titre: 'Les plus donnés', desc: `Le top 100 des naissances en France, de ${AN1 - 2} à ${AN1}.`,
    stat: x => nf(x.n), nom: 'les plus donnés' },
  { type: 'rares', titre: 'Rares, et qui ont du sens', desc: 'Peu donnés mais portés, avec une signification établie.',
    stat: () => '', nom: 'rares' }
]
const carteClassement = C => {
  const colonne = (s, t) => {
    const L = listes.find(x => x.type === C.type && x.sexe === s)
    return `<div><p class="genre">${t}</p><ol class="apercu">${L.xs.slice(0, 3).map(x =>
      `<li><a href="${url(x)}">${esc(x.l)}</a>${C.stat(x) ? `<small>${C.stat(x)}</small>` : ''}</li>`).join('')}</ol>
<a class="suite" href="${L.chemin}">Les ${L.xs.length}<span class="vh"> prénoms de ${genreNom[s]} ${C.nom}</span></a></div>`
  }
  return `<article class="carte classement r"><h3>${C.titre}</h3><p>${C.desc}</p><div class="duo">${colonne('f', 'Filles')}${colonne('m', 'Garçons')}</div></article>`
}
ecrire('/prenoms/', page({
  chemin: '/prenoms/',
  titre: `Prénoms : ${nf(pages.size)} fiches avec signification, origine et popularité`,
  description: `Signification, origine et courbe de popularité de ${nf(pages.size)} prénoms donnés en France, d’après les naissances INSEE. Tendances, prénoms rares, par origine.`,
  corps: `<section class="hero">${h1('Trouver un prénom')}<p class="sous">${nf(pages.size)} prénoms donnés en France, avec leurs vrais chiffres : le sens, l’origine, et les naissances depuis ${AN0}.</p></section>
<section class="bloc"><h2>Les classements</h2><div class="classements">${CLASSEMENTS.map(carteClassement).join('')}</div></section>
<section class="bloc r"><h2>Par origine</h2><ul class="origines six">${listesOrigines.slice(0, 6).map(carteOrigine).join('')}</ul>
<p class="suite-bloc"><a class="suite" href="/prenoms/origines/">Les ${listesOrigines.length} origines</a></p></section>
<section class="bloc r" id="lettres"><h2>Par lettre</h2>${alphabet(null)}</section>
${offrir}
${cta(null)}`
}))
urls.unshift('/prenoms/')

// ---------------------------------------------------------------- l'application
/**
 * La page qui dit ce qu'est babyNamed. La racine « / » est l'application :
 * une coquille JavaScript, vide pour un robot qui n'execute pas le JS — ce
 * qui est le cas de la plupart des robots d'IA (GPTBot, ClaudeBot,
 * PerplexityBot…). Sans cette page, rien de lisible ne disait ce que fait
 * l'app, combien elle coute, ni ce qu'elle fait des donnees.
 *
 * Chaque affirmation ici doit rester vraie : les limites du gratuit sont lues
 * dans le schema, le prix dans NUXT_PUBLIC_PRIX_LISTE.
 */
const FAQ = [
  ['Mon ou ma partenaire voit-il mes votes ?',
   'Seulement sur les prénoms qu’il ou elle a déjà jugés soi-même. Avant, rien : c’est le vote à l’aveugle. Un « non » n’est jamais annoncé, et personne ne sait qui a posé un veto.'],
  ['Peut-on offrir babyNamed ?',
   `Oui, sans créer de compte : un code cadeau à ${PRIX} TTC débloque une liste, celle que les parents ont déjà commencée ou une nouvelle. Vous recevez un lien et un code à transmettre, valables ${CADEAU_ANS} ans, avec votre nom et un mot si vous le souhaitez.`],
  ['Et les prénoms déjà pris dans la famille ?',
   `Ajoutez-les une fois à la liste « Déjà pris » : la cousine, le fils des amis, quelqu’un qu’on connaît trop. Ils sortent du tri pour tout le monde, avec toutes leurs graphies (Chloé emporte Cloé et Khloé), sans limite. Pour un prénom qu’on préfère ne pas expliquer, chacun a aussi ${BLOCAGES} vetos.`],
  ['Faut-il installer une application ?',
   'Non. babyNamed s’ouvre dans le navigateur, sur téléphone comme sur ordinateur, et s’ajoute à l’écran d’accueil si vous le souhaitez. Votre partenaire rejoint votre liste par un simple lien.'],
  ['Est-ce vraiment gratuit ?',
   `Oui : on trie, on trouve ses accords et on choisit sans rien payer : ${QUOTA_DEPART} prénoms pour commencer, puis ${QUOTA_JOUR} par jour, sans jamais être bloqué. L’option à ${PRIX} TTC débloque une liste pour la vie, pour tous ses membres.`],
  ['D’où viennent les chiffres ?',
   `Du fichier des prénoms de l’INSEE : les naissances en France de ${AN0} à ${AN1}. Les significations viennent du Wiktionnaire, relues ; quand un sens est incertain, la fiche le dit au lieu de l’inventer.`],
  ['Peut-on être plus de deux ?',
   'Oui. Chacun juge de son côté, et un prénom n’est « en commun » que si tout le monde l’a jugé et que personne n’a dit non. Avec l’option, les grands-parents peuvent observer, donner leur avis et mettre un cœur sur vos prénoms en commun, sans droit de veto.']
]

ecrire(APP, page({
  chemin: APP, appel: { texte: 'Ouvrir l’app', href: '/' },
  ariane: [{ n: MARQUE, u: '/' }, { n: 'Choisir à deux', u: APP }],
  titre: `Choisir un prénom à deux, sans s’influencer : l’application ${MARQUE}`,
  description: `Chacun trie les prénoms de son côté, sans voir l’avis de l’autre ; ${MARQUE} ne montre que ceux que vous aimez tous les deux. Gratuit, sans mot de passe.`,
  jsonld: [{
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: MARQUE, url: `${SITE}/`, inLanguage: 'fr-FR',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Navigateur web (téléphone et ordinateur)',
    description: `Application pour choisir le prénom d’un bébé à deux : chacun juge les prénoms à l’aveugle, l’application montre les accords. ${nf(d.n)} prénoms, naissances INSEE de ${AN0} à ${AN1}.`,
    isAccessibleForFree: true,
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'EUR', name: 'Gratuit' },
      { '@type': 'Offer', price: String(PRIX_NOMBRE), priceCurrency: 'EUR',
        name: 'Déblocage d’une liste', description: 'Débloque la liste pour la vie, pour tous ses membres' }
    ]
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, r]) => ({ '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: r } }))
  }],
  corps: `<section class="hero">${h1('Choisir un prénom à deux, sans s’influencer')}
<p class="sous">${MARQUE} trouve les prénoms sur lesquels vous êtes d’accord, sans que l’un décide pour l’autre.</p>
<a class="b" href="/">Commencer gratuitement</a></section>

<p class="chapo">${MARQUE} est une application web gratuite pour choisir le prénom de votre bébé à deux. Chacun juge les prénoms de son côté, sans voir l’avis de l’autre ; l’application ne vous montre que ceux que vous aimez tous les deux.</p>

<div class="chiffres">
<div><b>${nf(d.n)}</b><span>prénoms, naissances INSEE de ${AN0} à ${AN1}</span></div>
<div><b>0</b><span>mot de passe : passkey ou lien par e-mail</span></div>
<div><b>Gratuit</b><span>option à ${esc(PRIX)} par liste, pour la vie</span></div>
</div>

<section class="bloc r"><h2>Comment ça marche</h2>
<ol class="etapes">
<li><b>Vous créez une liste</b> en quelques questions : fille, garçon ou les deux, répandu ou rare, court ou long, les origines. Tout se change ensuite.</li>
<li><b>Chacun trie de son côté</b> : oui, non ou neutre, d’un geste, un prénom à la fois. Les graphies qui se prononcent pareil (Nélia, Nelya…) tiennent sur une seule carte.</li>
<li><b>Vous ne voyez l’avis de l’autre qu’après avoir donné le vôtre.</b> Un refus n’est jamais annoncé.</li>
<li><b>Vos accords apparaissent</b> : les prénoms que vous aimez tous les deux, à classer, et ceux qui vous divisent, à revoir quand vous voulez.</li>
</ol></section>

<section class="bloc r"><h2>Pourquoi à l’aveugle</h2>
<p>À deux, le premier qui dit « j’adore » influence l’autre, et un « non » lâché trop vite enterre un prénom que l’autre aimait. En jugeant séparément, chacun dit ce qu’il pense vraiment : l’accord qui en sort est le vôtre, pas celui du plus rapide.</p></section>

<section class="bloc r"><h2>Des chiffres, pas une liste à la mode</h2>
<p>Chaque prénom a sa <a href="/prenoms/">fiche</a> : naissances depuis ${AN0}, tendance, rang, signification avec son niveau de certitude, graphies qui se prononcent pareil. Un prénom rare qui monte vite finit souvent en double dans la classe : l’application le signale.</p></section>

<section class="bloc r"><h2>Ce qui est gratuit, ce qui est payant</h2>
<div class="offres">
<div class="carte offre"><span class="prix">Gratuit</span>
<p>${QUOTA_DEPART} prénoms pour commencer, puis ${QUOTA_JOUR} par jour, sans jamais être bloqué ; tout le catalogue, la recherche, les fiches, les accords et le classement, le veto sur un prénom, le deuxième parent.</p></div>
<div class="carte offre plus"><span class="prix">${esc(PRIX)} <small>TTC par liste</small></span>
<p><b>Débloquée pour la vie</b>, pour tous ses membres : le tri sans limite, l’essai avec votre nom de famille, le nombre d’enfants qui porteront le prénom dans une classe, le portrait de vos goûts, l’explication de vos désaccords, et les observateurs (les grands-parents donnent leur avis sans rien bloquer).</p></div>
</div>
<p class="doute"><b>À offrir</b> : le même déblocage en cadeau, sans compte : un lien et un code à transmettre à des futurs parents, valables ${CADEAU_ANS} ans. <a href="/offrir" rel="nofollow">Offrir ${MARQUE}</a></p></section>

<section class="bloc r"><h2>Vos données</h2>
<div class="carte"><p>Un prénom et une adresse e-mail, confirmée par un code, pour commencer ; aucun mot de passe : on revient avec un lien reçu par e-mail ou une passkey (Face ID, empreinte). Aucune publicité, aucune mesure d’audience, aucun cookie tiers. Votre compte s’efface en un geste, et vos données se téléchargent à tout moment. <a href="/confidentialite">Ce qu’on garde et pourquoi</a>.</p></div></section>

<section class="bloc r"><h2>Questions fréquentes</h2>
<div class="faq">
${FAQ.map(([q, r], i) => `<details${i === 0 ? ' open' : ''}><summary><h3>${esc(q)}</h3></summary><p>${esc(r)}</p></details>`).join('\n')}
</div></section>

<section class="cta r">
<h2>Commencer maintenant</h2>
<p>Créez votre liste en une minute, puis envoyez le lien à l’autre parent.</p>
<a class="b" href="/">Commencer gratuitement</a>
</section>`
}))
urls.unshift(APP)

// ---------------------------------------------------------------- llms.txt
/**
 * llms.txt (llmstxt.org) : un resume en Markdown, pour les assistants qui
 * vont le chercher. Aucun grand moteur ne s'engage a le lire : il ne remplace
 * ni la page de l'application ci-dessus, ni l'acces des robots d'IA au site
 * (robots.txt les laisse passer), ni les mentions de l'app ailleurs sur le
 * web. Il coute trois lignes et ne peut pas nuire.
 */
const premiere = s => tetes.filter(x => x.sexe === s).sort((a, b) => b.n - a.n)[0]
const [fille, garcon] = [premiere('f'), premiere('m')]
writeFileSync(resolve(SORTIE, 'llms.txt'), `# ${MARQUE}

> Application web française pour choisir le prénom de son bébé à deux, sans s’influencer : chacun juge les prénoms de son côté, à l’aveugle, et l’application ne montre que ceux que tout le monde aime. ${nf(d.n)} prénoms, avec les naissances INSEE en France de ${AN0} à ${AN1}.

- Gratuit : ${QUOTA_DEPART} prénoms pour commencer, puis ${QUOTA_JOUR} par jour, sans jamais être bloqué. Option à ${PRIX} TTC par liste, débloquée pour la vie, pour tous ses membres (tri sans limite, essai avec le nom de famille, projection dans une classe, explication des désaccords, observateurs). Elle s'offre aussi, sans compte : un code cadeau valable ${CADEAU_ANS} ans (${SITE}/offrir).
- Aucun mot de passe (passkey ou lien par e-mail, adresse facultative) ; aucune publicité, aucune mesure d’audience, aucun cookie tiers.
- Dans le navigateur, sur téléphone ou ordinateur, installable sur l’écran d’accueil ; l’autre parent rejoint la liste par un lien.
- Une fiche publique par prénom : signification (avec son niveau de certitude), origine, courbe des naissances depuis ${AN0}, tendance, graphies qui se prononcent pareil, prénoms proches.

## Application

- [Choisir un prénom à deux](${SITE}${APP}): fonctionnement, gratuit et payant, données personnelles, questions fréquentes
- [Ouvrir l’application](${SITE}/): l’application elle-même (JavaScript requis)

## Prénoms

- [Tous les prénoms](${SITE}/prenoms/): ${nf(pages.size)} fiches, par lettre, par origine, et les listes
- [Prénoms de filles qui montent](${SITE}/prenoms/tendance/filles/): les 60 plus fortes progressions
- [Prénoms de garçons qui montent](${SITE}/prenoms/tendance/garcons/): les 60 plus fortes progressions
- [Les 100 prénoms de filles les plus donnés](${SITE}/prenoms/populaires/filles/)
- [Les 100 prénoms de garçons les plus donnés](${SITE}/prenoms/populaires/garcons/)
- [Prénoms de filles rares](${SITE}/prenoms/rares/filles/): rares mais portés, au sens établi
- [Prénoms de garçons rares](${SITE}/prenoms/rares/garcons/): rares mais portés, au sens établi
- [Prénoms par origine](${SITE}/prenoms/origines/): ${listesOrigines.length} origines, de la plus représentée à la plus rare
- Exemples de fiches : [${fille.l}](${SITE}${url(fille)}), [${garcon.l}](${SITE}${url(garcon)})

## Optional

- [Plan du site](${SITE}/sitemap.xml): toutes les fiches
- [Confidentialité](${SITE}/confidentialite), [Conditions](${SITE}/conditions), [Mentions légales](${SITE}/mentions-legales): pages de l’application (JavaScript requis)
`)

// Sitemap et robots
writeFileSync(resolve(SORTIE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE}/</loc><lastmod>${MAJ}</lastmod></url>
${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${MAJ}</lastmod></url>`).join('\n')}
</urlset>
`)
writeFileSync(resolve(SORTIE, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /g/
Disallow: /api/
Disallow: /connexion
# Les liens des fiches vers l'app (/?ref=seo&prenom=…) : 7 000 variantes de
# la meme coquille JavaScript, rien a indexer.
Disallow: /?

Sitemap: ${SITE}/sitemap.xml
`)

console.log(`[seo] ${pages.size} fiches, ${listes.length + lettres.length + 2} listes, page de l’app, llms.txt, sitemap ${urls.length + 1} URL, domaine ${SITE}`)
