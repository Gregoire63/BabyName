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
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { construireRecherche, CLIENT as RECHERCHE_CLIENT } from './recherche.mjs'
import { construireFichesInsee } from './fiches-insee.mjs'

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
const MAJ = '2026-10-09'
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
    nb: c.nb?.[k] ? c.nb[k].map(x => x * 5) : null,
    fx: c.fx?.[k] ?? null, hf: !!c.hf?.[k]
  })
}
// Québec, Belgique, Suisse : d'où vient chaque chiffre « ailleurs » (badges).
const FX = d.fx_sources ?? []

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
/**
 * Ouverture PROGRESSIVE a Google. Un domaine neuf qui pousse 6 600 fiches d'un
 * coup est crawle lentement, et la plupart restent « detectees, non
 * indexees » : le budget part dans la longue traine au lieu des fiches qui ont
 * une vraie demande. Phase 1 : on n'indexe que les prenoms donnes aujourd'hui
 * (>= INDEX_NAISSANCES naissances sur 3 ans) ou qui ont ete courants (pic >=
 * INDEX_PIC pour 10 000 naissances une annee au moins depuis 1986 : Nathalie,
 * Kevin… qu'on cherche encore pour leur sens). Les autres restent en ligne,
 * noindex, follow, hors sitemap.
 * Pour elargir, quand la Search Console montre l'essentiel indexe : baisser
 * les seuils (ou SEO_INDEX_NAISSANCES / SEO_INDEX_PIC) et monter MAJ.
 *
 * ABANDONNE le 30/09/2026, seuils a 0 : la Search Console a donne tort a la
 * phase 1. Sur 24 h, 216 des 401 fiches vues dans Google etaient des fiches
 * que la phase 1 venait de passer en noindex (Maywen, Elyakim, Jaiden…) :
 * 54 % des impressions, a la position moyenne 16 contre 23 pour les autres.
 * Sur un prenom rare, la concurrence est faible et un domaine neuf se classe ;
 * c'est la ou il peut gagner. Seules les fiches minces restent en noindex.
 * Les seuils restent la, a 0, si le crawl venait a caler.
 */
const INDEX_NAISSANCES = Number(process.env.SEO_INDEX_NAISSANCES ?? 0)
const INDEX_PIC = Number(process.env.SEO_INDEX_PIC ?? 0)
const pic = p => (Array.isArray(p.sr) && p.sr.length ? Math.max(...p.sr) : 0)
const indexable = p => !mince(p) && (p.n >= INDEX_NAISSANCES || pic(p) >= INDEX_PIC)
/**
 * IndexNow (Bing, Yandex, Seznam, Naver ; Bing alimente aussi ChatGPT
 * Search). La cle n'est pas un secret : publiee a la racine du site, elle
 * prouve que le domaine est a nous. scripts/indexnow.mjs la relit ici et
 * envoie, apres chaque deploiement, les URL dont le HTML a change.
 */
const INDEXNOW_CLE = '0f5cbc8e26a39832c708ce22ae3b9d1d'
const url = p => `/prenom/${p.slug}/`
/**
 * L'ecriture arabe des prenoms d'origine arabe (pipeline/ecriture_arabe.py) :
 * on cherche « Jad en arabe », « Reem signification islam ». Une graphie sans
 * entree prend celle d'un prenom d'origine arabe qui se prononce pareil
 * (Nour -> Noor).
 */
const ARABE_FICHIER = resolve(RACINE, 'scripts/donnees/ecriture-arabe.json')
const ARABE = existsSync(ARABE_FICHIER) ? JSON.parse(readFileSync(ARABE_FICHIER, 'utf8')) : {}
const arabeDe = (() => {
  const parGroupe = new Map()
  for (const p of tous) if (ARABE[p.l] && p.g.includes('arabe') && !parGroupe.has(p.gp)) parGroupe.set(p.gp, ARABE[p.l])
  return p => p.g.includes('arabe') ? (ARABE[p.l] ?? parGroupe.get(p.gp) ?? null) : null
})()

// ---------------------------------------------------------------- mise en forme
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const nf = x => Math.round(x).toLocaleString('fr-FR')
const dec = (x, n = 1) => x.toLocaleString('fr-FR', { maximumFractionDigits: n, minimumFractionDigits: 0 })
/**
 * Une tendance en % : on ARRONDIT d'abord, et le signe comme la couleur
 * suivent l'arrondi. Une pente de -0,03 s'affichait « -0 % » en rouge ; elle
 * donne « 0 % », en gris.
 */
