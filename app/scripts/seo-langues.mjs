#!/usr/bin/env node
/**
 * Les pages statiques dans les autres langues de l'app, générées APRÈS
 * scripts/seo.mjs et scripts/seo-plus.mjs (npm run build), dans le même
 * dossier :
 *
 *   - Une page d'ACCUEIL de l'app par langue : /en/, /de/, /nl/, /sv/, /nb/,
 *     /pl/, /lv/ (la française est /choisir-un-prenom-a-deux/, écrite par
 *     seo.mjs). Leur texte est celui des fiches App Store déjà traduites
 *     (mobile/fiches-stores/<code>.md), LU ICI à chaque build : une seule
 *     rédaction, la page et le store ne peuvent pas se contredire. Si la
 *     fiche change de forme (sections), le build casse au lieu de publier une
 *     page bancale. Liens hreflang croisés entre les huit (scripts/langues.mjs).
 *
 *   - Une section ANGLAISE « French baby names » (/en/french-names/) : une
 *     fiche par prénom QUI A UN SENS EN ANGLAIS (scripts/donnees/sens-en.json),
 *     et des listes (populaires, tendance, rétro, courts, mixtes, par
 *     origine). Le catalogue reste celui de la France : la section le dit en
 *     tête, comme les fiches des stores. Chaque fiche anglaise et sa fiche
 *     française s'annoncent l'une l'autre (hreflang ; la règle est partagée
 *     avec seo.mjs).
 *
 * Gabarit : le <style> et les préchargements de polices sont REPRIS d'une
 * page que seo.mjs vient d'écrire (comme seo-plus) : une seule charte. Mais
 * l'en-tête, les menus et le pied de page sont réécrits ici, dans la langue
 * de la page — on ne peut pas traduire un gabarit français par remplacements.
 * Aucun script en ligne (politique de contenu des pages statiques) : le seul
 * script est le fichier du sommaire, repris d'une fiche française.
 *
 * Il complète enfin le sitemap, llms.txt et les empreintes lues par
 * scripts/indexnow.mjs, puis VÉRIFIE que chaque lien interne des pages qu'il
 * a écrites mène à un fichier de public/ ou à une page de l'app : un lien
 * mort casse le build.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dessinerCourbe } from './courbe.mjs'
import { ACCUEILS, alternatesAccueil, liensAlternate, chargerSensEn, aFicheEn, cheminFicheEn, EN_NOMS } from './langues.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(RACINE, 'public')
const SORTIE = process.env.SEO_SORTIE ? resolve(process.env.SEO_SORTIE) : PUBLIC
const SITE = (process.env.NUXT_PUBLIC_SITE_URL || 'https://babynamed.fr').replace(/\/$/, '')
const MARQUE = 'babyNamed'
/** Date de dernière modification annoncée au sitemap (voir MAJ dans seo.mjs). */
const MAJ = '2026-10-12'
const FICHES_STORES = resolve(RACINE, '../mobile/fiches-stores')

/**
 * Les boutons des stores. L'App Store SANS pays dans l'adresse : Apple envoie
 * chacun vers le store de son pays (l'adresse /fr/ de seo.mjs ouvrirait le
 * store français à un Anglais). Google Play : la fiche publique (depuis le
 * 29/10/2026), sans pays non plus.
 */
const APPLE_ID = '6821347375'
const APP_IOS = (process.env.NUXT_PUBLIC_APP_IOS ?? `https://apps.apple.com/app/id${APPLE_ID}`).trim()
const APP_ANDROID = (process.env.NUXT_PUBLIC_APP_ANDROID ?? 'https://play.google.com/store/apps/details?id=fr.babynamed.app').trim()
const GLYPHE_APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.5-2.09-.55-3.24 0-1.44.72-2.2.48-3.08-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.1zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>'
const GLYPHE_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zM16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27zM20.16 10.81c.35.27.58.72.58 1.19 0 .47-.23.91-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.28 1.31zM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z"/></svg>'

// ---------------------------------------------------------------- textes de l'app
/**
 * Ce que l'app a déjà traduit, on le relit ici plutôt que de le recopier :
 * titres, accroche, libellés des stores, noms des pages légales. L'anglais
 * est dans app/textes/<Écran>.ts (bloc `en`), les autres langues dans
 * app/textes/_langues/<code>.ts. Un texte introuvable casse le build.
 */