const arrondi = (t, n = 1) => { const r = Number(t.toFixed(n)); return r === 0 ? 0 : r }
const pctTendance = (t, n = 1) => { const r = arrondi(t, n); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${dec(Math.abs(r), n)}` }
const classeTendance = (t, n = 1) => { const r = arrondi(t, n); return r > 0 ? 'monte' : r < 0 ? 'baisse' : 'nul' }
/** Les deux formes (1 décimale / entier), chacune avec SA couleur : -0,4 est
 *  rouge en long mais « 0 % » gris en court. Le CSS choisit selon l'écran. */
const tendanceHtml = t => {
  const long = `<span class="${classeTendance(t)}">${pctTendance(t)}\u202f%</span>`
  const court = `<span class="${classeTendance(t, 0)}">${pctTendance(t, 0)}\u202f%</span>`
  return pctTendance(t) === pctTendance(t, 0) ? long
    : `<span class="v-long">${long}</span><span class="v-court">${court}</span>`
}
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
const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1)
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
// Gloock (OFL, app/assets/fonts/OFL-gloock.txt) : les prénoms et les titres.
// Un seul poids ; le texte reste en Nunito, comme dans l'app.
for (const [famille, fichier, poidsListe] of [['Nunito', 'nunito', [500, 800]], ['Gloock', 'gloock', [400]]]) {
  for (const poids of poidsListe) {
    for (const [jeu, plage] of Object.entries(PLAGES)) {
      const octets = readFileSync(resolve(POLICES, `${fichier}-${jeu}-${poids}-normal.woff2`))
      const nom = `${fichier}-${jeu}-${poids}.${createHash('sha256').update(octets).digest('hex').slice(0, 10)}.woff2`
      writeFileSync(resolve(SORTIE, 'statique', nom), octets)
      polices.push({ famille, poids, jeu, plage, url: `/statique/${nom}` })
    }
  }
}
const FONTES = polices.map(p => `@font-face{font-family:${p.famille};font-style:normal;font-weight:${p.poids};font-display:optional;src:url(${p.url}) format("woff2");unicode-range:${p.plage}}`).join('')
const PRECHARGE = polices.filter(p => p.jeu === 'latin')
  .map(p => `<link rel="preload" href="${p.url}" as="font" type="font/woff2" crossorigin>`).join('\n')

// ---------------------------------------------------------------- recherche
/**
 * La recherche de prénom : un champ en grand sur /prenoms/ et sur sa page à
 * elle (/chercher-un-prenom/), une loupe dans l'en-tête de TOUTES les pages.
 * Index et moteur dans /statique/ (scripts/recherche.mjs, recherche-client.js).
 */
const CHERCHER = '/chercher-un-prenom/'
const enStatique = (nom, ext, contenu) => {
  const f = `${nom}.${createHash('sha256').update(contenu).digest('hex').slice(0, 10)}.${ext}`
  writeFileSync(resolve(SORTIE, 'statique', f), contenu)
  return `/statique/${f}`
}
const RECH = construireRecherche({ tous, pages, slugDe, racine: RACINE })
const RECHERCHE_JS = enStatique('recherche', 'js', RECHERCHE_CLIENT
  .replace("'__INDEX__'", () => JSON.stringify(enStatique('recherche', 'txt', RECH.index)))
  .replace('__INSEE__', () => JSON.stringify(Object.fromEntries([...RECH.lettres].map(([l, t]) => [l, enStatique(`insee-${l}`, 'txt', t)])))))
/** Montre le sommaire de l'en-tête quand celui de la page est passé sous
 *  l'en-tête. La marge de 100 000 px vers le bas compte « plus bas que l'écran »
 *  comme visible : seul « passé, même en partie, sous l'en-tête » déclenche. */
const SOMMAIRE_JS = enStatique('sommaire', 'js', `(()=>{const h=document.querySelector('header.h'),n=document.querySelector('main nav.sommaire');if(!h||!n||!('IntersectionObserver' in window))return;new IntersectionObserver(([e])=>{h.classList.toggle('montre',e.intersectionRatio<1)},{threshold:[0,1],rootMargin:'-'+h.offsetHeight+'px 0px 100000px 0px'}).observe(n)})()`)
const LOUPE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>'
let idRecherche = 0
/** Le grand champ : /prenoms/ et /chercher-un-prenom/. Sans JavaScript, il
 *  envoie vers la page de recherche, qui explique quoi chercher. */
const formRecherche = (adresse = false) => { const id = `q${++idRecherche}`; return `<form class="cherche grand" action="${CHERCHER}" method="get" role="search"${adresse ? ' data-adresse="1"' : ''}>
<label class="vh" for="${id}">Chercher un prénom</label><div class="champ-ligne">${LOUPE}<input id="${id}" name="q" type="search" placeholder="Un prénom : Louise, Maël, Aëlys…" enterkeyhint="search" autocapitalize="words" spellcheck="false"><button class="b" type="submit">Chercher</button></div>
<ul class="suggestions"></ul><div class="verdict" aria-live="polite"></div></form>` }

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
:root{color-scheme:light;--fond:#fbfaf9;--surface:#f2ede9;--texte:#1a234e;--doux:#555c79;--trait:#e4dfda;--trait-fort:#d3cbc4;--oui:#2a7559;--non:#ad4139;--bouton:#1a234e;--sur-bouton:#f8f6f3;--appel:#1d2654;--sur-appel:#f3f1ee;--appel-doux:#c4c8de;--accent:#ecbbb6;
--menthe:#cae1d9;--peche:#efc9c3;--sable:#e5d9d1;--lavande:#d9dcf0;--miel:#f1e1bb;--sauge:#dde4cc;--brume:#e6e2e9;--champ:var(--brume);
--serif:Gloock,"Iowan Old Style","Palatino Linotype",Georgia,serif}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--fond:#13162b;--surface:#1c2038;--texte:#ebeaf2;--doux:#a7acc6;--trait:#2a2f4b;--trait-fort:#3a405f;--oui:#68d1a5;--non:#f2958d;--bouton:#ebeaf2;--sur-bouton:#13162b;--appel:#232a4f;--sur-appel:#ebeaf2;--appel-doux:#b3b8d4;--accent:#efc0ba;
--menthe:#1f3c37;--peche:#45292e;--sable:#372f33;--lavande:#2a2e52;--miel:#3d3420;--sauge:#2e3725;--brume:#262838}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--fond)}
body{margin:0;font:500 17px/1.65 Nunito,ui-rounded,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--texte);background:var(--fond);-webkit-font-smoothing:antialiased}
@media (min-width:760px){body{font-size:18px}}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1.5px}
.nw{white-space:nowrap}
a:focus-visible,summary:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--texte);outline-offset:3px;border-radius:10px}
b,strong,th{font-weight:800}
p{margin:0 0 1em;text-wrap:pretty}
h1,h2,h3{text-wrap:balance}
h1,h2{font-family:var(--serif);font-weight:400;letter-spacing:-.01em}
h3{font-weight:800}
.l{max-width:720px;margin:0 auto;padding:0 20px}
.aller{position:absolute;left:-999px;top:8px;z-index:9;padding:8px 14px;border-radius:12px;background:var(--fond);font-weight:800}
.aller:focus{left:12px}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* La bande de couleur : en-tête, rubriques, fil et haut de page sur la
   couleur de la page (l'origine du prénom, le type de classement). Le fond
   déborde jusqu'aux bords de l'écran par une ombre découpée, sans largeur
   en vw : rien ne dépasse à droite. */
/* L'en-tête est FIXE, pas collant (sticky) : Chrome replace un élément
   collant à chaque image du défilement et l'arrondit au pixel près sur un
   écran à 125/150 % ou un téléphone, d'où une barre qui tremble de 1 à 2 px.
   Fixe et sur sa propre couche (translateZ), il ne bouge plus ; le corps de
   page lui réserve sa hauteur. */
header.h{position:fixed;top:0;left:0;right:0;z-index:5;background:var(--champ);transform:translateZ(0)}
body{padding-top:60px}
header.h .l{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:8px;padding-bottom:8px}
header.h a.m{display:flex;gap:9px;align-items:center;font-weight:800;font-size:18px;text-decoration:none}
header.h img{width:30px;height:30px;border-radius:9px}
header.h .actions{display:flex;align-items:center;gap:4px}
header.h .loupe{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;color:var(--texte)}
header.h .loupe:hover{background:color-mix(in srgb,var(--texte) 8%,transparent)}
header.h .loupe svg,.cherche .champ-ligne>svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
.b{display:inline-flex;align-items:center;justify-content:center;min-height:48px;background:var(--bouton);color:var(--sur-bouton);text-decoration:none;font-weight:800;padding:0 24px;border-radius:999px;transition:background .15s}
.b:hover{background:color-mix(in srgb,var(--bouton) 86%,var(--champ))}
.b.p{min-height:40px;padding:0 16px;font-size:15px}
@media (max-width:370px){header.h .l{gap:8px}header.h .b.p{padding:0 12px;font-size:14px}}
nav.rubriques{background:var(--champ)}
nav.rubriques ul{display:flex;gap:20px;margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
nav.rubriques ul::-webkit-scrollbar{display:none}
@media (max-width:400px){nav.rubriques ul{gap:8px}nav.rubriques a{font-size:14px}}
nav.rubriques a{display:block;padding:8px 0 7px;border-bottom:2px solid transparent;white-space:nowrap;font-size:15px;font-weight:800;line-height:1.3;text-decoration:none;color:color-mix(in srgb,var(--texte) 72%,var(--champ))}
nav.rubriques a:hover{color:var(--texte)}
nav.rubriques a[aria-current="page"]{color:var(--texte);border-bottom-color:var(--texte)}
nav.fil{margin:0;padding:12px 0 0;font-size:14px;color:color-mix(in srgb,var(--texte) 75%,var(--champ));background:var(--champ);box-shadow:0 0 0 100vmax var(--champ);clip-path:inset(0 -100vmax -2px)}
nav.fil a{color:inherit}
.hero{margin:0 0 28px;padding:10px 0 30px;background:var(--champ);box-shadow:0 0 0 100vmax var(--champ);clip-path:inset(0 -100vmax)}
@media (min-width:640px){.hero .graphe{max-width:540px}}
.hero.fiche{padding-bottom:0}
h1{margin:0;font-size:clamp(40px,11vw,64px);line-height:1.02;letter-spacing:-.02em}
h1.long{font-size:clamp(34px,9vw,52px);line-height:1.06}
h1.nom{font-size:clamp(46px,var(--t,24vw),132px);line-height:.95;letter-spacing:-.025em;overflow-wrap:anywhere}
.hero .sous{margin:12px 0 0;max-width:34em;font-size:17px;line-height:1.55}
.sens{margin:14px 0 0;font-size:clamp(21px,6vw,27px);line-height:1.25;font-weight:800}
.sens small,.arabe small{display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 10px;border-radius:999px;border:1.5px solid color-mix(in srgb,var(--texte) 35%,var(--champ));font-size:13px;font-weight:800;letter-spacing:0}
.arabe{margin:8px 0 0;font-size:clamp(24px,7vw,32px);line-height:1.3;font-weight:700}
.qui{margin:8px 0 0;font-size:17px;color:color-mix(in srgb,var(--texte) 80%,var(--champ))}
.hero .b{margin-top:22px}
.hero .graphe{margin:22px 0 0;padding:0}
.hero .graphe figcaption{margin:0;padding:8px 0 14px;font-size:13px;line-height:1.4;color:color-mix(in srgb,var(--texte) 75%,var(--champ))}
svg.courbe{display:block;width:100%;height:auto;overflow:visible}
/* La couleur de la courbe : celle de la bande, plus soutenue (plus claire en
   mode sombre). */
.courbe .aire,.courbe .barre,.graphies i{fill:color-mix(in srgb,var(--champ) 78%,var(--texte));fill:oklch(from var(--champ) calc(l - .11) calc(c * 1.9 + .01) h)}
@media (prefers-color-scheme:dark){.courbe .aire,.courbe .barre,.graphies i{fill:color-mix(in srgb,var(--champ) 70%,var(--texte));fill:oklch(from var(--champ) calc(l + .12) calc(c * 1.5 + .01) h)}}
.chapo{font-size:19px;line-height:1.6}
.bloc{margin:48px 0 0}
section[id]{scroll-margin-top:136px}
h2{margin:0 0 12px;font-size:clamp(27px,7.4vw,34px);line-height:1.15}
h2 small{margin-left:4px;font-family:Nunito,system-ui,sans-serif;font-size:.5em;font-weight:800;color:var(--doux);letter-spacing:0}
h3{margin:22px 0 6px;font-size:19px;line-height:1.3}
/* Les chiffres : une grille de deux, séparée par des traits, le nombre en
   grand au-dessus de ce qu'il compte. */
.chiffres{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px;margin:0 0 8px;padding:0}
@media (min-width:640px){.chiffres{grid-template-columns:repeat(3,minmax(0,1fr))}}
.chiffres>div{display:flex;flex-direction:column;gap:2px;padding:14px 0 12px;border-top:1px solid var(--trait)}
.chiffres dt,.chiffres>div>span{font-size:14px;line-height:1.35;color:var(--doux)}
.chiffres dd,.chiffres>div>b{order:-1;margin:0;font-family:var(--serif);font-weight:400;font-size:clamp(27px,8vw,34px);line-height:1.1;letter-spacing:-.01em}
.chiffres sup{font-size:.5em}
/* Le sommaire de la fiche : une rangée qui colle sous l'en-tête et défile
   d'un doigt, sans barre de défilement. */
/* Le sommaire, en deux exemplaires : l'un dans la page, l'autre DANS
   l'en-tête, qui s'y montre quand le premier a quitté l'écran
   (statique/sommaire.js). Deux éléments collants empilés se décalent d'un ou
   deux pixels pendant le défilement par inertie d'un téléphone : la barre
   vibre et le texte passe entre les deux. Ici un seul élément colle,
   l'en-tête ; la rangée du sommaire est posée sous lui (top:100%), sans
   changer sa hauteur, donc rien ne bouge dans la page quand elle apparaît.
   L'ombre vers le haut bouche l'espace que laisse parfois la barre d'adresse
   d'un téléphone quand elle se replie. */
header.h{box-shadow:0 -80px 0 var(--champ)}
header.h .l{height:60px}
nav.sommaire{margin:20px -20px 0;padding:10px 20px;background:var(--fond);border-bottom:1px solid var(--trait)}
header.h nav.sommaire{position:absolute;left:0;right:0;top:calc(100% - 1px);margin:0;padding-top:5px;padding-bottom:9px;border-top:1px solid var(--champ);visibility:hidden;opacity:0;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility 0s .18s}
header.h nav.sommaire ul{max-width:680px;margin:0 auto}
header.h.montre nav.sommaire{visibility:visible;opacity:1;transform:none;transition:opacity .18s,transform .18s,visibility 0s}
nav.sommaire ul{display:flex;gap:8px;margin:0;padding:0;list-style:none;overflow-x:auto;scrollbar-width:none}
nav.sommaire ul::-webkit-scrollbar{display:none}
nav.sommaire li:last-child{padding-right:24px}
nav.sommaire a{display:flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;border:1.5px solid var(--trait-fort);white-space:nowrap;text-decoration:none;font-weight:800;font-size:15px}
nav.sommaire a:hover{border-color:var(--texte)}
.carte>p:last-child{margin-bottom:0}
.doute{margin:.6em 0 0;font-size:15px;color:var(--doux)}
.faits{display:grid;gap:12px;margin:0;padding:0;list-style:none}
.faits li:last-child{padding:14px 18px;border-radius:16px;background:var(--surface)}
.ailleurs{display:grid;margin:0;padding:0;list-style:none}
.ailleurs li{display:grid;gap:4px;padding:14px 0;border-top:1px solid var(--trait)}
.ailleurs li:last-child{border-bottom:1px solid var(--trait)}
.ailleurs .tete{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 10px}.ailleurs .tete a{min-width:0}
.ailleurs .valeur{margin:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-variant-numeric:tabular-nums}
.ailleurs .rien{margin:0;color:var(--doux)}
.prov{font-size:11px;font-weight:800;margin-left:6px;padding:1px 6px;border-radius:6px;text-decoration:none;white-space:nowrap;background:var(--surface)}
.badge{font-size:13px;font-weight:800;padding:2px 10px;border-radius:999px;white-space:nowrap;text-decoration:none;border:1.5px solid var(--trait-fort)}
.badge:hover{border-color:var(--texte)}
.puces{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.puces a,.puces span{display:inline-flex;align-items:baseline;gap:6px;padding:9px 15px;border-radius:999px;border:1.5px solid var(--trait-fort);text-decoration:none;font-weight:800;font-size:16px}
.puces a:hover{border-color:var(--texte)}
.puces small{color:var(--doux);font-size:13px}
/* Les graphies : une ligne chacune, avec une barre à l'échelle. */
.graphies{display:grid;margin:0;padding:0;list-style:none}
.graphies li{display:grid;grid-template-columns:minmax(0,9em) minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--trait)}
.graphies li:last-child{border-bottom:1px solid var(--trait)}
.graphies .g{font-family:var(--serif);font-size:22px;line-height:1.2;text-decoration:none;overflow-wrap:anywhere}
a.g:hover{text-decoration:underline}
.graphies i{display:block;height:8px;width:var(--w);min-width:4px;border-radius:4px;background:color-mix(in srgb,var(--champ) 78%,var(--texte));background:oklch(from var(--champ) calc(l - .11) calc(c * 1.9 + .01) h)}
@media (prefers-color-scheme:dark){.graphies i{background:oklch(from var(--champ) calc(l + .12) calc(c * 1.5 + .01) h)}}
.graphies b{font-variant-numeric:tabular-nums;text-align:right}
.graphies small{font-size:14px;color:var(--doux)}
/* Les prénoms proches : en grand, à la suite, comme on les dirait. */
.noms-grands{display:flex;flex-wrap:wrap;gap:2px 22px;margin:0;padding:0;list-style:none;font-family:var(--serif);font-size:27px;line-height:1.65}
.noms-grands a{text-decoration-thickness:1px;text-decoration-color:var(--trait-fort)}
.noms-grands a:hover{text-decoration-color:currentColor}
.rangs{display:grid;margin:0;padding:0;list-style:none}
.rangs a{display:flex;align-items:baseline;gap:14px;padding:13px 0;border-top:1px solid var(--trait);text-decoration:none}
.rangs li:last-child a{border-bottom:1px solid var(--trait)}
.rangs a:hover span{text-decoration:underline}
.rangs b{flex:none;min-width:2.1em;font-family:var(--serif);font-weight:400;font-size:28px;line-height:1}
.rangs sup{font-size:.5em}
/* L'appel vers l'app : un aplat sombre, la carte du prénom comme dans l'app. */
.cta{margin:56px 0;padding:40px 0 42px;background:var(--appel);color:var(--sur-appel);box-shadow:0 0 0 100vmax var(--appel);clip-path:inset(0 -100vmax)}
.cta h2{margin-bottom:10px}
.cta p{max-width:32em;color:var(--appel-doux)}
.cta .b{background:var(--accent);color:#1a234e}
.cta .b:hover{background:color-mix(in srgb,var(--accent) 85%,#fbfaf9)}
.cta .doute{margin:1em 0 0;color:var(--appel-doux)}
.pile{position:relative;width:230px;height:168px;margin:0 0 24px 8px}
.pile::before{content:"";position:absolute;left:14px;top:14px;width:206px;height:146px;border-radius:22px;background:var(--accent);transform:rotate(7deg)}
.pile div{position:absolute;inset:0 16px 12px 0;padding:22px 22px 0;border-radius:22px;background:#fbfaf9;color:#1a234e;transform:rotate(-4deg);box-shadow:0 18px 40px -18px rgba(5,8,25,.7)}
.pile b{display:block;font-family:var(--serif);font-weight:400;font-size:clamp(28px,var(--t2,44px),44px);line-height:1;overflow-wrap:anywhere}
.pile span{display:block;margin-top:8px;font-size:14px;font-weight:800;line-height:1.3}
.offrir{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:32px 0 0;padding:18px 20px;border-radius:20px;background:var(--surface)}
.offrir b{display:block;font-size:17px}
.offrir span{display:block;margin-top:2px;font-size:15px;line-height:1.45}
.offrir .b{flex:none}
@media (max-width:420px){.offrir{flex-direction:column;align-items:flex-start}}
/* Les classements : un tableau sans boîte, le prénom en grand. */
.tableau{overflow-x:auto;scrollbar-width:none;margin:8px 0 0}
.tableau::-webkit-scrollbar{display:none}
table{width:100%;border-collapse:collapse;font-size:16px}
caption{padding:0 0 12px;text-align:left;font-size:14px;line-height:1.45;color:var(--doux);caption-side:bottom;padding-top:12px}
td,th{padding:11px 8px;border-top:1px solid var(--trait);text-align:left;vertical-align:baseline}
th{padding-top:8px;padding-bottom:8px;border-top:0;font-size:13px;color:var(--doux)}
tbody tr:last-child td{border-bottom:1px solid var(--trait)}
th.rg,td.rg{width:2.4em;padding-left:0;padding-right:0;text-align:left}
td.rg{font-size:14px;font-weight:800;color:var(--doux);font-variant-numeric:tabular-nums}
td a{text-decoration:none}
td a b{font-family:var(--serif);font-weight:400;font-size:23px;line-height:1.15}
td a:hover b{text-decoration:underline;text-decoration-thickness:1px}
td small{display:block;margin-top:2px;font-size:14px;line-height:1.35;color:var(--doux)}
td.o{font-size:15px;color:var(--doux)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;width:1%}
td:last-child,th:last-child{padding-right:0}
.monte{color:var(--oui);font-weight:800}
.baisse{color:var(--non);font-weight:800}
.nul{color:var(--doux)}
@media (max-width:560px){.o{display:none}table{font-size:15px}td,th{padding-left:5px;padding-right:5px}td a b{font-size:21px}td small{overflow-wrap:anywhere}}
th .court,.v-court{display:none}th .court{text-decoration:none}
@media (max-width:430px){th .long,.v-long{display:none}th .court,.v-court{display:inline}th.rg,td.rg{width:1.9em}td.n,th.n{padding-left:10px}}
@media (max-width:360px){table{font-size:14px}th{font-size:12px}td a b{font-size:19px}}
.bascule{display:inline-flex;gap:2px;margin:0 0 18px;padding:4px;border-radius:999px;background:var(--surface)}
.bascule a{display:flex;align-items:center;min-height:40px;padding:0 20px;border-radius:999px;font-weight:800;text-decoration:none;color:var(--doux)}
.bascule a:hover{color:var(--texte)}
.bascule a[aria-current="page"]{color:var(--sur-bouton);background:var(--bouton)}
.alphabet{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;margin:0;padding:0;list-style:none}
.alphabet a{display:grid;place-items:center;height:48px;border-radius:12px;border:1.5px solid var(--trait-fort);font-family:var(--serif);font-size:22px;text-decoration:none}
.alphabet a:hover{border-color:var(--texte)}
.alphabet a[aria-current="page"]{color:var(--sur-bouton);background:var(--bouton);border-color:var(--bouton)}
.voisins{display:flex;justify-content:space-between;gap:12px;margin:28px 0 0;font-weight:800}
.voisins a{text-decoration:none}
.voisins a:hover{text-decoration:underline}
ul.noms{columns:2 9em;column-gap:20px;margin:0;padding:0;list-style:none}
@media (min-width:640px){ul.noms{columns:3 9em}}
ul.noms li{break-inside:avoid;padding:3px 0}
ul.noms a{text-decoration:none}
ul.noms a:hover{text-decoration:underline}
ul.noms a.courant{font-weight:800}
/* L'accueil : chaque classement en une rangée, ses premiers prénoms en grand. */
.classements{display:grid}
.classement{padding:18px 0 20px;border-top:1px solid var(--trait)}
.classement:last-child{border-bottom:1px solid var(--trait)}
.classement h3{margin:0 0 2px;font-size:19px}
.classement>p{margin:0 0 14px;font-size:15px;line-height:1.45;color:var(--doux)}
.duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 22px}
.duo .genre{margin:0 0 4px;font-size:14px;font-weight:800;color:var(--doux)}
ol.apercu{display:grid;gap:2px;margin:0 0 10px;padding:0;list-style:none}
ol.apercu li{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-family:var(--serif);font-size:22px;line-height:1.3}
ol.apercu a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none}
ol.apercu a:hover{text-decoration:underline;text-decoration-thickness:1px}
ol.apercu small{flex:none;font-family:Nunito,system-ui,sans-serif;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--doux)}
a.suite{font-size:15px;font-weight:800}
.suite-bloc{margin:14px 0 0}
/* Les origines : chacune sur sa couleur, celle de ses fiches. */
.origines{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0;padding:0;list-style:none}
.origines a{display:block;height:100%;padding:16px;border-radius:18px;background:var(--champ);text-decoration:none}
.origines a:hover b{text-decoration:underline;text-decoration-thickness:1px}
.origines b{display:block;font-family:var(--serif);font-weight:400;font-size:22px;line-height:1.1;overflow-wrap:anywhere}
.origines span{display:block;margin-top:6px;font-size:14px;font-weight:800}
.origines small{display:block;margin-top:6px;font-size:14px;line-height:1.35;color:color-mix(in srgb,var(--texte) 78%,var(--champ))}
@media (min-width:640px){.origines.six{grid-template-columns:repeat(3,minmax(0,1fr))}}
/* La recherche. */
.cherche{position:relative}
.cherche .champ-ligne{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 16px;border-radius:999px;background:var(--fond);border:1.5px solid var(--texte);color:var(--doux)}
.cherche .champ-ligne:focus-within{box-shadow:0 0 0 2px var(--texte)}
.cherche input{flex:1;min-width:0;border:0;background:none;font:inherit;font-weight:700;color:var(--texte);padding:10px 0;outline:none;-webkit-appearance:none;appearance:none}
.cherche input:focus-visible{outline:none}
.cherche input::placeholder{color:var(--doux)}
.cherche input::-webkit-search-cancel-button{display:none}
.cherche.grand{margin:22px 0 0}
.cherche.grand input{font-size:19px}
.cherche .b{min-height:44px;padding:0 20px;font:inherit;font-size:16px;font-weight:800;border:0;cursor:pointer}
@media (max-width:420px){.cherche .b{padding:0 14px}.cherche.grand input{font-size:17px}}
.suggestions{list-style:none;margin:8px 0 0;padding:0;border-radius:18px;background:var(--fond);border:1px solid var(--trait-fort);overflow:hidden;text-align:left}
.suggestions:empty{display:none}
.suggestions li+li{border-top:1px solid var(--trait)}
.suggestions a{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:11px 16px;text-decoration:none}
.suggestions a:hover,.suggestions a:focus{background:var(--surface);outline:none}
.suggestions b{flex:none;font-family:var(--serif);font-weight:400;font-size:20px}
.suggestions small{color:var(--doux);font-size:14px;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
@media (max-width:380px){.suggestions a{padding:11px 12px}.suggestions small{font-size:13px}}
.verdict{margin:12px 0 0;text-align:left}
.verdict:empty{display:none}
.verdict>p{margin:0 0 .6em;padding:14px 16px;border-radius:16px;background:var(--fond);font-size:16px;line-height:1.5}
.verdict>p.t,.verdict>p.doux{padding:0;background:none}
.verdict>p.t{font-weight:800;margin-top:12px}
.recherche-voile{position:fixed;inset:0;z-index:20;padding:12px;background:rgba(10,13,30,.5);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.recherche-voile[hidden]{display:none}
.recherche-boite{max-width:620px;max-height:100%;margin:0 auto;padding:4px;overflow-y:auto}
.recherche-boite .fermer{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:none;color:var(--doux);font:inherit;font-size:18px;cursor:pointer}
html.recherche-ouverte{overflow:hidden}
/* La page de l'app. */
ol.etapes{display:grid;margin:0;padding:0;list-style:none;counter-reset:e}
ol.etapes li{position:relative;counter-increment:e;padding:16px 0 16px 58px;border-top:1px solid var(--trait)}
ol.etapes li:last-child{border-bottom:1px solid var(--trait)}
ol.etapes li::before{content:counter(e);position:absolute;left:0;top:12px;font-family:var(--serif);font-size:34px;line-height:1}
.offres{display:grid;gap:10px}
@media (min-width:640px){.offres{grid-template-columns:1fr 1fr}}
.offre{padding:20px;border-radius:20px;background:var(--surface)}
.offre .prix{display:block;margin:0 0 10px;font-family:var(--serif);font-size:34px;line-height:1.1}
.offre .prix small{font-family:Nunito,system-ui,sans-serif;font-size:16px;font-weight:800;color:var(--doux)}
.offre.plus{background:var(--champ)}
.faq{display:grid}
.faq details{border-top:1px solid var(--trait)}
.faq details:last-child{border-bottom:1px solid var(--trait)}
.faq summary{position:relative;padding:16px 32px 16px 0;list-style:none;cursor:pointer}
.faq summary::-webkit-details-marker{display:none}
.faq summary h3{margin:0;font-size:17px;line-height:1.4}
.faq summary::after{content:"";position:absolute;right:6px;top:50%;width:9px;height:9px;border-right:2.5px solid currentColor;border-bottom:2.5px solid currentColor;transform:translateY(-75%) rotate(45deg);transition:transform .25s}
.faq details[open] summary::after{transform:translateY(-25%) rotate(-135deg)}
.faq details p{margin:0 0 16px}
footer{margin:64px 0 0;font-size:15px;color:var(--doux);background:var(--surface)}
main>.cta:last-child{margin-bottom:0}
main>.cta:last-child+footer,main:has(>.cta:last-child)+footer{margin-top:0}
footer .l{padding-top:32px;padding-bottom:40px}
footer a{color:var(--doux);text-decoration:none}
footer a:hover{color:var(--texte);text-decoration:underline}
.plan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 18px;margin:0 0 26px}
@media (min-width:640px){.plan{grid-template-columns:repeat(4,minmax(0,1fr))}}
.plan .t{margin:0 0 8px;font-weight:800;color:var(--texte)}
.plan ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}
@keyframes trace{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes apparait{from{opacity:0}}
@keyframes pousse{from{transform:scaleY(0)}}
@keyframes ouvre{from{opacity:0;transform:translateY(-6px)}}
/* Une seule animation : la courbe du prénom se trace à l'ouverture. Le texte
   est là d'emblée, rien n'attend pour se montrer. */
@media (prefers-reduced-motion:no-preference){
.courbe .trait{stroke-dasharray:1;animation:trace 1.6s .15s cubic-bezier(.45,0,.2,1) both}
.courbe .aire{animation:apparait .9s .7s ease-out both}
.courbe .barre{transform-box:fill-box;transform-origin:50% 100%;animation:pousse .6s calc(.1s + var(--i,0) * 40ms) cubic-bezier(.2,.75,.25,1) both}
.faq details[open]>p{animation:ouvre .25s ease-out}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}}
`.replace(/\n/g, '')

/** Un long titre n'a pas la taille d'un prénom. */
const h1 = t => `<h1${t.length > 20 ? ' class="long"' : ''}>${esc(t)}</h1>`
/**
 * Le nom de la fiche, aussi grand que la largeur le permet : la taille suit le
 * nombre de lettres (Gloock fait environ 0,58 em par lettre), bornée en CSS.
 */
const h1Nom = t => `<h1 class="nom" style="--t:${Math.min(28, 88 / (Math.max(t.length, 3) * 0.58)).toFixed(1)}vw">${esc(t)}</h1>`

/**
 * La couleur d'une page (la bande du haut) : celle de l'origine du prénom,
 * pour qu'une famille de prénoms se reconnaisse d'une fiche à l'autre ; celle
 * du type de liste pour un classement. Chaque couleur a sa version sombre
 * (variables --menthe… redéfinies en mode sombre).
 */
const CHAMPS = ['menthe', 'peche', 'sable', 'lavande', 'miel', 'sauge', 'brume']
const CHAMP_ORIGINE = { germanique: 'menthe', latin: 'peche', arabe: 'sable', 'hébraïque': 'lavande', grec: 'miel', 'moderne-inventé': 'sauge', celtique: 'sauge', 'anglo-saxon': 'lavande', 'français': 'peche', slave: 'miel', scandinave: 'menthe', espagnol: 'peche', italien: 'peche', persan: 'sable', turc: 'sable', 'hébreu': 'lavande' }
const champOrigine = o => {
  if (!o) return 'brume'
  if (CHAMP_ORIGINE[o]) return CHAMP_ORIGINE[o]
  let h = 0
  for (const ch of o) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return CHAMPS[h % (CHAMPS.length - 1)]
}
const CHAMP_LISTE = { tendance: 'peche', populaires: 'lavande', rares: 'miel', monde: 'menthe', lettres: 'sable' }
/** La barre d'adresse du téléphone prend la couleur de la bande. */
const TEINTES = {
  menthe: ['#cae1d9', '#1f3c37'], peche: ['#efc9c3', '#45292e'], sable: ['#e5d9d1', '#372f33'], lavande: ['#d9dcf0', '#2a2e52'],
  miel: ['#f1e1bb', '#3d3420'], sauge: ['#dde4cc', '#2e3725'], brume: ['#e6e2e9', '#262838'], fond: ['#fbfaf9', '#13162b']
}

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
  ['monde', 'Monde', '/prenoms/monde/']
]
const actuel = oui => oui ? ' aria-current="page"' : ''
const PLAN = `<nav class="plan" aria-label="Plan du site">
${[['filles', 'Filles'], ['garcons', 'Garçons']].map(([g, t]) => `<div><p class="t">${t}</p><ul>
<li><a href="/prenoms/tendance/${g}/">Qui montent</a></li><li><a href="/prenoms/populaires/${g}/">Les plus donnés</a></li><li><a href="/prenoms/rares/${g}/">Rares</a></li></ul></div>`).join('\n')}
<div><p class="t">Explorer</p><ul><li><a href="${CHERCHER}">Chercher un prénom</a></li><li><a href="/prenoms/">Tous les prénoms</a></li><li><a href="/prenoms/origines/">Par origine</a></li><li><a href="/prenoms/monde/">Dans le monde</a></li><li><a href="/prenoms/#lettres">Par lettre</a></li></ul></div>
<div><p class="t">${MARQUE}</p><ul><li><a href="${APP}">L’application</a></li><li><a href="/offrir" rel="nofollow">Offrir ${MARQUE}</a></li></ul></div>
</nav>`

function page({ chemin, titre, description, fil = [], corps, jsonld = [], ariane = null, indexer = true,
  rubrique = null, genre = 'filles', appel = { texte: 'Choisir à deux', href: APP }, champ = 'brume', classe = '', sommaire = '' }) {
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
<meta name="theme-color" content="${TEINTES[champ][0]}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${TEINTES[champ][1]}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/logo.png" type="image/png">
${PRECHARGE}
<style>${CSS}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head><body${classe ? ` class="${classe}"` : ''} style="--champ:var(--${champ})">
<a class="aller" href="#contenu">Aller au contenu</a>
<header class="h"><div class="l"><a class="m" href="/prenoms/"><img src="/logo.png" alt="" width="30" height="30">${MARQUE}</a>
<div class="actions"><a class="loupe" href="${CHERCHER}" aria-label="Chercher un prénom">${LOUPE}</a><a class="b p" href="${appel.href}">${esc(appel.texte)}</a></div></div>${sommaire ? `
<nav class="sommaire" aria-label="Sur cette page, en haut de l’écran"><ul>${sommaire}</ul></nav>` : ''}</header>
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
<script src="${RECHERCHE_JS}" defer></script>${sommaire ? `
<script src="${SOMMAIRE_JS}" defer></script>` : ''}
</body></html>`
}

const cta = (p) => `<section class="cta r">
${p ? `<div class="pile" aria-hidden="true"><div><b style="--t2:${Math.min(44, 190 / (Math.max(p.l.length, 3) * 0.58)).toFixed(0)}px">${esc(p.l)}</b>${p.m ? `<span>${esc(p.m.length > 40 ? p.m.slice(0, 38).replace(/\s+\S*$/, '') + '…' : p.m)}</span>` : ''}</div></div>` : ''}
<h2>${p ? `${esc(p.l)} vous plaît ?` : 'Trouver le prénom à deux'}</h2>
<p>Swipez chacun de votre côté, sans vous influencer. Vous ne voyez que les prénoms qui vous plaisent à tous les deux.</p>
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
<path class="aire" d="M${x(0).toFixed(1)},${H - B} L${pts.join(' L')} L${x(p.sr.length - 1).toFixed(1)},${H - B} Z"/>
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--texte);stroke-opacity:.3" stroke-width="1.5"/>
<polyline class="trait" pathLength="1" points="${pts.join(' ')}" fill="none" style="stroke:var(--texte)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
${graduations.map((a, i) => `<text x="${x(a - AN0).toFixed(1)}" y="${H - 6}" font-size="13" font-weight="800" style="fill:var(--texte)" text-anchor="${i === 0 ? 'start' : i === graduations.length - 1 ? 'end' : 'middle'}">${a}</text>`).join('')}
<circle class="pic" cx="${x(iMax).toFixed(1)}" cy="${y(max).toFixed(1)}" r="5" style="fill:var(--texte);stroke:var(--champ);stroke-width:3"/>
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
${p.nb.map((v, i) => v > 0 ? `<rect class="barre" style="--i:${i};stroke:var(--texte)" x="${(G + i * pas + pas * 0.16).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(pas * 0.68).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="3" stroke-width="1.5"/><text class="val" style="--i:${i};fill:var(--texte)" x="${cx(i)}" y="${(y(v) - 5).toFixed(1)}" font-size="12" font-weight="800" text-anchor="middle">${v}</text>` : '').join('')}
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--texte);stroke-opacity:.3" stroke-width="1.5"/>
${annees.map(a => `<text x="${cx(a - B0)}" y="${H - 6}" font-size="13" font-weight="800" style="fill:var(--texte)" text-anchor="middle">${a}</text>`).join('')}
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
/**
 * Le prénom au Québec, en Belgique et en Suisse, chaque chiffre avec son
 * badge de source (organisme, années, lien vers le jeu de données). Absent
 * de la fiche si aucun des trois pays ne le publie.
 */