const TEXTES = resolve(RACINE, 'app/textes')
const CHAINE = `(['"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`
const deschaine = s => s.replace(/\\(['"\\])/g, '$1')
const cacheTextes = new Map()
function texteApp(code, cle) {
  const [espace, nom] = cle.split('.')
  const fichier = code === 'en' ? resolve(TEXTES, `${espace}.ts`) : resolve(TEXTES, '_langues', `${code}.ts`)
  if (!cacheTextes.has(fichier)) cacheTextes.set(fichier, readFileSync(fichier, 'utf8'))
  let src = cacheTextes.get(fichier)
  let m
  if (code === 'en') {
    src = src.slice(src.search(/\ben: \{/))
    m = src.match(new RegExp(`\\b${nom}: ${CHAINE}`))
  } else {
    m = src.match(new RegExp(`'${espace}\\.${nom}': ${CHAINE}`))
  }
  if (!m) throw new Error(`[seo-langues] texte de l'app introuvable : ${cle} (${code})`)
  return deschaine(m[2])
}
/** Les origines en anglais : app/textes/Origines.ts, celles de l'app. */
const ORIGINES_EN = (() => {
  const src = readFileSync(resolve(TEXTES, 'Origines.ts'), 'utf8')
  const bloc = src.slice(src.search(/\ben: \{/))
  const r = {}
  for (const m of bloc.matchAll(new RegExp(`${CHAINE}: ${CHAINE}`, 'g'))) r[deschaine(m[2])] = deschaine(m[4])
  if (!r.latin) throw new Error('[seo-langues] origines anglaises introuvables (app/textes/Origines.ts)')
  // « of modern / coined origin » ne se dit pas.
  r['moderne-inventé'] = 'modern'
  return r
})()

// ---------------------------------------------------------------- fiches des stores
/**
 * La description App Store d'une langue, découpée : l'introduction, puis sept
 * sections à titre en capitales, toujours dans le même ordre (voir
 * mobile/fiches-stores/LISEZMOI.md) :
 *   0 d'où viennent les prénoms, 1 comment ça marche, 2 pourquoi à l'aveugle,
 *   3 des chiffres, 4 déjà pris et vetos, 5 gratuit avec une option,
 *   6 vos données (suivie du mot de la fin : le lien pour l'autre parent,
 *     les langues de l'app).
 * La description App Store, pas celle de Google Play : celle-ci dit que
 * « l'app Android ne vend rien », faux sur le web.
 */
function ficheStore(code) {
  const f = resolve(FICHES_STORES, `${code}.md`)
  if (!existsSync(f)) throw new Error(`[seo-langues] fiche store introuvable : ${f}`)
  const md = readFileSync(f, 'utf8')
  const champ = titre => {
    const i = md.indexOf(`## ${titre}`)
    const m = i >= 0 && md.slice(i).match(/```\n([\s\S]*?)\n```/)
    if (!m) throw new Error(`[seo-langues] ${code}.md : champ « ${titre} » introuvable`)
    return m[1].trim()
  }
  const intl = ACCUEILS.find(a => a.code === code).intl
  const titreSection = l => l.length < 60 && /\p{L}/u.test(l) && !l.startsWith('•') && l === l.toLocaleUpperCase(intl)
  const intro = []
  const sections = []
  let para = []
  const fermer = () => {
    if (!para.length) return
    ;(sections.length ? sections.at(-1).paras : intro).push(para)
    para = []
  }
  for (const ligne of champ('App Store — Description').split('\n').map(l => l.trim())) {
    if (!ligne) { fermer(); continue }
    if (titreSection(ligne)) { fermer(); sections.push({ titre: ligne, paras: [] }); continue }
    para.push(ligne)
  }
  fermer()
  if (sections.length !== 7 || !intro.length || sections.some(s => !s.paras.length)
    || !sections[1].paras[0].every(l => l.startsWith('•')) || sections[1].paras[0].length < 5) {
    throw new Error(`[seo-langues] ${code}.md : la description App Store n'a plus la forme attendue (intro + 7 sections, « comment ça marche » en 5 puces)`)
  }
  return { sousTitre: champ('App Store — Sous-titre'), promo: champ('App Store — Texte promotionnel'), intro, sections }
}

/**
 * Ce que les fiches des stores ne disent pas : les boutons, la FAQ, l'appel
 * final, le pied de page. Les réponses de la FAQ, elles, sont des passages
 * des fiches (la même phrase, pas une seconde rédaction).
 * Les titres de section : ceux de la fiche, en minuscules (l'allemand garde
 * ses majuscules de noms : écrits ici).
 */
const UI = {
  en: { commencer: 'Start for free', ouvrir: 'Open the app', faq: 'Frequently asked questions', langues: 'Languages', fil: 'Breadcrumb',
    q: ['Does my partner see my answers?', 'Where do the names come from?', 'Is it free?', 'Can more than two of us take part?', 'What happens to my data?'],
    ctaTitre: 'Start now', ctaTexte: 'Create your list in a minute, then send the link to the other parent.',
    source: (a, b) => `Names and figures: births in France, INSEE (${a}–${b}).`,
    noms: 'French names in English', nomsTexte: 'Meaning, origin and births in France of each name, with the rankings: trending, top 100, classic, short.' },
  de: { commencer: 'Kostenlos starten', ouvrir: 'App öffnen', faq: 'Häufige Fragen', langues: 'Sprachen', fil: 'Brotkrümelnavigation',
    q: ['Sieht die andere Person meine Antworten?', 'Woher kommen die Namen?', 'Ist es kostenlos?', 'Können mehr als zwei mitmachen?', 'Was passiert mit meinen Daten?'],
    ctaTitre: 'Jetzt starten', ctaTexte: 'Erstelle deine Liste in einer Minute und schick den Link an den anderen Elternteil.',
    source: (a, b) => `Namen und Zahlen: Geburten in Frankreich, INSEE (${a}–${b}).`,
    titres: ['Woher die Namen kommen', 'So funktioniert es', 'Warum blind', 'Zahlen statt Trendliste', 'Schon vergeben und Veto', 'Kostenlos, mit einer Option', 'Deine Daten'] },
  nl: { commencer: 'Gratis beginnen', ouvrir: 'App openen', faq: 'Veelgestelde vragen', langues: 'Talen', fil: 'Kruimelpad',
    q: ['Ziet mijn partner mijn antwoorden?', 'Waar komen de namen vandaan?', 'Is het gratis?', 'Kunnen we met meer dan twee zijn?', 'Wat gebeurt er met mijn gegevens?'],
    ctaTitre: 'Nu beginnen', ctaTexte: 'Maak je lijst in een minuut en stuur de link naar de andere ouder.',
    source: (a, b) => `Namen en cijfers: geboorten in Frankrijk, INSEE (${a}–${b}).` },
  sv: { commencer: 'Kom igång gratis', ouvrir: 'Öppna appen', faq: 'Vanliga frågor', langues: 'Språk', fil: 'Brödsmulor',
    q: ['Ser min partner mina svar?', 'Var kommer namnen ifrån?', 'Är det gratis?', 'Kan vi vara fler än två?', 'Vad händer med mina uppgifter?'],
    ctaTitre: 'Kom igång nu', ctaTexte: 'Skapa din lista på en minut och skicka länken till den andra föräldern.',
    source: (a, b) => `Namn och siffror: födslar i Frankrike, INSEE (${a}–${b}).` },
  nb: { commencer: 'Kom i gang gratis', ouvrir: 'Åpne appen', faq: 'Vanlige spørsmål', langues: 'Språk', fil: 'Brødsmulesti',
    q: ['Ser partneren min svarene mine?', 'Hvor kommer navnene fra?', 'Er det gratis?', 'Kan vi være flere enn to?', 'Hva skjer med dataene mine?'],
    ctaTitre: 'Kom i gang nå', ctaTexte: 'Lag listen din på et minutt, og send lenken til den andre forelderen.',
    source: (a, b) => `Navn og tall: fødsler i Frankrike, INSEE (${a}–${b}).` },
  pl: { commencer: 'Zacznij za darmo', ouvrir: 'Otwórz aplikację', faq: 'Najczęstsze pytania', langues: 'Języki', fil: 'Ścieżka nawigacji',
    q: ['Czy partner widzi moje odpowiedzi?', 'Skąd pochodzą imiona?', 'Czy to jest darmowe?', 'Czy może nas być więcej niż dwoje?', 'Co dzieje się z moimi danymi?'],
    ctaTitre: 'Zacznij teraz', ctaTexte: 'Utwórz listę w minutę, a potem wyślij link drugiemu rodzicowi.',
    source: (a, b) => `Imiona i liczby: urodzenia we Francji, INSEE (${a}–${b}).` },
  lv: { commencer: 'Sākt bez maksas', ouvrir: 'Atvērt lietotni', faq: 'Biežāk uzdotie jautājumi', langues: 'Valodas', fil: 'Navigācijas ceļš',
    q: ['Vai partneris redz manas atbildes?', 'No kurienes nāk vārdi?', 'Vai tas ir bez maksas?', 'Vai var piedalīties vairāk nekā divi?', 'Kas notiek ar maniem datiem?'],
    ctaTitre: 'Sāciet tagad', ctaTexte: 'Izveidojiet sarakstu minūtes laikā un nosūtiet saiti otram vecākam.',
    source: (a, b) => `Vārdi un skaitļi: dzimušie Francijā, INSEE (${a}–${b}).` }
}

// ---------------------------------------------------------------- mise en forme
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const nf = x => Math.round(x).toLocaleString('en-GB')
const dec = (x, n = 1) => x.toLocaleString('en-GB', { maximumFractionDigits: n, minimumFractionDigits: 0 })
const arrondi = (t, n = 1) => { const r = Number(t.toFixed(n)); return r === 0 ? 0 : r }
const pctTendance = (t, n = 1) => { const r = arrondi(t, n); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${dec(Math.abs(r), n)}` }
const classeTendance = (t, n = 1) => { const r = arrondi(t, n); return r > 0 ? 'monte' : r < 0 ? 'baisse' : 'nul' }
/** Même règle que seo.mjs : arrondi d'abord, les deux formes, le CSS choisit. */
const tendanceHtml = t => {
  const long = `<span class="${classeTendance(t)}">${pctTendance(t)}%</span>`
  const court = `<span class="${classeTendance(t, 0)}">${pctTendance(t, 0)}%</span>`
  return pctTendance(t) === pctTendance(t, 0) ? long
    : `<span class="v-long">${long}</span><span class="v-court">${court}</span>`
}
/** Mêmes seuils que tendanceMot() dans seo.mjs. */
function tendanceMot(t) {
  if (t >= 12) return 'rising fast'
  if (t >= 4) return 'rising'
  if (t > -4) return 'stable'
  if (t > -12) return 'falling'
  return 'falling sharply'
}
const suffixe = n => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'
const ord = n => `${nf(n)}<sup>${suffixe(n)}</sup>`
const liste = xs => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1)
const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1)
const actuel = oui => oui ? ' aria-current="page"' : ''
const h1 = t => `<h1${t.length > 20 ? ' class="long"' : ''}>${esc(t)}</h1>`
const h1Nom = t => `<h1 class="nom" style="--t:${Math.min(28, 88 / (Math.max(t.length, 3) * 0.58)).toFixed(1)}vw">${esc(t)}</h1>`
/** 155 caractères au plus (Google coupe vers 155), coupé au mot. */
const DESCRIPTION_MAX = 155
const couper = (t, max = DESCRIPTION_MAX) => {
  if (t.length <= max) return t
  let r = ''
  for (const mot of t.split(/\s+/)) { if ((r ? r + ' ' + mot : mot).length > max - 1) break; r = r ? r + ' ' + mot : mot }
  return r.replace(/[\s,;:(–-]+$/, '') + '…'
}

// ---------------------------------------------------------------- gabarit repris
const MODELE_CHEMIN = resolve(SORTIE, 'prenoms/tendance/filles/index.html')
if (!existsSync(MODELE_CHEMIN)) throw new Error('[seo-langues] lancer scripts/seo.mjs avant : pas de page modèle')
const MODELE = readFileSync(MODELE_CHEMIN, 'utf8')
const STYLE = MODELE.match(/<style>[\s\S]*?<\/style>/)?.[0]
const PRECHARGE = MODELE.match(/(?:<link rel="preload"[^>]*>\n?)+/)?.[0]?.trim()
if (!STYLE || !PRECHARGE) throw new Error('[seo-langues] repère introuvable dans le gabarit : <style> ou préchargement des polices')

const TEINTES = {
  menthe: ['#cae1d9', '#1f3c37'], peche: ['#efc9c3', '#45292e'], sable: ['#e5d9d1', '#372f33'], lavande: ['#d9dcf0', '#2a2e52'],
  miel: ['#f1e1bb', '#3d3420'], sauge: ['#dde4cc', '#2e3725'], brume: ['#e6e2e9', '#262838'], fond: ['#fbfaf9', '#13162b']
}
// La couleur d'une fiche : celle de son origine, comme en français (seo.mjs).
const CHAMPS = ['menthe', 'peche', 'sable', 'lavande', 'miel', 'sauge', 'brume']
const CHAMP_ORIGINE = { germanique: 'menthe', latin: 'peche', arabe: 'sable', 'hébraïque': 'lavande', grec: 'miel', 'moderne-inventé': 'sauge', celtique: 'sauge', 'anglo-saxon': 'lavande', 'français': 'peche', slave: 'miel', scandinave: 'menthe', espagnol: 'peche', italien: 'peche', persan: 'sable', turc: 'sable', 'hébreu': 'lavande' }
const champOrigine = o => {
  if (!o) return 'brume'
  if (CHAMP_ORIGINE[o]) return CHAMP_ORIGINE[o]
  let h = 0
  for (const ch of o) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return CHAMPS[h % (CHAMPS.length - 1)]
}

/**
 * Une page complète, dans la langue `code`. `entete` : le logo et le bouton ;
 * `rangee` : la rangée sous l'en-tête (rubriques ou langues) ; `pied` : le
 * contenu du pied de page.
 */
function page({ code, chemin, titre, description, corps, ariane, jsonld = [], champ = 'brume', alternates = [],
  logo, bouton, rangee = '', pied, classe = '', sommaire = '' }) {
  const canon = SITE + chemin
  const intl = ACCUEILS.find(a => a.code === code).intl
  const ld = [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: ariane.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.n, item: SITE + x.u }))
  }, ...jsonld]
  return `<!doctype html>
<html lang="${code}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canon}">${alternates.length ? '\n' + liensAlternate(SITE, alternates) : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="${MARQUE}"><meta property="og:locale" content="${intl.replace('-', '_')}">
<meta property="og:title" content="${esc(titre)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canon}"><meta property="og:image" content="${SITE}/icone-512.png">
<meta name="theme-color" content="${TEINTES[champ][0]}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${TEINTES[champ][1]}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/logo.png" type="image/png">${APP_IOS ? `
<meta name="apple-itunes-app" content="app-id=${APPLE_ID}">` : ''}
${PRECHARGE}
${STYLE}
${ld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head><body${classe ? ` class="${classe}"` : ''} style="--champ:var(--${champ})">
<a class="aller" href="#contenu">${esc(texteApp(code, 'App.evitement'))}</a>
<header class="h"><div class="l"><a class="m" href="${logo}"><img src="/logo.png" alt="" width="30" height="30">${MARQUE}</a>
<div class="actions"><a class="b p" href="${bouton.href}"${bouton.nofollow ? ' rel="nofollow"' : ''}>${esc(bouton.texte)}</a></div></div>${sommaire ? `
<nav class="sommaire" aria-label="On this page, at the top of the screen"><ul>${sommaire}</ul></nav>` : ''}</header>
${rangee}
<main class="l" id="contenu">
${ariane.length > 1 ? `<nav class="fil" aria-label="${code === 'en' ? 'Breadcrumb' : esc(UI[code].fil)}">${ariane.map((x, i) => i === ariane.length - 1 ? esc(x.n) : `<a href="${x.u}">${esc(x.n)}</a>`).join(' › ')}</nav>` : ''}
${corps}
</main>
<footer><div class="l">
${pied}
</div></footer>${sommaire && SOMMAIRE_JS ? `
<script src="${SOMMAIRE_JS}" defer></script>` : ''}
</body></html>`
}

/** Les boutons des stores, libellés dans la langue de la page (BadgesStores). */
const magasins = code => `<p class="stores">${
  APP_IOS ? `<a class="store store-ios" href="${APP_IOS}" target="_blank" rel="noopener" aria-label="${esc(texteApp(code, 'BadgesStores.appStore'))}">${GLYPHE_APPLE}App Store</a>` : ''}${
  APP_ANDROID ? `<a class="store store-android" href="${APP_ANDROID}" target="_blank" rel="noopener" aria-label="${esc(texteApp(code, 'BadgesStores.googlePlay'))}">${GLYPHE_PLAY}Google Play</a>` : ''}</p>`

/** Les pages légales gardent leur adresse ; l'app les ouvre dans la langue du navigateur. */
const legal = code => `<p>${[['/mentions-legales', 'mentions'], ['/confidentialite', 'confidentialite'], ['/conditions', 'conditions'], ['/accessibilite', 'accessibilite']]
  .map(([u, k]) => `<a href="${u}">${esc(texteApp(code, `pagesLegales.court_${k}`))}</a>`).join(' · ')}</p>`
const languesPied = code => `<p>${ACCUEILS.map(a => a.code === code ? `<b>${esc(a.nom)}</b>`
  : `<a href="${a.chemin}" lang="${a.code}" hreflang="${a.code}">${esc(a.nom)}</a>`).join(' · ')}</p>`
const rangeeLangues = (code, etiquette) => `<nav class="rubriques" aria-label="${esc(etiquette)}"><div class="l"><ul>
${ACCUEILS.map(a => `<li><a href="${a.chemin}" lang="${a.code}" hreflang="${a.code}"${actuel(a.code === code)}>${esc(a.nom)}</a></li>`).join('')}
</ul></div></nav>`

// ---------------------------------------------------------------- données
const d = JSON.parse(readFileSync(resolve(PUBLIC, 'data/catalogue.json'), 'utf8'))
const c = d.cols
const [AN0, AN1] = d.serie_annees ?? [1986, 2025]
const SEUIL_TENDANCE = d.seuil_tendance ?? 60
const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const slugDe = s => sansAccent(s).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
const tous = []
for (let k = 0; k < d.n; k++) {
  tous.push({
    k, l: c.l[k], slug: slugDe(c.l[k]), sexe: d.sexe[c.s[k]], f: c.f[k], n: c.n[k], t: c.t[k], p: c.p[k],
    o: c.o[k], q: !!(c.q && c.q[k]), y: c.y[k], i: c.i[k], gp: c.gp ? c.gp[k] : k,
    g: c.g[k].map(x => d.origines[x]), m: c.m[k], cf: c.cf ? c.cf[k] ?? null : null,
    sr: c.sr ? c.sr[k] : null, rv: !!c.rv[k], hf: !!c.hf?.[k]
  })
}
// Rang par sexe : le même calcul que seo.mjs (un mixte compte des deux côtés).
for (const s of ['f', 'm', 'fm']) {
  tous.filter(p => p.sexe === s || (s !== 'fm' && p.sexe === 'fm'))
    .sort((a, b) => b.n - a.n).forEach((p, i) => { (p.rang ??= {})[s] = i + 1 })
}
const groupes = new Map()
for (const p of tous) { const g = groupes.get(p.gp); g ? g.push(p) : groupes.set(p.gp, [p]) }
for (const g of groupes.values()) g.sort((a, b) => b.n - a.n)
// Les fiches françaises, telles que seo.mjs les a écrites : celles dont le
// fichier existe. Recopier sa règle (sens, histoire depuis 1900…) ferait
// diverger les deux scripts au premier changement ; le fichier ne ment pas,
// et on ne lie jamais vers une page absente.
const pages = new Map()
for (const p of tous) {
  if (!p.slug) continue
  const e = pages.get(p.slug); e ? e.push(p) : pages.set(p.slug, [p])
}
for (const [slug, e] of pages) {
  if (!existsSync(resolve(SORTIE, 'prenom', slug, 'index.html'))) { pages.delete(slug); continue }
  e.sort((a, b) => b.n - a.n)
}
const tetes = [...pages.values()].map(e => e[0])
const tete = slug => pages.get(slug)?.[0]
const SENS_EN = chargerSensEn(RACINE)
const enAnglais = x => aFicheEn(tete(x.slug), SENS_EN)
const EN = tetes.filter(x => aFicheEn(x, SENS_EN))
const inconnus = Object.keys(SENS_EN).filter(s => !aFicheEn(tete(s), SENS_EN))
if (inconnus.length) console.warn(`[seo-langues] ${inconnus.length} sens anglais sans fiche française (ignorés) : ${inconnus.slice(0, 8).join(', ')}${inconnus.length > 8 ? '…' : ''}`)
const sexeOk = (x, s) => x.sexe === s || x.sexe === 'fm'
const unParSon = xs => { const vus = new Set(); return xs.filter(x => !vus.has(x.gp) && vus.add(x.gp)) }
const origineEn = o => ORIGINES_EN[o] ?? o
const slugOrigineEn = o => slugDe(origineEn(o))

// Le lien d'un prénom : sa fiche anglaise, sinon la française, signalée.
const lienNom = (x, classeLien = '') => enAnglais(x)
  ? `<a${classeLien ? ` class="${classeLien}"` : ''} href="${cheminFicheEn(x.slug)}">${esc(x.l)}</a>`
  : `<a${classeLien ? ` class="${classeLien}"` : ''} href="/prenom/${x.slug}/" hreflang="fr">${esc(x.l)}</a> <small>(in French)</small>`

// ---------------------------------------------------------------- pays anglophones
/** Les pays de langue anglaise dont data/pays publie les chiffres. */
const PAYS_EN = {
  'gb-eaw': 'England and Wales', 'gb-sct': 'Scotland', 'gb-nir': 'Northern Ireland', ie: 'Ireland',
  us: 'United States', 'ca-on': 'Ontario (Canada)', 'ca-bc': 'British Columbia (Canada)', nz: 'New Zealand'
}
const ORGANISME_EN = { 'ca-on': 'Government of Ontario, ServiceOntario', 'ca-bc': 'BC Vital Statistics Agency' }
const PAYS_DIR = resolve(PUBLIC, 'data/pays')
const PAYS = existsSync(resolve(PAYS_DIR, 'index.json'))
  ? JSON.parse(readFileSync(resolve(PAYS_DIR, 'index.json'), 'utf8')).pays.filter(x => PAYS_EN[x.code] && existsSync(resolve(PAYS_DIR, `${x.code}.json`)))
  : []
const PX = new Map()                          // libellé -> code -> [ligne f, ligne m, ligne x]
for (const x of PAYS) {
  for (const l of JSON.parse(readFileSync(resolve(PAYS_DIR, `${x.code}.json`), 'utf8')).lignes) {
    if (l[5]) continue
    const m = PX.get(l[0]) ?? PX.set(l[0], {}).get(l[0])
    ;(m[x.code] ??= [null, null, null])[l[1]] = l
  }
}
const totalPour = (x, sx) => typeof x.total === 'number' ? x.total : sx ? x.total[sx] : x.total.f + x.total.m
/** Même calcul que chiffrePays() de seo.mjs : [naissances, rang, tendance]. */
function chiffrePays(p, x) {
  const t = PX.get(p.l)?.[x.code]
  if (!t) return null
  const [f, m, ensemble] = t
  if (ensemble) return [ensemble[2], ensemble[3], ensemble[4]]
  if (p.sexe === 'f') return f ? [f[2], f[3], f[4]] : null
  if (p.sexe === 'm') return m ? [m[2], m[3], m[4]] : null
  const n = (f?.[2] ?? 0) + (m?.[2] ?? 0)
  return n ? [n, null, null] : null
}
/**
 * Une fiche porte toutes les graphies qui ne diffèrent que par les accents
 * (Léo et Leo : une seule URL). Les pays anglophones écrivent presque
 * toujours sans accent : on additionne les graphies de la fiche, le rang est
 * le meilleur, la tendance celle de la graphie la plus donnée là-bas.
 */
function chiffreFiche(entrees, x) {
  const vs = entrees.map(e => chiffrePays(e, x)).filter(Boolean)
  if (!vs.length) return null
  if (vs.length === 1) return vs[0]
  const n = vs.reduce((s, v) => s + v[0], 0)
  const rangs = vs.map(v => v[1]).filter(Boolean)
  return [n, rangs.length ? Math.min(...rangs) : null, [...vs].sort((a, b) => b[0] - a[0])[0][2]]
}
function anglophones(p, rangFrance) {
  if (!PAYS.length) return ''
  const sx = p.sexe === 'f' || p.sexe === 'm' ? p.sexe : null
  const entrees = pages.get(p.slug)
  const vus = PAYS.map(x => ({ x, v: chiffreFiche(entrees, x) }))
  const presents = vus.filter(e => e.v).sort((a, b) => b.v[0] / totalPour(b.x, sx) - a.v[0] / totalPour(a.x, sx))
  if (!presents.length) return ''
  const absents = vus.filter(e => !e.v)
  const lignes = presents.map(({ x, v }) => {
    const titre = `${ORGANISME_EN[x.code] ?? x.organisme}, births ${x.annees[0]}–${x.annees[1]}`
    const badge = `<a class="badge" href="${esc(x.url)}" rel="noopener" title="${esc(titre)}">${esc(x.sigle || x.organisme)} · ${x.annees[0]}-${String(x.annees[1]).slice(2)}</a>`
    const [n, rang, t] = v
    const qui = !x.par_sexe || !sx ? 'baby' : sx === 'f' ? 'girl' : 'boy'
    const parts = [
      rang && rang <= 2000 ? `<b>${ord(rang)} ${x.par_sexe && sx ? (sx === 'f' ? 'girls’ name' : 'boys’ name') : 'name'}</b>` : '',
      `<span>${nf(n)} babies in 3 years</span>`,
      `<span>1 ${qui} in ${nf(totalPour(x, sx) / n)}</span>`,
      t !== null && t !== undefined ? `<span class="${classeTendance(t)}">${pctTendance(t)}% a year</span>` : ''
    ].filter(Boolean)
    return `<li><div class="tete"><b>${esc(PAYS_EN[x.code])}</b>${badge}</div><p class="valeur">${parts.join('')}</p></li>`
  })
  const classes = presents.filter(e => e.v[1] && e.v[1] <= 300).sort((a, b) => a.v[1] - b.v[1]).slice(0, 3)
    .map(e => `${ord(e.v[1])} in ${esc(PAYS_EN[e.x.code])}`)
  const France = rangFrance && rangFrance <= 2000 ? `, against ${ord(rangFrance)} in France` : ''
  const phrase = classes.length ? `<p>${esc(p.l)} ranks ${liste(classes)}${France}.</p>` : ''
  return `<section class="bloc" id="english-speaking"><h2>${esc(p.l)} in English-speaking countries</h2>${phrase}
<ul class="ailleurs">${lignes.join('')}</ul>
${absents.length ? `<p class="doute">Rarely or never given (below the publication threshold): ${esc(liste(absents.map(e => PAYS_EN[e.x.code])))}.</p>` : ''}
<p class="doute">Official figures from each country, over their latest three published years. ${entrees.length > 1
  ? `The spellings ${esc(liste(entrees.map(e => e.l)))} are counted together; other spellings are counted apart.`
  : `Counted as written: other spellings are counted apart.`}</p></section>`
}

// ---------------------------------------------------------------- anglais : navigation
const GENRE_EN = { f: 'girl', m: 'boy', fm: 'unisex' }
const QUI_EN = { f: 'Girl’s name', m: 'Boy’s name', fm: 'Unisex name' }
const motSexe = { f: 'girls', m: 'boys' }
const RUBRIQUES_EN = g => [
  ['trending', 'Trending', `${EN_NOMS}trending/${g}/`],
  ['popular', 'Top 100', `${EN_NOMS}popular/${g}/`],
  ['classic', 'Classic', `${EN_NOMS}classic/`],
  ['short', 'Short', `${EN_NOMS}short/`],
  ['unisex', 'Unisex', `${EN_NOMS}unisex/`],
  ['origins', 'Origins', `${EN_NOMS}#origins`]
]
const rangeeEn = (rubrique, g = 'girls') => `<nav class="rubriques" aria-label="Sections"><div class="l"><ul>
${RUBRIQUES_EN(g).map(([id, t, u]) => `<li><a href="${u}"${actuel(id === rubrique)}>${t}</a></li>`).join('')}
</ul></div></nav>`

// ---------------------------------------------------------------- anglais : listes
const listesEn = []
// Pour les listes : n'importe quel prénom donné en France (lien vers sa fiche
// française s'il n'a pas de fiche anglaise). Les A-Z : seulement les fiches anglaises.
const aSens = x => !!x.m || x.g.length > 0
for (const s of ['f', 'm']) {
  const nom = motSexe[s]
  const tend = unParSon(tetes.filter(x => sexeOk(x, s) && !x.hf && x.n >= 150 && x.t > 0).sort((a, b) => b.t - a.t)).slice(0, 60)
  listesEn.push({
    type: 'trending', sexe: s, chemin: `${EN_NOMS}trending/${nom}/`, champ: 'peche', xs: tend,
    titre: `Trending French ${s === 'f' ? 'girl' : 'boy'} names: the ${tend.length} rising fastest in France`,
    description: `The ${tend.length} French ${s === 'f' ? 'girl' : 'boy'} names rising fastest, calculated from INSEE birth figures up to ${AN1}: not a trendy pick, a measurement.`,
    h1: `French ${s === 'f' ? 'girl' : 'boy'} names on the rise`,
    sous: `The ${tend.length} ${s === 'f' ? 'girl' : 'boy'} names growing fastest in France.`,
    note: `Ranked by average yearly growth over recent years of INSEE birth figures, among names given at least 150 times from ${AN1 - 2} to ${AN1}.`
  })
  const pop = tetes.filter(x => sexeOk(x, s) && !x.hf).sort((a, b) => b.n - a.n).slice(0, 100)
  listesEn.push({
    type: 'popular', sexe: s, chemin: `${EN_NOMS}popular/${nom}/`, champ: 'lavande', xs: pop,
    titre: `Top 100 French ${s === 'f' ? 'girl' : 'boy'} names (${AN1 - 2}–${AN1})`,
    description: `The 100 most given ${s === 'f' ? 'girl' : 'boy'} names in France according to INSEE, ${AN1 - 2}–${AN1}, with origin, meaning in English and trend.`,
    h1: `Top 100 French ${s === 'f' ? 'girl' : 'boy'} names`,
    sous: `The most given ${s === 'f' ? 'girl' : 'boy'} names in France, ${AN1 - 2}–${AN1}.`,
    note: `Births from ${AN1 - 2} to ${AN1}, source INSEE. A unisex name counts in both rankings.`
  })
}
{
  const xs = unParSon(tetes.filter(x => x.rv && !x.hf).sort((a, b) => b.n - a.n)).slice(0, 100)
  listesEn.push({
    type: 'classic', chemin: `${EN_NOMS}classic/`, champ: 'miel', xs, genre: true,
    titre: `Classic French names making a comeback: ${xs.length} retro names`,
    description: 'Old French first names given again today: girls and boys, with their meaning in English and their births in France (INSEE).',
    h1: 'Classic French names coming back', sous: `${xs.length} retro names that French parents are choosing again.`,
    note: `Names that were common in France in the past, faded, and are being given again (INSEE birth curves since ${AN0}).`
  })
}
{
  const xs = tetes.filter(x => !x.hf && aSens(x) && x.n >= 20 && !x.l.includes('-')
    && sansAccent(x.l).replace(/[^a-z]/g, '').length <= 4).sort((a, b) => b.n - a.n).slice(0, 120)
  listesEn.push({
    type: 'short', chemin: `${EN_NOMS}short/`, champ: 'sable', xs, genre: true,
    titre: `Short French names: ${xs.length} names of 4 letters or fewer`,
    description: 'Short French first names (3 or 4 letters) for girls and boys, with their meaning in English, their origin and their births in France.',
    h1: 'Short French names', sous: `${xs.length} names of 4 letters or fewer, from the most given to the rarest.`,
    note: `Births from ${AN1 - 2} to ${AN1} (INSEE). Only names whose origin or meaning is known.`
  })
}
const ORIGINES = [...new Set(tetes.filter(x => !x.hf).flatMap(x => x.g))]
  .map(o => ({ o, total: tetes.filter(x => !x.hf && x.g.includes(o)).length }))
  .sort((a, b) => b.total - a.total).slice(0, 8)
for (const { o, total } of ORIGINES) {
  const lib = origineEn(o)
  const xs = tetes.filter(x => !x.hf && x.g.includes(o)).sort((a, b) => b.n - a.n).slice(0, 150)
  listesEn.push({
    type: 'origin', origine: o, total, chemin: `${EN_NOMS}origin/${slugOrigineEn(o)}/`, champ: champOrigine(o), xs, genre: true,
    titre: `French names of ${lib} origin: meaning and popularity`,
    description: `First names of ${lib} origin given in France, girls and boys, with their meaning in English and their number of births (INSEE).`,
    h1: `French names of ${lib} origin`, sous: `The ${xs.length} most given names of ${lib} origin in France, girls and boys.`,
    note: `Ranked by births from ${AN1 - 2} to ${AN1}. The origin is the oldest known root, not the language the name came to France through.`
  })
}
// Les A-Z : seulement des fiches anglaises (sans elles, la page lierait 7 000 fiches françaises).
for (const [type, filtre, t, champ] of [
  ['girls', x => sexeOk(x, 'f'), 'girl', 'peche'], ['boys', x => sexeOk(x, 'm'), 'boy', 'menthe'], ['unisex', x => x.sexe === 'fm', 'unisex', 'brume']]) {
  const xs = EN.filter(filtre).sort((a, b) => a.l.localeCompare(b.l, 'fr'))
  if (!xs.length) continue
  listesEn.push({
    type, az: true, chemin: `${EN_NOMS}${type}/`, champ, xs,
    titre: `French ${t} names A–Z: ${xs.length} names with their meaning`,
    description: `${xs.length} French ${t} names with their meaning in English, their origin and their popularity in France, from A to Z.`,
    h1: `French ${t} names A–Z`,
    sous: `${xs.length} ${t} names given in France, with their meaning in English. In bold, the most common: over 500 births from ${AN1 - 2} to ${AN1}.`
  })
}
const listeDe = (type, s) => listesEn.find(L => L.type === type && (!s || L.sexe === s))

/** Le classement : le tableau des listes françaises, en anglais. */
function tableau(xs, genre) {
  return `<div class="tableau r"><table><caption>Births in France from ${AN1 - 2} to ${AN1} (INSEE); trend: average change per year over recent years (“–” under ${SEUIL_TENDANCE} births: INSEE rounding makes it meaningless).</caption>
<thead><tr><th scope="col" class="rg">#</th><th scope="col">Name</th><th scope="col" class="o">Origin</th><th scope="col" class="n">Births</th><th scope="col" class="n">Trend</th></tr></thead><tbody>
${xs.map((x, i) => {
  const lien = enAnglais(x) ? `<a href="${cheminFicheEn(x.slug)}"><b>${esc(x.l)}</b></a>` : `<a href="/prenom/${x.slug}/" hreflang="fr"><b>${esc(x.l)}</b></a>`
  const sous = [genre ? GENRE_EN[x.sexe] : '', enAnglais(x) ? '' : '(in French)'].filter(Boolean).join(' · ')
  return `<tr><td class="rg">${i + 1}</td><td>${lien}${sous ? `<small>${sous}</small>` : ''}</td><td class="o">${esc(liste(x.g.map(origineEn)))}</td><td class="n">${nf(x.n)}</td><td class="n">${x.n >= SEUIL_TENDANCE ? tendanceHtml(x.t) : '–'}</td></tr>`
}).join('')}
</tbody></table></div>`
}

const PLAN_EN = `<nav class="plan" aria-label="Site map">
${[['f', 'Girls'], ['m', 'Boys']].map(([s, t]) => `<div><p class="t">${t}</p><ul>
<li><a href="${listeDe('trending', s).chemin}">Trending</a></li><li><a href="${listeDe('popular', s).chemin}">Most popular</a></li>${listeDe(motSexe[s]) ? `<li><a href="${listeDe(motSexe[s]).chemin}">A–Z</a></li>` : ''}</ul></div>`).join('\n')}
<div><p class="t">Explore</p><ul><li><a href="${EN_NOMS}">French names</a></li><li><a href="${EN_NOMS}classic/">Classic</a></li><li><a href="${EN_NOMS}short/">Short</a></li>${listeDe('unisex') ? `<li><a href="${EN_NOMS}unisex/">Unisex</a></li>` : ''}<li><a href="${EN_NOMS}#origins">By origin</a></li></ul></div>
<div><p class="t">${MARQUE}</p><ul><li><a href="/en/">The app</a></li><li><a href="/prenoms/" hreflang="fr">Names, in French</a></li></ul></div>
</nav>`
const PIED_EN = `${PLAN_EN}
<p>Figures: INSEE, the French national file of first names (births in France from ${AN0} to ${AN1}). Origins and meanings: French sources (Wiktionnaire), reviewed and translated; when a meaning is uncertain, the page says so.</p>
${legal('en')}
${languesPied('en')}`

/** L'appel vers l'app, en anglais : la carte du prénom, comme en français. */
const ctaEn = (p, ref) => `<section class="cta r">
${p ? `<div class="pile" aria-hidden="true"><div><b style="--t2:${Math.min(44, 190 / (Math.max(p.l.length, 3) * 0.58)).toFixed(0)}px">${esc(p.l)}</b>${SENS_EN[p.slug] ? `<span>${esc(SENS_EN[p.slug].length > 40 ? SENS_EN[p.slug].slice(0, 38).replace(/\s+\S*$/, '') + '…' : SENS_EN[p.slug])}</span>` : ''}</div></div>` : ''}
<h2>${p ? `Like ${esc(p.l)}?` : 'Choose the name together'}</h2>
<p>Each of you swipes on your own, without swaying the other. You only see the names you both like.</p>
<a class="b" rel="nofollow" href="/?ref=${ref}${p ? `&amp;prenom=${encodeURIComponent(p.slug)}` : ''}">Start for free</a>
${magasins('en')}
<p class="doute">No ads. Your partner joins with a simple link, nothing to install. <a href="/en/">How ${MARQUE} works</a>.</p>
</section>`

const pageEn = ({ rubrique = null, genre = 'girls', ...o }) => page({
  code: 'en', logo: EN_NOMS, bouton: { texte: 'Pick together', href: '/en/' },
  rangee: rangeeEn(rubrique, genre), pied: PIED_EN, ...o
})

// ---------------------------------------------------------------- anglais : fiche
// Le script du sommaire collant : celui des fiches françaises, repris tel quel.
const SOMMAIRE_JS = (() => {
  const t = tetes.find(x => existsSync(resolve(SORTIE, 'prenom', x.slug, 'index.html')))
  return t ? readFileSync(resolve(SORTIE, 'prenom', t.slug, 'index.html'), 'utf8').match(/<script src="(\/statique\/sommaire\.[^"]+)"/)?.[1] ?? null : null
})()

const parSexe = { f: [], m: [], fm: [] }
for (const x of EN) parSexe[x.sexe].push(x)
/** Prénoms proches : la règle de seo.mjs, parmi les fiches anglaises. */
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

function ficheEn(p) {
  const entrees = pages.get(p.slug)
  const sens = SENS_EN[p.slug]
  const chemin = cheminFicheEn(p.slug)
  const groupe = (groupes.get(p.gp) ?? []).filter(x => x.slug !== p.slug)
  const nTot = entrees.reduce((s, x) => s + x.n, 0)
  const fGroupe = (groupes.get(p.gp) ?? [p]).reduce((s, x) => s + x.f, 0)
  const rang = p.sexe === 'fm' ? p.rang.fm : p.rang[p.sexe]
  const origines = p.g.map(origineEn)
  const fiable = p.n >= SEUIL_TENDANCE
  const parAn = Math.max(1, Math.round(p.n / 3))
  const incertain = p.cf === 0 || p.cf === 1
  const L = o => listesEn.find(x => x.origine === o)
  const lienOrigine = o => L(o) ? `<a href="${L(o).chemin}">${esc(origineEn(o))}</a>` : esc(origineEn(o))

  const titre = `${p.l}: meaning, origin and popularity of the French name`
  const essais = [
    `${p.l}: ${GENRE_EN[p.sexe]} name${origines.length ? ` of ${liste(origines)} origin` : ''} meaning “${sens}”. ${nf(nTot)} births in France in ${AN1 - 2}–${AN1}${fiable ? `, ${tendanceMot(p.t)}` : ''}.`,
    `${p.l}: ${GENRE_EN[p.sexe]} name${origines.length ? ` of ${origines[0]} origin` : ''} meaning “${sens}”. ${nf(nTot)} births in France in ${AN1 - 2}–${AN1}.`,
    `${p.l}: ${GENRE_EN[p.sexe]} name meaning “${sens}”. ${nf(nTot)} births in France in ${AN1 - 2}–${AN1}.`
  ]
  const description = essais.find(t => t.length <= DESCRIPTION_MAX) ?? couper(essais.at(-1))

  const sensTete = `<p class="sens">“${esc(sens)}”${incertain ? `<small>${p.cf === 1 ? 'probable meaning' : 'uncertain meaning'}</small>` : ''}</p>`
  const qui = `${QUI_EN[p.sexe]}${p.g.length ? `, of ${liste(p.g.map(lienOrigine))} origin` : ''}.${p.rv ? ' A retro name making a comeback.' : ''}`
  const graphe = p.sr ? `<figure class="graphe">${dessinerCourbe(p.sr, {
    an0: AN0, an1: AN1, aria: `Births of ${esc(p.l)} per 10,000 babies, from ${AN0} to ${AN1}`,
    pic: (max, annee) => `${dec(max)} per 10,000 in ${annee}`
  })}<figcaption>Births per 10,000 babies born in France, from ${AN0} to ${AN1} (INSEE).</figcaption></figure>` : ''

  const phraseSens = `${esc(p.l)} ${incertain ? 'is thought to mean' : 'means'} “${esc(sens)}”${origines.length ? ` and is of ${esc(liste(origines))} origin` : ''}.`
  const doute = incertain ? `<p class="doute">${p.cf === 1 ? 'Probable meaning: the sources partly agree.' : 'Uncertain meaning: the sources disagree or are scarce.'}</p>` : ''
  const ecole = fGroupe / 10000 * 200
  const faits = [
    p.p && p.p < AN0 ? `Its record year, in INSEE figures going back to 1900, was ${p.p}.` : p.p ? `It peaked in ${p.p}.` : '',
    fiable
      ? `Over recent years, ${esc(p.l)} has been ${tendanceMot(p.t)} (${pctTendance(p.t)}% a year).`
      : `With about ${nf(parAn)} ${parAn > 1 ? 'babies' : 'baby'} a year, ${esc(p.l)} is too rare for a reliable trend: INSEE rounds each year to 5.`,
    ecole >= 1
      ? `In a school of 200 children born in those years, there would be <b>${dec(ecole)}</b> ${esc(p.l)} on average${groupe.length ? ', counting the spellings that sound the same' : ''}.`
      : `In schools of 200 children born in those years, you would find one ${esc(p.l)} every <b>${1 / ecole < 10 ? dec(1 / ecole) : nf(1 / ecole)}</b> schools${groupe.length ? ', all spellings combined' : ''}.`
  ].filter(Boolean)

  const autres = entrees.slice(1)
  const graphies = [...autres, ...groupe.filter(x => !autres.includes(x))].slice(0, 20)
  const blocGraphies = graphies.length ? `<section class="bloc" id="spellings"><h2>Same sound, other spellings</h2>
<ul class="graphies">${(() => { const max = Math.max(1, ...graphies.map(x => x.n)); return graphies.map(x => {
  const t = tete(x.slug)
  const nom = x.slug === p.slug || !t ? `<span class="g">${esc(x.l)}</span>`
    : aFicheEn(t, SENS_EN) ? `<a class="g" href="${cheminFicheEn(x.slug)}">${esc(x.l)}</a>`
    : `<span><a class="g" href="/prenom/${x.slug}/" hreflang="fr">${esc(x.l)}</a> <small>(in French)</small></span>`
  return `<li>${nom}<i style="--w:${x.hf ? 0 : Math.round(100 * x.n / max)}%"></i>${x.hf ? '<small>abroad</small>' : `<b>${nf(x.n)}</b>`}</li>` }).join('') })()}</ul>
<p class="doute">Births ${AN1 - 2}–${AN1}. At school they sound the same: this total tells you whether your child is likely to share the name.</p></section>` : ''

  const monde = anglophones(p, rang)
  const voisins = proches(p)
  const voir = [
    ...p.g.map(L).filter(Boolean).map(x => `<li><a href="${x.chemin}"><b aria-hidden="true">→</b><span>French names of ${esc(origineEn(x.origine))} origin</span></a></li>`),
    ...['f', 'm'].filter(s => sexeOk(p, s)).flatMap(s => {
      const pop = listeDe('popular', s), i = pop.xs.indexOf(p)
      return i >= 0 ? [`<li><a href="${pop.chemin}"><b>${ord(i + 1)}</b><span>Top 100 French ${s === 'f' ? 'girl' : 'boy'} names</span></a></li>`] : []
    }),
    ...(p.rv ? [`<li><a href="${EN_NOMS}classic/"><b aria-hidden="true">→</b><span>Classic French names coming back</span></a></li>`] : [])
  ]
  const sommaire = [['meaning', 'Meaning'], ['popularity', 'Popularity'], ...(monde ? [['english-speaking', 'Abroad']] : []),
    ...(graphies.length ? [['spellings', 'Spellings']] : []), ...(voisins.length ? [['similar', 'Similar names']] : [])]
  const liensSommaire = sommaire.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')
  const chiffre = (b, t) => `<div><dt>${t}</dt><dd>${b}</dd></div>`

  const corps = `
<section class="hero fiche">${h1Nom(p.l)}${sensTete}
<p class="qui">${qui} <a href="/prenom/${p.slug}/" lang="fr" hreflang="fr">Lire en français</a></p>
${graphe}</section>

<dl class="chiffres">
${rang <= 2000 ? chiffre(ord(rang), `most given ${p.sexe === 'fm' ? 'unisex name' : p.sexe === 'f' ? 'girl’s name' : 'boy’s name'} in France`) : ''}
${chiffre(nf(nTot), `births in <span class="nw">${AN1 - 2}–${AN1}</span>`)}
${chiffre(p.f > 0 ? `1 in ${nf(10000 / p.f)}` : 'almost never', 'babies born in France')}
${fiable ? chiffre(majuscule(tendanceMot(p.t)), `${pctTendance(p.t)}% a year recently`) : chiffre(`≈ ${nf(parAn)}`, `${parAn > 1 ? 'babies' : 'baby'} a year`)}
${p.p ? chiffre(String(p.p), p.p < AN0 ? 'record year (since 1900)' : 'peak year') : ''}
</dl>

<nav class="sommaire" aria-label="On this page"><ul>${liensSommaire}</ul></nav>

<section class="bloc" id="meaning"><h2>Meaning and origin of ${esc(p.l)}</h2>
<div class="carte"><p>${phraseSens}</p>${doute}</div></section>

<section class="bloc" id="popularity"><h2>Popularity of ${esc(p.l)} in France since ${AN0}</h2>
<ul class="faits">${faits.map(f => `<li>${f}</li>`).join('')}</ul></section>

${monde}

${blocGraphies}

${ctaEn(p, 'en-names')}

${voisins.length ? `<section class="bloc" id="similar"><h2>Names similar to ${esc(p.l)}</h2>
<ul class="noms-grands">${voisins.map(x => `<li><a href="${cheminFicheEn(x.slug)}">${esc(x.l)}</a></li>`).join('')}</ul></section>` : ''}

${voir.length ? `<section class="bloc"><h2>See also</h2><ul class="rangs">${voir.join('')}</ul></section>` : ''}
`
  return pageEn({
    chemin, titre, description, corps, champ: champOrigine(p.g[0]), classe: 'fiche', sommaire: liensSommaire,
    genre: p.sexe === 'm' ? 'boys' : 'girls',
    alternates: [{ hreflang: 'en', chemin }, { hreflang: 'fr', chemin: `/prenom/${p.slug}/` }, { hreflang: 'x-default', chemin: `/prenom/${p.slug}/` }],
    ariane: [{ n: 'French names', u: EN_NOMS }, { n: p.l, u: chemin }]
  })
}

// ---------------------------------------------------------------- écriture
const ecrites = new Map()                       // chemin -> html (sitemap, IndexNow, vérification)
function ecrire(chemin, html) {
  const f = resolve(SORTIE, '.' + chemin, 'index.html')
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, html)
  ecrites.set(chemin, html)
}
for (const a of ACCUEILS) if (a.code !== 'fr') rmSync(resolve(SORTIE, '.' + a.chemin), { recursive: true, force: true })

for (const p of EN) ecrire(cheminFicheEn(p.slug), ficheEn(p))

for (const L of listesEn) {
  const bascule = L.sexe ? `<nav class="bascule" aria-label="Girls or boys">${[['f', 'Girls'], ['m', 'Boys']].map(([s, t]) =>
    `<a href="${listeDe(L.type, s).chemin}"${actuel(s === L.sexe)}>${t}</a>`).join('')}</nav>` : ''
  const autresOrigines = L.origine ? `<section class="bloc r"><h2>Other origins</h2><ul class="puces">${listesEn.filter(x => x.origine && x !== L)
    .map(x => `<li><a href="${x.chemin}">${esc(origineEn(x.origine))} <small>${nf(x.total)}</small></a></li>`).join('')}</ul></section>` : ''
  const contenu = L.az
    ? `<section class="bloc r"><ul class="noms">${L.xs.map(x => `<li><a href="${cheminFicheEn(x.slug)}"${x.n >= 500 ? ' class="courant"' : ''}>${esc(x.l)}</a></li>`).join('')}</ul></section>`
    : `${bascule}${tableau(L.xs, L.genre)}\n<p class="doute">${esc(L.note)} Names without an English page link to their French page.</p>`
  ecrire(L.chemin, pageEn({
    chemin: L.chemin, titre: L.titre, description: couper(L.description), champ: L.champ,
    rubrique: L.origine ? 'origins' : L.type, genre: L.sexe === 'm' ? 'boys' : 'girls',
    ariane: [{ n: 'French names', u: EN_NOMS }, ...(L.origine ? [{ n: 'Origins', u: `${EN_NOMS}#origins` }] : []), { n: L.h1, u: L.chemin }],
    corps: `<section class="hero court">${h1(L.h1)}<p class="sous">${esc(L.sous)}</p></section>
${contenu}
${autresOrigines}
${ctaEn(null, 'en-names')}`
  }))
}

// Le portail de la section anglaise.
{
  // Dans l'aperçu, pas de « (in French) » : la ligne est trop étroite ; le lien porte hreflang.
  const lienNomCourt = x => enAnglais(x) ? `<a href="${cheminFicheEn(x.slug)}">${esc(x.l)}</a>` : `<a href="/prenom/${x.slug}/" hreflang="fr" title="In French">${esc(x.l)}</a>`
  const carte = (type, titre, desc, stat) => {
    const col = (s, t) => {
      const L = listeDe(type, s)
      return `<div><p class="genre">${t}</p><ol class="apercu">${L.xs.slice(0, 3).map(x =>
        `<li>${lienNomCourt(x)}${stat(x) ? `<small>${stat(x)}</small>` : ''}</li>`).join('')}</ol>
<a class="suite" href="${L.chemin}">All ${L.xs.length}<span class="vh"> ${titre.toLowerCase()} (${t.toLowerCase()})</span></a></div>`
    }
    return `<article class="carte classement r"><h3>${titre}</h3><p>${desc}</p><div class="duo">${col('f', 'Girls')}${col('m', 'Boys')}</div></article>`
  }
  const origines = listesEn.filter(L => L.origine)
  const az = ['girls', 'boys', 'unisex'].map(t => listeDe(t)).filter(Boolean)
  const exemples = [...EN].sort((a, b) => b.n - a.n).slice(0, 24)
  ecrire(EN_NOMS, pageEn({
    chemin: EN_NOMS, champ: 'fond', ariane: [{ n: 'French names', u: EN_NOMS }],
    titre: `French baby names: meaning, origin and popularity in France`,
    description: couper(`French first names with their meaning in English, origin and real birth figures in France (INSEE, ${AN0}–${AN1}): trending, top 100, classic, short.`),
    corps: `<section class="hero">${h1('French baby names')}<p class="sous">Names given to babies in France, with their meaning in English and real birth figures: INSEE data, ${AN0}–${AN1}.</p></section>
<section class="bloc r"><h2>What you will find here</h2>
<p>These are the first names given to babies born in France, as counted by INSEE, the French national statistics office, from ${AN0} to ${AN1}. They are not English names: some are shared with English-speaking countries, many are not, and each page shows how common the name is there when official figures exist.</p>
<p>Meanings come from French sources, reviewed and translated into English. When a meaning is uncertain, the page says so rather than making one up. ${nf(EN.length)} names have an English page so far; the others link to their page in French.</p></section>
<section class="bloc"><h2>The rankings</h2><div class="classements">
${carte('trending', 'On the rise', `The fastest yearly growth, among names given at least 150 times from ${AN1 - 2} to ${AN1}.`, x => `${pctTendance(x.t, 0)}%`)}
${carte('popular', 'Most popular', `The top 100 births in France, ${AN1 - 2}–${AN1}.`, x => nf(x.n))}
</div>
<ul class="puces suite-bloc"><li><a href="${EN_NOMS}classic/">Classic names coming back</a></li><li><a href="${EN_NOMS}short/">Short names</a></li>${az.map(L => `<li><a href="${L.chemin}">${esc(L.h1.replace('French ', '').replace(/^./, ch => ch.toUpperCase()))} <small>${L.xs.length}</small></a></li>`).join('')}</ul></section>
<section class="bloc r" id="origins"><h2>By origin</h2><ul class="origines">${origines.map(L => `<li><a href="${L.chemin}" style="--champ:var(--${champOrigine(L.origine)})"><b>${esc(majuscule(origineEn(L.origine)))}</b><span>${nf(L.total)} names</span><small>${L.xs.slice(0, 3).map(x => esc(x.l)).join(', ')}</small></a></li>`).join('')}</ul></section>
${exemples.length ? `<section class="bloc r"><h2>Popular names with an English page</h2><ul class="noms-grands">${exemples.map(x => `<li><a href="${cheminFicheEn(x.slug)}">${esc(x.l)}</a></li>`).join('')}</ul></section>` : ''}
${ctaEn(null, 'en-names')}`
  }))
}

// ---------------------------------------------------------------- accueils de l'app
/** Une puce de « comment ça marche » : en gras jusqu'aux deux-points, ou la première phrase. */
const etape = l => {
  const t = l.replace(/^•\s*/, '')
  const deuxPoints = t.match(/^([^:]{4,70}):\s+([\s\S]+)$/)
  if (deuxPoints) return `<b>${esc(deuxPoints[1])}</b>: ${esc(deuxPoints[2])}`
  const phrase = t.match(/^(.{4,120}?[.?!])\s+([\s\S]+)$/)
  return phrase ? `<b>${esc(phrase[1])}</b> ${esc(phrase[2])}` : esc(t)
}
const paras = ps => ps.map(p => p.map(l => `<p>${esc(l.replace(/^•\s*/, ''))}</p>`).join('')).join('')
const texteDe = ps => ps.map(p => p.map(l => l.replace(/^•\s*/, '')).join(' ')).join(' ')

for (const a of ACCUEILS.filter(x => x.code !== 'fr')) {
  const code = a.code
  const ui = UI[code]
  const f = ficheStore(code)
  const [ou, comment, aveugle, chiffres, pris, gratuit, donnees] = f.sections
  const titres = ui.titres ?? f.sections.map(s => majuscule(s.titre.toLocaleLowerCase(a.intl)))
  const [donneesTexte, ...fin] = donnees.paras
  const puces = comment.paras[0]
  const faq = [
    [ui.q[0], puces[2].replace(/^•\s*/, '')],
    [ui.q[1], ou.paras[0][0]],
    [ui.q[2], texteDe(gratuit.paras)],
    [ui.q[3], puces[4].replace(/^•\s*/, '')],
    [ui.q[4], texteDe([donneesTexte])]
  ]
  const ouvrir = `/?ref=${code}`
  const titre = texteApp(code, 'PageConnexion.titrePage')
  const accroche = texteApp(code, 'PageConnexion.accroche')
  const description = couper(f.promo)
  const section = (i, contenu, id = '') => `<section class="bloc r"${id ? ` id="${id}"` : ''}><h2>${esc(titres[i])}</h2>${contenu}</section>`
  const corps = `<section class="hero">${h1(accroche)}
<p class="sous">${esc(f.promo)}</p>
<a class="b" rel="nofollow" href="${ouvrir}">${esc(ui.commencer)}</a>
${magasins(code)}</section>

<p class="chapo">${esc(texteDe(f.intro))}</p>

${section(1, `<ol class="etapes">${puces.map(l => `<li>${etape(l)}</li>`).join('')}</ol>${comment.paras.length > 1 ? paras(comment.paras.slice(1)) : ''}`)}

${section(2, paras(aveugle.paras))}

${section(0, `<div class="carte offre">${paras(ou.paras)}</div>`)}

${section(3, paras(chiffres.paras) + (code === 'en' ? `<p><a class="suite" href="${EN_NOMS}">Browse French names in English</a></p>` : ''))}

${section(4, paras(pris.paras))}

${section(5, `<div class="carte offre">${paras(gratuit.paras)}</div>`)}

${section(6, paras([donneesTexte]) + paras(fin))}

<section class="bloc r"><h2>${esc(ui.faq)}</h2>
<div class="faq">
${faq.map(([q, r], i) => `<details${i === 0 ? ' open' : ''}><summary><h3>${esc(q)}</h3></summary><p>${esc(r)}</p></details>`).join('\n')}
</div></section>

${code === 'en' ? `<section class="bloc r"><h2>${esc(ui.noms)}</h2><p>${esc(ui.nomsTexte)}</p><p><a class="suite" href="${EN_NOMS}">French baby names</a></p></section>` : ''}

<section class="cta r">
<h2>${esc(ui.ctaTitre)}</h2>
<p>${esc(ui.ctaTexte)}</p>
<a class="b" rel="nofollow" href="${ouvrir}">${esc(ui.commencer)}</a>
${magasins(code)}
</section>`
  const pied = `${code === 'en' ? PLAN_EN : ''}
<p>${esc(ui.source(AN0, AN1))}</p>
${legal(code)}
${languesPied(code)}`
  ecrire(a.chemin, page({
    code, chemin: a.chemin, titre, description, corps, champ: 'peche', alternates: alternatesAccueil(),
    logo: a.chemin, bouton: { texte: ui.ouvrir, href: ouvrir, nofollow: true },
    rangee: rangeeLangues(code, ui.langues), pied,
    ariane: [{ n: MARQUE, u: '/' }, { n: f.sousTitre, u: a.chemin }],
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: MARQUE, url: `${SITE}/`, inLanguage: a.intl, applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web', description: texteDe(f.intro), isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
    }, {
      '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: a.intl,
      mainEntity: faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } }))
    }]
  }))
}