// Tous les pays (pipeline/pays.py) : un prénom, ses chiffres dans chacun.
const PAYS_DIR = resolve(PUBLIC, 'data/pays')
const PAYS = existsSync(resolve(PAYS_DIR, 'index.json'))
  ? JSON.parse(readFileSync(resolve(PAYS_DIR, 'index.json'), 'utf8')).pays.filter(x => !x.catalogue) : []
const PX = new Map()                         // label -> code -> [ligne f, ligne m, ligne x]
for (const x of PAYS) {
  const f = resolve(PAYS_DIR, `${x.code}.json`)
  if (!existsSync(f)) continue
  for (const l of JSON.parse(readFileSync(f, 'utf8')).lignes) {
    if (l[5]) continue                       // prénom absent du catalogue : pas de fiche ici
    const m = PX.get(l[0]) ?? PX.set(l[0], {}).get(l[0])
    ;(m[x.code] ??= [null, null, null])[l[1]] = l
  }
}
const totalPour = (x, sx) => typeof x.total === 'number' ? x.total : sx ? x.total[sx] : x.total.f + x.total.m
const enPays = x => GROUPES[x.code] ? GROUPES[x.code].en : x.code === 'qc' ? 'au Québec' : x.code === 'us' ? 'aux États-Unis' : `en ${x.nom}`
const MONDE = {
  be: ['belges', 'belge', 'Prénoms belges'], ch: ['suisses', 'suisse', 'Prénoms suisses'],
  qc: ['quebecois', 'québécois', 'Prénoms québécois'], ca: ['canadiens', 'canadien', 'Prénoms canadiens'],
  us: ['americains', 'américain', 'Prénoms américains'], 'gb-eaw': ['anglais', 'anglais', 'Prénoms anglais'],
  'gb-sct': ['ecossais', 'écossais', 'Prénoms écossais'], 'gb-nir': ['nord-irlandais', 'nord-irlandais', 'Prénoms nord-irlandais'],
  ie: ['irlandais', 'irlandais', 'Prénoms irlandais'], at: ['autrichiens', 'autrichien', 'Prénoms autrichiens'],
  se: ['suedois', 'suédois', 'Prénoms suédois'], no: ['norvegiens', 'norvégien', 'Prénoms norvégiens'],
  pl: ['polonais', 'polonais', 'Prénoms polonais'], lv: ['lettons', 'letton', 'Prénoms lettons'],
  nz: ['neo-zelandais', 'néo-zélandais', 'Prénoms néo-zélandais']
}
const parLabel = new Map()
for (const p of tous) if (!parLabel.has(p.l) || p.n > parLabel.get(p.l).n) parLabel.set(p.l, p)
const lienPrenom = l => { const s = slugDe(l); return pages.has(s) ? `/prenom/${s}/` : null }
/**
 * Les pays publiés par morceaux (le Canada : une province par jeu de données)
 * ne font qu'une page : les naissances additionnées, chaque ligne avec le
 * badge de sa ou ses provinces. Le Québec garde sa page (chiffres sans
 * distinction de sexe, et un mot-clé à lui seul).
 */
const GROUPES = {
  ca: { nom: 'Canada', en: 'au Canada', membres: { 'ca-on': ['ON', 'Ontario', 'en Ontario'], 'ca-bc': ['C.-B.', 'Colombie-Britannique', 'en Colombie-Britannique'] } }
}
const GROUPE_DE = Object.fromEntries(Object.entries(GROUPES).flatMap(([g, v]) => Object.keys(v.membres).map(c => [c, g])))
const aSaPage = c => Boolean(MONDE[c] || (GROUPE_DE[c] && MONDE[GROUPE_DE[c]]))
const cheminPays = (x, s) => `/prenoms/monde/${MONDE[GROUPE_DE[x.code] ?? x.code][0]}/${x.par_sexe ? (s === 'm' ? 'garcons/' : 'filles/') : ''}`
const badgePays = x => x.membres ? x.membres.map(badgePays).join(' ') : `<a class="badge" href="${esc(x.url)}" rel="noopener" title="${esc(`${x.organisme} — ${x.jeu}, ${x.annees[0]}-${x.annees[1]}. Licence : ${x.licence}.`)}">${esc(x.sigle || x.organisme)} · ${x.annees[0]}-${String(x.annees[1]).slice(2)}</a>`
const lignesPays = new Map()
for (const x of PAYS) {
  const f = resolve(PAYS_DIR, `${x.code}.json`)
  if (existsSync(f) && aSaPage(x.code)) lignesPays.set(x.code, JSON.parse(readFileSync(f, 'utf8')).lignes)
}

/**
 * Un groupe comme un pays : naissances additionnées par prénom et par sexe,
 * rang recalculé, fréquence sur le total des naissances des membres, tendance
 * moyenne des membres qui en publient une, pondérée par leurs naissances.
 * Chaque ligne garde en [8] les codes des membres où le prénom figure.
 */
function fusionner(code) {
  const g = GROUPES[code]
  const membres = PAYS.filter(x => g.membres[x.code] && lignesPays.has(x.code))
  if (membres.length < 2) return null
  const acc = new Map()
  for (const m of membres) for (const r of lignesPays.get(m.code)) {
    const k = `${r[1]}|${r[0]}`
    const a = acc.get(k) ?? acc.set(k, { l: r[0], sx: r[1], n: 0, tn: 0, tw: 0, nouveau: 1, ou: [] }).get(k)
    a.n += r[2]; a.nouveau = a.nouveau && r[5] ? 1 : 0; a.ou.push(m.code)
    if (r[4] !== null && r[4] !== undefined) { a.tn += r[2]; a.tw += r[4] * r[2] }
  }
  const lignes = []
  for (const sx of [0, 1, 2]) {
    const rs = [...acc.values()].filter(a => a.sx === sx).sort((a, b) => b.n - a.n)
    let rang = 0
    rs.forEach((a, i) => {
      if (!i || a.n < rs[i - 1].n) rang = i + 1
      lignes.push([a.l, sx, a.n, rang, a.tn ? a.tw / a.tn : null, a.nouveau, null, null, a.ou])
    })
  }
  lignesPays.set(code, lignes)
  const total = { f: 0, m: 0 }
  for (const m of membres) { total.f += m.total.f; total.m += m.total.m }
  return {
    code, nom: g.nom, membres, par_sexe: true, total,
    annees: [Math.min(...membres.map(m => m.annees[0])), Math.max(...membres.map(m => m.annees[1]))],
    sigle: membres.map(m => m.sigle || m.organisme).join(' + '),
    note: `${membres.map(m => `${g.membres[m.code][1]} ${m.annees[0]}-${m.annees[1]}`).join(' et ')} additionnés ; un badge signale les prénoms publiés par une seule province. Le Québec a sa propre page`
  }
}
const PAYS_MONDE = []
for (const x of PAYS) {
  if (!lignesPays.has(x.code)) continue
  const g = GROUPE_DE[x.code]
  if (!g) { PAYS_MONDE.push(x); continue }
  if (PAYS_MONDE.some(y => y.code === g)) continue
  const f = fusionner(g)
  if (f) PAYS_MONDE.push(f)
}
// Badge seulement quand le prénom ne figure que dans une partie du groupe : sur
// toutes les lignes, il ne distinguerait rien.
const provinces = (x, r) => x.membres && r[8] && r[8].length < x.membres.length
  ? ` ${r[8].map(c => `<abbr class="prov" title="${esc(GROUPES[x.code].membres[c][1])}">${esc(GROUPES[x.code].membres[c][0])}</abbr>`).join('')}` : ''

function tableauPays(x, rows, tot) {
  return `<div class="tableau r"><table><caption>Naissances ${x.annees[0]}-${x.annees[1]} (${esc(x.sigle || x.organisme)}) ; « En France » : naissances ${AN1 - 2}-${AN1} (INSEE).</caption>
<thead><tr><th scope="col" class="rg">#</th><th scope="col">Prénom</th><th scope="col" class="n"><span class="long">Naissances</span><abbr class="court" title="Naissances">Naiss.</abbr></th><th scope="col" class="n o">Fréquence</th><th scope="col" class="n">Tendance</th><th scope="col" class="n"><span class="long">En France</span><abbr class="court" title="Naissances en France">Fr.</abbr></th></tr></thead><tbody>
${rows.map(r => {
  const lien = lienPrenom(r[0])
  const fr = parLabel.get(r[0])
  return `<tr><td class="rg">${r[3]}</td><td>${lien ? `<a href="${lien}"><b>${esc(r[0])}</b></a>` : `<b>${esc(r[0])}</b>`}${provinces(x, r)}</td><td class="n">${nf(r[2])}</td><td class="n o">1 sur ${nf(tot / r[2])}</td><td class="n">${r[4] !== null ? tendanceHtml(r[4]) : ''}</td><td class="n">${fr && !fr.hf && fr.n ? nf(fr.n) : '<small>—</small>'}</td></tr>`
}).join('')}
</tbody></table></div>`
}

/** [n, rang, tendance] d'un prénom dans un pays, pour son sexe (les deux s'il est mixte). */
function chiffrePays(p, x) {
  const t = PX.get(p.l)?.[x.code]
  if (!t) return null
  const [f, m, tous] = t
  if (tous) return [tous[2], tous[3], tous[4]]
  if (p.sexe === 'f') return f ? [f[2], f[3], f[4]] : null
  if (p.sexe === 'm') return m ? [m[2], m[3], m[4]] : null
  const n = (f?.[2] ?? 0) + (m?.[2] ?? 0)
  return n ? [n, null, null] : null
}

/** Le pays où le prénom pèse le plus : { s, v, sur: « 1 garçon sur 380 », en }. */
function meilleurPays(p) {
  const sx = p.sexe === 'f' || p.sexe === 'm' ? p.sexe : null
  let mieux = null
  for (const x of PAYS) {
    const v = chiffrePays(p, x)
    if (!v) continue
    const tot = totalPour(x, sx)
    if (!mieux || v[0] / tot > mieux.part) mieux = { s: x, v, part: v[0] / tot, tot }
  }
  if (!mieux) return null
  const qui = !mieux.s.par_sexe || !sx ? 'bébé' : sx === 'f' ? 'fille' : 'garçon'
  return { ...mieux, sur: `1 ${qui} sur ${nf(mieux.tot / mieux.v[0])}`, en: enPays(mieux.s) }
}