// ---------------------------------------------------------------- vérification des liens
/**
 * Chaque lien interne des pages écrites ici doit mener quelque part : un
 * fichier de public/ (dossier avec index.html), ou une page de l'app
 * (app/pages/<nom>.vue, servie par Nuxt). Les ancres (#…) doivent exister
 * dans la page visée. Un lien mort casse le build.
 */
{
  const PAGES_APP = resolve(RACINE, 'app/pages')
  const morts = []
  const ids = new Map()
  const idsDe = (chemin, html) => ids.get(chemin) ?? ids.set(chemin, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))).get(chemin)
  for (const [chemin, html] of ecrites) {
    for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
      if (!href.startsWith('/') && !href.startsWith('#')) continue
      const [cheminCible, ancre] = href.replace(/&amp;/g, '&').split('#')
      const sans = (cheminCible || chemin).split('?')[0]
      let ok
      if (sans === '/') ok = true
      else if (sans.endsWith('/')) ok = existsSync(resolve(SORTIE, '.' + sans, 'index.html'))
      else ok = existsSync(resolve(SORTIE, '.' + sans)) || existsSync(resolve(PAGES_APP, sans.slice(1) + '.vue'))
        || existsSync(resolve(PAGES_APP, sans.slice(1), 'index.vue'))
      if (ok && ancre && sans.endsWith('/')) {
        const cible = ecrites.get(sans) ?? (existsSync(resolve(SORTIE, '.' + sans, 'index.html')) ? readFileSync(resolve(SORTIE, '.' + sans, 'index.html'), 'utf8') : '')
        ok = idsDe(sans, cible).has(ancre)
      }
      if (!ok) morts.push(`${chemin} -> ${href}`)
    }
  }
  if (morts.length) throw new Error(`[seo-langues] ${morts.length} liens internes morts :\n  ${[...new Set(morts)].slice(0, 20).join('\n  ')}`)
}