/**
 * Le prénom dans tous les pays dont les chiffres sont publics : chaque ligne
 * avec son badge de source (organisme, années, lien vers le jeu de données).
 * Les pays où il ne figure pas tiennent en une phrase. Absent de la fiche si
 * aucun pays ne le publie.
 */
function ailleurs(p, rangFrance) {
  if (!PAYS.length) return ''
  const sx = p.sexe === 'f' || p.sexe === 'm' ? p.sexe : null
  const ord = r => r === 1 ? '1<sup>er</sup>' : `${r}<sup>e</sup>`
  const vus = PAYS.map(x => ({ x, v: chiffrePays(p, x) }))
  const presents = vus.filter(e => e.v).sort((a, b) => b.v[0] / totalPour(b.x, sx) - a.v[0] / totalPour(a.x, sx))
  if (!presents.length) return ''
  const absents = vus.filter(e => !e.v)
  const lignes = presents.map(({ x, v }) => {
    const org = x.sigle || x.organisme
    const info = `${x.organisme} — ${x.jeu}, ${x.annees[0]}-${x.annees[1]}. Licence : ${x.licence}.`
    const badge = `<a class="badge" href="${esc(x.url)}" rel="noopener" title="${esc(info)}">${esc(org)} · ${x.annees[0]}-${String(x.annees[1]).slice(2)}</a>`
    const [n, rang, t] = v
    const qui = !x.par_sexe || !sx ? 'bébé' : sx === 'f' ? 'fille' : 'garçon'
    const parts = [
      rang && rang <= 2000 ? `<b>${ord(rang)} prénom${x.par_sexe && sx ? (sx === 'f' ? ' de fille' : ' de garçon') : ''}</b>` : '',
      `<span>${nf(n)} bébés en 3 ans</span>`,
      `<span>1 ${qui} sur ${nf(totalPour(x, sx) / n)}</span>`,
      t !== null && t !== undefined ? `<span class="${classeTendance(t)}">${pctTendance(t)} %/an</span>` : ''
    ].filter(Boolean)
    const note = x.note ? `<p class="rien"><small>${esc(x.note[0].toUpperCase() + x.note.slice(1))}.</small></p>` : ''
    const lienPays = aSaPage(x.code) ? cheminPays(x, sx === 'm' ? 'm' : 'f') : null
    const nom = GROUPE_DE[x.code] ? `${x.nom} (${GROUPES[GROUPE_DE[x.code]].nom})` : x.nom
    return `<li><div class="tete">${lienPays ? `<a href="${lienPays}"><b>${esc(nom)}</b></a>` : `<b>${esc(nom)}</b>`}${badge}</div><p class="valeur">${parts.join('')}</p>${note}</li>`
  })
  const classes = presents.filter(e => e.v[1] && e.v[1] <= 300).sort((a, b) => a.v[1] - b.v[1]).slice(0, 4)
    .map(e => `${ord(e.v[1])} ${esc(enPays(e.x))}`)
  const France = rangFrance && rangFrance <= 2000 ? `, contre ${ord(rangFrance)} en France` : ''
  const phrase = classes.length ? `<p>${esc(p.l)} est ${liste(classes)}${France}.</p>` : ''
  return `<section class="bloc" id="monde"><h2>${esc(p.l)} dans le monde</h2>${phrase}
<ul class="ailleurs">${lignes.join('')}</ul>
${absents.length ? `<p class="doute">Peu ou pas donné (sous le seuil de publication) : ${esc(liste(absents.map(e => e.x.nom)))}.</p>` : ''}
<p class="doute">Chiffres officiels de chaque pays, sur leurs trois dernières années publiées.</p></section>`
}