// ---------------------------------------------------------------- sitemap, llms.txt, IndexNow
{
  const sm = resolve(SORTIE, 'sitemap.xml')
  let x = readFileSync(sm, 'utf8')
  const nouvelles = [...ecrites.keys()].filter(u => !x.includes(`<loc>${SITE}${u}</loc>`))
  x = x.replace('</urlset>', () => nouvelles.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${MAJ}</lastmod></url>`).join('\n') + '\n</urlset>')
  writeFileSync(sm, x)

  const llms = resolve(SORTIE, 'llms.txt')
  if (existsSync(llms)) {
    let t = readFileSync(llms, 'utf8')
    if (!t.includes(EN_NOMS)) {
      const top = [...EN].sort((a, b) => b.n - a.n).slice(0, 3)
      t = t.trimEnd() + `\n\n## In English\n\n- [${MARQUE}, in English](${SITE}/en/): choose your baby’s name together, each partner judging alone; also in ${ACCUEILS.filter(a => !['fr', 'en'].includes(a.code)).map(a => `[${a.nom}](${SITE}${a.chemin})`).join(', ')}. The name catalogue is that of births in France (INSEE, ${AN0}–${AN1}).\n- [French baby names](${SITE}${EN_NOMS}): ${nf(EN.length)} French first names with their meaning in English, origin, births in France and popularity in English-speaking countries; [trending](${SITE}${EN_NOMS}trending/girls/), [top 100](${SITE}${EN_NOMS}popular/girls/), [classic](${SITE}${EN_NOMS}classic/), [short](${SITE}${EN_NOMS}short/)${top.length ? `\n- Examples: ${top.map(p => `[${p.l}](${SITE}${cheminFicheEn(p.slug)})`).join(', ')}` : ''}\n`
      writeFileSync(llms, t)
    }
  }

  // Empreintes pour scripts/indexnow.mjs : il envoie les URL nouvelles ou
  // modifiées, et retire celles qui ont quitté le sitemap.
  const fe = SORTIE === PUBLIC ? resolve(RACINE, '.seo-empreintes.json') : resolve(SORTIE, '.seo-empreintes.json')
  if (existsSync(fe)) {
    const e = JSON.parse(readFileSync(fe, 'utf8'))
    for (const [u, html] of ecrites) e.urls[u] = createHash('sha1').update(html).digest('hex').slice(0, 16)
    writeFileSync(fe, JSON.stringify(e, null, 1))
  }
  console.log(`[seo-langues] ${ACCUEILS.length - 1} accueils (${ACCUEILS.filter(a => a.code !== 'fr').map(a => a.code).join(', ')}), ${EN.length} fiches anglaises, ${listesEn.length + 1} listes anglaises ; sitemap +${nouvelles.length} URL ; liens internes vérifiés`)
}