function fiche(entrees) {
  const p = entrees[0]
  const autresGraphies = entrees.slice(1)
  const groupe = (groupes.get(p.gp) ?? []).filter(x => x.slug !== p.slug)
  const nTot = entrees.reduce((s, x) => s + x.n, 0)
  const fGroupe = (groupes.get(p.gp) ?? [p]).reduce((s, x) => s + x.f, 0)
  const rang = p.sexe === 'fm' ? p.rang.fm : p.rang[p.sexe]
  const origines = p.g.map(ORIGINE_F)
  const genre = GENRE[p.sexe]

  const enArabe = arabeDe(p)
  const phraseSens = (p.m
    ? `${esc(p.l)} ${p.cf === 2 ? 'signifie' : 'signifierait'} « ${esc(p.m)} »${origines.length ? `, d’origine ${esc(liste(origines))}` : ''}.`
    : origines.length ? `${esc(p.l)} est un prénom d’origine ${esc(liste(origines))} ; sa signification n’est pas établie de façon fiable.` : `L’origine et la signification de ${esc(p.l)} ne sont pas établies de façon fiable : nous préférons ne rien inventer.`)
    + (enArabe ? ` En arabe, il s’écrit <span lang="ar" dir="rtl">${esc(enArabe)}</span>.` : '')
  const doute = p.m && p.cf !== 2
    ? `<p class="doute">${p.cf === 1 ? 'Sens probable : les sources concordent en partie.' : 'Sens incertain : les sources divergent ou sont rares.'}</p>` : ''

  const ecole = fGroupe / 10000 * 200
  const phraseClasse = ecole >= 1
    ? `Dans une école de 200 enfants nés ces années-là, on compterait en moyenne <b>${dec(ecole)}</b> ${esc(p.l)}${groupe.length ? ' en comptant les graphies qui se prononcent pareil' : ''}.`
    : `Dans des écoles de 200 enfants nés ces années-là, on trouverait en moyenne un${p.sexe === 'f' ? 'e' : ''} ${esc(p.l)} toutes les <b>${1 / ecole < 10 ? dec(1 / ecole) : nf(1 / ecole)}</b> écoles${groupe.length ? ', toutes graphies confondues' : ''}.`

  const pic = p.p && p.p < AN0 ? `Son record, dans les chiffres de l’INSEE qui remontent à 1900, date de ${p.p}.` : p.p ? `Ce prénom a atteint son pic en ${p.p}.` : ''
  const ar = arabeDe(p)
  const best = p.hf ? meilleurPays(p) : null
  const titre = p.hf
    ? `${p.l} : prénom ${genre} d’ailleurs${p.m ? ', signification et origine' : ''}${best ? `, donné ${best.en}` : ''}`
    : p.m
    ? `${p.l}${ar ? ` (${ar})` : ''} : signification, origine et popularité du prénom`
    : `${p.l}${ar ? ` (${ar})` : ''} : origine et popularité du prénom`
  const fiable = p.n >= SEUIL_TENDANCE
  const parAn = Math.max(1, Math.round(p.n / 3))
  const description = descriptionFiche({
    nom: p.l, genre, origines, sens: p.m,
    chiffre: p.hf
      ? `Pas donné en France de ${AN1 - 2} à ${AN1}${best ? `, mais ${best.sur} ${best.en}` : ''}`
      : `${nf(nTot)} naissances en France de ${AN1 - 2} à ${AN1}`,
    tendance: fiable && !p.hf ? `, tendance ${tendanceMot(p.t)}` : ''
  })

  // L'essentiel d'abord, en haut : le sens, le genre, l'origine. Les phrases
  // longues restent plus bas, pour qui veut le détail.
  const sensTete = (p.m
    ? `<p class="sens">« ${esc(p.m)} »${p.cf === 2 ? '' : `<small>${p.cf === 1 ? 'sens probable' : 'sens incertain'}</small>`}</p>` : '')
    + (ar ? `<p class="arabe"><span lang="ar" dir="rtl">${esc(ar)}</span><small>en arabe</small></p>` : '')
  // Qui il est, en une phrase : le genre, l'origine (qui mène à sa liste).
  const lienOrigine = o => { const L = listes.find(x => x.origine === o); return L ? `<a href="${L.chemin}">${esc(ORIGINE_F(o))}</a>` : esc(ORIGINE_F(o)) }
  const qui = `Prénom ${genre}${p.g.length ? `, d’origine ${liste(p.g.map(lienOrigine))}` : ''}.`
    + (p.hf ? ' Donné ailleurs, pas en France.' : '') + (p.rv ? ' Un prénom rétro qui revient.' : '')
  // La popularité en trois faits, pas en un paragraphe.
  const faits = [pic, fiable
    ? `Sur les dernières années, ${esc(p.l)} est ${tendanceMot(p.t)} (${pctTendance(p.t)} % par an).`
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

  // La courbe en bas du haut de page : le dessin propre à chaque prénom.
  const graphe = p.sr || p.nb ? `<figure class="graphe">${p.sr ? courbe(p) : barres(p)}
<figcaption>${p.sr ? `Naissances pour 10 000 bébés nés en France, de ${AN0} à ${AN1} (INSEE).${p.hf ? ` Aucune de ${AN1 - 2} à ${AN1}.` : ''}` : 'Naissances par an en France, arrondies à 5 par l’INSEE.'}</figcaption></figure>` : ''
  const chiffre = (b, t) => `<div><dt>${t}</dt><dd>${b}</dd></div>`
  const monde = ailleurs(p, p.hf ? null : rang)
  const sommaire = [['sens', 'Sens'], ...(p.hf ? [] : [['popularite', 'Popularité']]), ...(monde ? [['monde', 'Dans le monde']] : []),
    ...(graphies.length ? [['graphies', 'Graphies']] : []), ['proches', 'Prénoms proches']]
  const liensSommaire = sommaire.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')

  const corps = `
<section class="hero fiche">${h1Nom(p.l)}${sensTete}
<p class="qui">${qui}</p>
${graphe}</section>

${p.hf ? `<dl class="chiffres">
${chiffre('0', `naissance en France en <span class="nw">${AN1 - 2}-${AN1}</span>`)}
${best ? chiffre(best.sur, esc(best.en)) : ''}
${best && best.v[1] && best.v[1] <= 1500 ? chiffre(best.v[1] === 1 ? '1<sup>er</sup>' : `${best.v[1]}<sup>e</sup>`, `prénom ${esc(best.en)}`) : ''}
${chiffre('100/100', 'originalité en France')}
</dl>` : `<dl class="chiffres">
${rang <= 2000 ? chiffre(`${rang}<sup>${rang === 1 ? 'er' : 'e'}</sup>`, `prénom ${p.sexe === 'fm' ? 'le plus donné' : p.sexe === 'f' ? 'féminin' : 'masculin'}`) : ''}
${chiffre(nf(nTot), `naissances en <span class="nw">${AN1 - 2}-${AN1}</span>`)}
${chiffre(unSur(p.f), 'en France, filles et garçons')}
${fiable ? chiffre(majuscule(tendanceMot(p.t)), `${pctTendance(p.t)} % par an récemment`) : chiffre(`≈ ${nf(parAn)}`, `bébé${parAn > 1 ? 's' : ''} par an`)}
${chiffre(`${nf(p.o)}/100`, 'originalité')}
</dl>`}

<nav class="sommaire" aria-label="Sur cette page"><ul>${liensSommaire}</ul></nav>

<section class="bloc" id="sens"><h2>Signification et origine de ${esc(p.l)}</h2>
<div class="carte"><p>${phraseSens}</p>${doute}</div></section>

${p.hf ? '' : `<section class="bloc" id="popularite"><h2>Popularité de ${esc(p.l)} depuis ${p.sr || !p.nb ? AN0 : B0}</h2>
<ul class="faits">${faits.map(f => `<li>${f}</li>`).join('')}</ul></section>`}

${monde}


${graphies.length ? `<section class="bloc" id="graphies"><h2>Même prononciation, autres graphies</h2>
<ul class="graphies">${(() => { const max = Math.max(1, ...graphies.map(x => x.n)); return graphies.map(x => {
  const nom = aPage(x) && x.slug !== p.slug ? `<a class="g" href="${url(x)}">${esc(x.l)}</a>` : `<span class="g">${esc(x.l)}</span>`
  return `<li>${nom}<i style="--w:${x.hf ? 0 : Math.round(100 * x.n / max)}%"></i>${x.hf ? '<small>ailleurs</small>' : `<b>${nf(x.n)}</b>`}</li>` }).join('') })()}</ul>
<p class="doute">Nombre de naissances ${AN1 - 2}-${AN1}. À l’école, on les entend pareil : c’est ce total qui compte pour savoir si l’enfant sera seul à porter son prénom.</p></section>` : ''}

${p.dm.length ? `<section class="bloc"><h2>Diminutifs</h2><ul class="puces">${p.dm.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></section>` : ''}

${cta(p)}

<section class="bloc" id="proches"><h2>Prénoms proches de ${esc(p.l)}</h2>
<ul class="noms-grands">${proches(p).map(x => `<li><a href="${url(x)}">${esc(x.l)}</a></li>`).join('')}</ul></section>

<section class="bloc"><h2>${classe.length ? `${esc(p.l)} dans les classements` : 'À voir aussi'}</h2>
<ul class="rangs">${voir.join('')}</ul></section>
`
  return page({
    chemin: url(p), titre, description, corps, indexer: indexable(p), genre: genreDe(p.sexe), champ: champOrigine(p.g[0]), classe: 'fiche', sommaire: liensSommaire,
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
  // Sur un écran étroit, on affiche l'entier arrondi (« +53 % » pour 52,6) :
  // la décimale faisait déborder la dernière colonne. Les deux formes sont
  // dans la page, le CSS choisit.
  const tend = tendanceHtml
  const legende = `Naissances en France de ${AN1 - 2} à ${AN1} (INSEE)${colonne === 'tendance'
    ? ' ; tendance : évolution moyenne par an sur les dernières années.' : ' ; originalité sur 100 : plus elle est haute, plus le prénom est rare.'}`
  return `<div class="tableau r"><table><caption>${legende}</caption>
<thead><tr><th scope="col" class="rg">#</th><th scope="col">Prénom</th><th scope="col" class="o">Origine</th><th scope="col" class="n"><span class="long">Naissances</span><abbr class="court" title="Naissances">Naiss.</abbr></th><th scope="col" class="n">${colonne === 'tendance' ? 'Tendance' : '<span class="long">Originalité</span><abbr class="court" title="Originalité sur 100">Orig.</abbr>'}</th></tr></thead><tbody>
${xs.map((x, i) => `<tr><td class="rg">${i + 1}</td><td><a href="${url(x)}"><b>${esc(x.l)}</b></a></td><td class="o">${esc(liste(x.g.map(ORIGINE_LIB)))}</td><td class="n">${x.hf ? '<small title="Donné au Québec, en Belgique ou en Suisse, pas en France">ailleurs</small>' : nf(x.n)}</td><td class="n">${x.hf ? '' : colonne === 'tendance' ? tend(x.t) : `${nf(x.o)}<span class="v-long">/100</span>`}</td></tr>`).join('')}
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
const empreintes = new Map()                   // chemin -> hash du HTML, pour IndexNow
function ecrire(chemin, html) {
  empreintes.set(chemin, createHash('sha1').update(html).digest('hex').slice(0, 16))
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
  if (indexable(e[0])) urls.push(url(e[0]))
}

// Les origines, de la plus représentée à la plus rare : c'est l'ordre dans
// lequel on les cherche (latine avant finno-ougrienne), pas l'alphabet.
const listesOrigines = listes.filter(L => L.origine).sort((a, b) => b.total - a.total)
const carteOrigine = L => `<li><a href="${L.chemin}" style="--champ:var(--${champOrigine(L.origine)})"><b>${esc(majuscule(ORIGINE_F(L.origine)))}</b><span>${nf(L.total)} prénoms</span><small>${L.xs.slice(0, 3).map(x => esc(x.l)).join(', ')}</small></a></li>`

for (const L of listes) {
  // Filles ou garçons : le même classement, d'un geste.
  const bascule = L.sexe ? `<nav class="bascule" aria-label="Filles ou garçons">${[['f', 'Filles'], ['m', 'Garçons']].map(([s, t]) =>
    `<a href="${listes.find(x => x.type === L.type && x.sexe === s).chemin}"${actuel(s === L.sexe)}>${t}</a>`).join('')}</nav>` : ''
  const autresOrigines = L.origine ? `<section class="bloc r"><h2>Autres origines</h2><ul class="puces">${listesOrigines.filter(x => x !== L)
    .map(x => `<li><a href="${x.chemin}">${esc(ORIGINE_LIB(x.origine))} <small>${nf(x.total)}</small></a></li>`).join('')}</ul></section>` : ''
  ecrire(L.chemin, page({
    chemin: L.chemin, titre: L.titre, description: L.description,
    rubrique: L.origine ? 'origines' : L.type, genre: genreDe(L.sexe), champ: L.origine ? champOrigine(L.origine) : CHAMP_LISTE[L.type],
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

// ---------------------------------------------------------------- le monde
/**
 * Les prénoms dans chaque pays dont les chiffres sont publics
 * (pipeline/pays.py) : une page par pays et par sexe, en français, pour qui
 * cherche « prénoms américains », « prénom suédois fille », « prénoms
 * belges »… Chaque page : le top 100 de là-bas avec, à côté, ce qu'il pèse en
 * France ; ceux qui montent ; ceux qui y sont courants et restent rares ici.
 * Chaque chiffre porte sa source.
 */
for (const x of PAYS_MONDE) {
  const [, adj, titreBase] = MONDE[x.code]
  const sexes = x.par_sexe ? ['f', 'm'] : ['x']
  for (const s of sexes) {
    const sx = s === 'f' ? 0 : s === 'm' ? 1 : 2
    const rows = lignesPays.get(x.code).filter(r => r[1] === sx).sort((a, b) => b[2] - a[2])
    if (rows.length < 20) continue
    const tot = s === 'x' ? x.total : x.total[s]
    const top = rows.slice(0, 100)
    const montent = rows.filter(r => r[4] !== null && r[2] >= 60).sort((a, b) => b[4] - a[4]).slice(0, 20)
    // Courants là-bas, rares ou absents en France : la vraie trouvaille.
    const decouvertes = rows.slice(0, 400).filter(r => { const fr = parLabel.get(r[0]); return !fr || fr.hf || fr.n < 60 }).slice(0, 30)
    const pour = s === 'f' ? ' de fille' : s === 'm' ? ' de garçon' : ''
    const chemin = cheminPays(x, s)
    const h = `${titreBase}${pour}`
    const en = enPays(x)
    const bascule = x.par_sexe ? `<nav class="bascule" aria-label="Filles ou garçons">${[['f', 'Filles'], ['m', 'Garçons']].map(([g, t]) =>
      `<a href="${cheminPays(x, g)}"${actuel(g === s)}>${t}</a>`).join('')}</nav>` : ''
    const autres = `<section class="bloc r"><h2>Les autres pays</h2><ul class="puces">${PAYS_MONDE.filter(y => y !== x)
      .map(y => `<li><a href="${cheminPays(y, s === 'x' ? 'f' : s)}">${esc(y.nom)}</a></li>`).join('')}</ul></section>`
    ecrire(chemin, page({
      chemin, rubrique: 'monde', genre: s === 'm' ? 'garcons' : 'filles', champ: 'menthe',
      titre: `${h} : les 100 plus donnés ${en} (${x.annees[0]}-${x.annees[1]})`,
      description: `Les prénoms${pour} les plus donnés ${en} de ${x.annees[0]} à ${x.annees[1]}, d’après ${x.sigle || x.organisme} : rang, fréquence, tendance, et ce qu’ils pèsent en France.`,
      fil: [{ n: 'Dans le monde', u: '/prenoms/monde/' }, { n: h, u: chemin }],
      corps: `<section class="hero court">${h1(h)}<p class="sous">Les ${top.length} prénoms${pour} les plus donnés ${x.membres ? x.membres.map(m => esc(GROUPES[x.code].membres[m.code][2])).join(' et ') : esc(en)}, de ${x.annees[0]} à ${x.annees[1]}. ${badgePays(x)}</p></section>
${bascule}${tableauPays(x, top, tot)}
${x.note ? `<p class="doute">${esc(x.note[0].toUpperCase() + x.note.slice(1))}.</p>` : ''}
${decouvertes.length ? `<section class="bloc r"><h2>Courants ${esc(en)}, rares en France</h2>
<p>Des prénoms${pour} bien installés ${esc(en)} mais presque jamais donnés en France : de quoi sortir des listes habituelles.</p>
<ul class="puces">${decouvertes.map(r => { const l = lienPrenom(r[0]); return `<li>${l ? `<a href="${l}">` : '<span>'}${esc(r[0])} <small>${r[3]}<sup>e</sup></small>${provinces(x, r)}${l ? '</a>' : '</span>'}</li>` }).join('')}</ul></section>` : ''}
${montent.length ? `<section class="bloc r"><h2>Ceux qui montent ${esc(en)}</h2>
<ul class="puces">${montent.map(r => { const l = lienPrenom(r[0]); return `<li>${l ? `<a href="${l}">` : '<span>'}${esc(r[0])} <small>${pctTendance(r[4], 0)} %</small>${provinces(x, r)}${l ? '</a>' : '</span>'}</li>` }).join('')}</ul></section>` : ''}
<section class="bloc r"><h2>D’où viennent ces chiffres</h2>${(x.membres ?? [x]).map(m => `<p>${x.membres ? `<b>${esc(GROUPES[x.code].membres[m.code][1])}</b> : ` : ''}${esc(m.organisme)}, « ${esc(m.jeu)} », naissances de ${m.annees[0]} à ${m.annees[1]}. Licence : ${esc(m.licence)}. Seuil de publication : ${esc(m.seuil || 'non précisé')}, un prénom absent n’est donc pas forcément jamais donné.</p>`).join('')}<p>${x.membres ? 'Les naissances des provinces sont additionnées, la fréquence rapportée à leurs naissances réunies. ' : ''}La tendance compare la part du prénom dans les naissances avec celle d’il y a cinq ans.</p></section>
${autres}
${cta(null)}`
    }))
    urls.push(chemin)
  }
}

if (PAYS_MONDE.length) {
  const carte = x => {
    const tops = (x.par_sexe ? [['f', 'Filles', 0], ['m', 'Garçons', 1]] : [['x', 'Tous', 2]]).map(([s, t, sx]) =>
      `<div><p class="genre">${t}</p><ol class="apercu">${lignesPays.get(x.code).filter(r => r[1] === sx).sort((a, b) => b[2] - a[2]).slice(0, 3)
        .map(r => `<li>${esc(r[0])}</li>`).join('')}</ol><a class="suite" href="${cheminPays(x, s === 'x' ? 'f' : s)}">Le top 100<span class="vh"> ${esc(enPays(x))}${s === 'm' ? ', garçons' : s === 'f' ? ', filles' : ''}</span></a></div>`).join('')
    return `<article class="carte classement r"><h3>${esc(MONDE[x.code][2])}</h3><p>${esc(x.membres ? x.membres.map(m => GROUPES[x.code].membres[m.code][1]).join(', ') : x.nom)}, ${x.annees[0]}-${x.annees[1]} ${badgePays(x)}</p><div class="duo">${tops}</div></article>`
  }
  ecrire('/prenoms/monde/', page({
    chemin: '/prenoms/monde/', rubrique: 'monde', champ: 'menthe',
    titre: `Prénoms du monde : les plus donnés dans ${PAYS_MONDE.length + 1} pays`,
    description: `Prénoms américains, anglais, belges, suisses, québécois, suédois, polonais… les plus donnés dans ${PAYS_MONDE.length} pays, chiffres officiels à l’appui, comparés à la France.`,
    fil: [{ n: 'Dans le monde', u: '/prenoms/monde/' }],
    corps: `<section class="hero court">${h1('Les prénoms dans le monde')}<p class="sous">Les prénoms les plus donnés dans ${PAYS_MONDE.length} pays, d’après leurs instituts statistiques, et ce qu’ils pèsent en France.</p></section>
<section class="bloc"><div class="classements">${PAYS_MONDE.map(carte).join('')}</div></section>
<p class="doute">Chaque pays publie ses prénoms à sa façon (seuils, accents, années) : chaque page le précise, avec un lien vers la source.</p>
${cta(null)}`
  }))
  urls.push('/prenoms/monde/')
}

// Les origines, toutes, avec de quoi reconnaître chacune.
ecrire('/prenoms/origines/', page({
  chemin: '/prenoms/origines/', rubrique: 'origines', champ: 'sable',
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
    chemin, rubrique: 'lettres', champ: 'sable', fil: [{ n: `Lettre ${L}`, u: chemin }],
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
    stat: x => `${pctTendance(x.t, 0)} %`, nom: 'qui montent' },
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
  chemin: '/prenoms/', champ: 'fond',
  titre: `Prénoms : ${nf(pages.size)} fiches avec signification, origine et popularité`,
  description: `Signification, origine et courbe de popularité de ${nf(pages.size)} prénoms donnés en France, d’après les naissances INSEE. Tendances, prénoms rares, par origine.`,
  corps: `<section class="hero">${h1('Trouver un prénom')}<p class="sous">${nf(pages.size)} prénoms donnés en France, avec leurs vrais chiffres : le sens, l’origine, et les naissances depuis ${AN0}.</p>${formRecherche()}</section>
<section class="bloc"><h2>Les classements</h2><div class="classements">${CLASSEMENTS.map(carteClassement).join('')}</div></section>
<section class="bloc r"><h2>Par origine</h2><ul class="origines six">${listesOrigines.slice(0, 6).map(carteOrigine).join('')}</ul>
<p class="suite-bloc"><a class="suite" href="/prenoms/origines/">Les ${listesOrigines.length} origines</a></p></section>
<section class="bloc r"><h2>Dans le monde</h2><ul class="puces">${PAYS_MONDE.map(x => `<li><a href="${cheminPays(x, 'f')}">${esc(MONDE[x.code][2])}</a></li>`).join('')}</ul>
<p class="suite-bloc"><a class="suite" href="/prenoms/monde/">Les ${PAYS_MONDE.length} pays</a></p></section>
<section class="bloc r" id="lettres"><h2>Par lettre</h2>${alphabet(null)}</section>
${offrir}
${cta(null)}`
}))
urls.unshift('/prenoms/')

ecrire(CHERCHER, page({
  chemin: CHERCHER,
  titre: 'Chercher un prénom : existe-t-il en France ? Sens, origine, popularité',
  description: `Vérifiez si un prénom existe et combien de bébés le portent en France depuis ${AN0}, d’après l’INSEE. Signification, origine, orthographes proches et prénoms qui sonnent pareil.`,
  fil: [{ n: 'Chercher un prénom', u: CHERCHER }],
  corps: `<section class="hero court">${h1('Chercher un prénom')}<p class="sous">Tapez un prénom : sa fiche, combien de bébés l’ont reçu depuis 1900, et ceux qui s’en approchent.</p>${formRecherche(true)}</section>
<section class="bloc r"><h2>Ce prénom existe-t-il ?</h2><p>La recherche couvre tous les prénoms publiés par l’INSEE, donnés en France de ${AN0} à ${AN1}, même les plus rares. Un prénom qui n’y figure pas n’a pas forcément jamais été donné : l’INSEE ne publie un prénom qu’à partir de 3 naissances, en dessous il reste dans l’ombre du secret statistique.</p>
<p>Et un prénom inédit reste possible : depuis la loi du 8 janvier 1993, les parents choisissent librement. L’officier d’état civil ne peut que saisir le procureur s’il juge le prénom contraire à l’intérêt de l’enfant.</p></section>
<section class="bloc r"><h2>Orthographes et prénoms qui sonnent pareil</h2><p>Maëlys, Maelys, Maélis : pour l’INSEE, ce sont des prénoms différents, comptés à part. La recherche vous propose les orthographes voisines et les prénoms qui se prononcent de la même façon, avec le nombre de bébés de chacun. Pratique pour savoir si l’orthographe que vous aimez est rare, ou si le prénom est en fait très courant sous une autre forme.</p></section>
<section class="bloc r"><h2>Ce que dit chaque fiche</h2><ul class="puces"><li>La signification et l’origine, quand elles sont établies.</li><li>La courbe des naissances depuis ${AN0}.</li><li>La tendance récente : il monte, il se maintient ou il recule.</li><li>Les autres orthographes et leur poids.</li><li>Sa place au Québec, en Belgique et en Suisse, chiffres officiels à l’appui.</li></ul></section>
${cta(null)}`,
  jsonld: [{
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Chercher un prénom',
    url: SITE + CHERCHER, applicationCategory: 'ReferenceApplication', operatingSystem: 'Web', inLanguage: 'fr-FR',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, isPartOf: { '@type': 'WebSite', name: MARQUE, url: SITE + '/' }
  }]
}))
urls.splice(1, 0, CHERCHER)

// ---------------------------------------------------------------- fiches INSEE
/**
 * Tout prénom publié par l'INSEE a sa fiche. Ceux qui n'ont pas de page ici
 * (rares, sans sens établi, ou plus donnés depuis 1986) sont rendus par le
 * Worker à la demande : voir scripts/fiches-insee.mjs. On écrit ici le modèle
 * (dans server/assets, il part avec le Worker) et les tranches de données.
 * Noindex : des chiffres seuls ne font pas une page pour Google.
 */
{
  const F = construireFichesInsee({ pages, slugDe, racine: RACINE })
  const tranches = Object.fromEntries([...F.tranches].map(([k, t]) => [k, enStatique(`fiche-${k}`, 'txt', t)]))
  const modele = page({
    chemin: '/prenom/__SLUG__/', titre: '__TITRE__', description: '__DESCRIPTION__', indexer: false,
    corps: '__CORPS__', genre: 'filles',
    fil: [{ n: 'Lettre __LETTRE_MAJ__', u: '/prenoms/lettre/__LETTRE__/' }, { n: '__NOM__', u: '/prenom/__SLUG__/' }]
  })
  const dossier = resolve(RACINE, 'server/assets/fiches')
  mkdirSync(dossier, { recursive: true })
  writeFileSync(resolve(dossier, 'modele.html'), modele)
  writeFileSync(resolve(dossier, 'sommaire.json'), JSON.stringify({
    an1: F.an1, lettres, chercher: CHERCHER, prix: PRIX, tranches
  }))
  console.log(`fiches INSEE : ${F.total} prénoms, ${F.tranches.size} tranches, rendues par le Worker`)
}

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
  chemin: APP, appel: { texte: 'Ouvrir l’app', href: '/' }, champ: 'peche',
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
# Les liens d'invitation : chacun porte le code d'une liste.
Disallow: /rejoindre/
# Les liens des fiches vers l'app (/?ref=seo&prenom=…) : 7 000 variantes de
# la meme coquille JavaScript, rien a indexer.
Disallow: /?

Sitemap: ${SITE}/sitemap.xml
`)

// IndexNow : la cle a la racine, et l'empreinte de chaque URL du sitemap,
// hors public/ (jamais servie), que scripts/indexnow.mjs compare au dernier envoi.
writeFileSync(resolve(SORTIE, `${INDEXNOW_CLE}.txt`), INDEXNOW_CLE)
writeFileSync(resolve(SORTIE === PUBLIC ? RACINE : SORTIE, '.seo-empreintes.json'), JSON.stringify({
  site: SITE, cle: INDEXNOW_CLE,
  urls: Object.fromEntries(['/', ...urls].map(u => [u, empreintes.get(u) ?? MAJ]))
}, null, 1))

console.log(`[seo] indexables : ${tetes.filter(indexable).length} fiches sur ${pages.size} (>= ${INDEX_NAISSANCES} naissances ou pic >= ${INDEX_PIC}/10 000)`)
console.log(`[seo] ${pages.size} fiches, ${listes.length + lettres.length + 2} listes, page de l’app, llms.txt, sitemap ${urls.length + 1} URL, domaine ${SITE}`)
