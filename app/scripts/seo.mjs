#!/usr/bin/env node
/**
 * Pages SEO : une fiche statique par prénom, des pages de liste, sitemap et
 * robots.txt — générées AVANT `nuxt build` dans public/, donc servies telles
 * quelles par Vercel, sans SSR ni JavaScript.
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
 * Domaine : NUXT_PUBLIC_SITE_URL, sinon le domaine de production que Vercel
 * injecte au build (VERCEL_PROJECT_PRODUCTION_URL).
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(RACINE, 'public')
// Pour relire le rendu sans toucher public/ : SEO_SORTIE=/tmp/seo node scripts/seo.mjs
const SORTIE = process.env.SEO_SORTIE ? resolve(process.env.SEO_SORTIE) : PUBLIC
const SITE = (process.env.NUXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || 'https://babyname-five.vercel.app').replace(/\/$/, '')
const MARQUE = 'babyNames'
/**
 * La date de derniere modification des pages, pour le sitemap. PAS la date du
 * build : a chaque push, 7 500 URL se seraient declarees modifiees, et Google
 * apprend vite a ignorer un lastmod qui ment. A monter quand les donnees ou
 * les gabarits changent vraiment.
 */
const MAJ = '2026-09-25'
/** La page qui presente l'application elle-meme, statique : c'est elle que
 *  lisent les robots et les IA, la racine « / » n'etant qu'une coquille JS. */
const APP = '/choisir-un-prenom-a-deux/'
const PRIX = (process.env.NUXT_PUBLIC_PRIX_LISTE || '6 €').trim()
const PRIX_NOMBRE = Number(PRIX.replace(',', '.').replace(/[^\d.]/g, '')) || 6
// Les limites du gratuit viennent du schema, pas d'une copie : si elles
// changent en base, la page qui les annonce change au build suivant.
const SCHEMA = readFileSync(resolve(RACINE, 'server/assets/schema.sql'), 'utf8')
const defaut = (col, repli) => Number(SCHEMA.match(new RegExp(`${col}\\s+\\w+\\s+not null default (\\d+)`))?.[1] ?? repli)
const QUOTA_DEPART = defaut('quota_depart', 150)
const QUOTA_JOUR = defaut('quota_par_jour', 15)

// ---------------------------------------------------------------- données
const d = JSON.parse(readFileSync(resolve(PUBLIC, 'data/catalogue.json'), 'utf8'))
const c = d.cols
const [AN0, AN1] = d.serie_annees ?? [1986, 2025]
const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const slugDe = s => sansAccent(s).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

const tous = []
for (let k = 0; k < d.n; k++) {
  tous.push({
    k, l: c.l[k], slug: slugDe(c.l[k]), sexe: d.sexe[c.s[k]],
    f: c.f[k], n: c.n[k], t: c.t[k], p: c.p[k], o: c.o[k], q: !!(c.q && c.q[k]),
    y: c.y[k], i: c.i[k], gp: c.gp ? c.gp[k] : k,
    g: c.g[k].map(x => d.origines[x]), m: c.m[k], cf: c.cf ? c.cf[k] ?? null : null,
    dm: c.dm[k] ?? [], sr: c.sr ? c.sr[k] : null, rv: !!c.rv[k]
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
 * Fiche MINCE : ni sens ni origine connus. Il ne reste que des chiffres (857
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

function tendanceMot(t) {
  if (t >= 12) return 'en forte hausse'
  if (t >= 4) return 'en hausse'
  if (t > -4) return 'stable'
  if (t > -12) return 'en baisse'
  return 'en net recul'
}

// ---------------------------------------------------------------- gabarit
const CSS = `
:root{--encre:#1a234e;--menthe:#cae1d9;--peche:#ecbbb6;--sable:#dfd2cc;--fond:#fbfaf9;--carte:#fff;--trait:#ece7e3;--texte:#1a234e;--doux:#767b93;--oui:#2e8b6b;--non:#c4564f;--bouton:#1a234e;--sur-bouton:#fff}
@media (prefers-color-scheme:dark){:root{--fond:#101321;--carte:#191d2e;--trait:#2a2f45;--texte:#eef0f7;--doux:#9298b2;--encre:#eef0f7;--menthe:#2c4a44;--peche:#4d3330;--sable:#33313c;--oui:#4fc095;--non:#e2726b;--bouton:#eef0f7;--sur-bouton:#101321}}
*{box-sizing:border-box}
body{margin:0;font:16px/1.6 ui-rounded,"Nunito",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--texte);background:var(--fond)}
a{color:inherit}
.l{max-width:760px;margin:0 auto;padding:0 16px}
header.h{display:flex;align-items:center;justify-content:space-between;padding:14px 0}
header.h a.m{display:flex;gap:8px;align-items:center;font-weight:800;text-decoration:none}
header.h img{width:28px;height:28px;border-radius:8px}
.b{display:inline-block;background:var(--bouton);color:var(--sur-bouton);text-decoration:none;font-weight:800;padding:11px 20px;border-radius:999px}
.b.p{padding:8px 14px;font-size:14px}
nav.fil{font-size:13px;color:var(--doux)}nav.fil a{color:var(--doux)}
.hero{background:linear-gradient(135deg,var(--menthe),var(--sable) 52%,var(--peche));border-radius:22px;padding:28px 22px;margin:10px 0 18px}
h1{font-size:clamp(34px,8vw,52px);line-height:1.05;margin:0 0 6px;letter-spacing:-.02em}
.sous{margin:0;font-weight:600}
h2{font-size:21px;margin:30px 0 10px}
.chiffres{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.chiffres div{background:var(--carte);border:1px solid var(--trait);border-radius:15px;padding:12px 14px}
.chiffres b{display:block;font-size:22px}.chiffres span{font-size:13px;color:var(--doux)}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:22px;padding:18px}
.doute{font-size:14px;color:var(--doux);margin:.4em 0 0}
svg.courbe{width:100%;height:auto;display:block}
.puces{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none;margin:0}
.puces a,.puces span{display:inline-block;padding:6px 12px;border-radius:999px;background:var(--carte);border:1px solid var(--trait);text-decoration:none;font-weight:600;font-size:15px}
.puces small{color:var(--doux);font-weight:500}
.cta{margin:34px 0;text-align:center;background:var(--carte);border:1px solid var(--trait);border-radius:22px;padding:24px 18px}
.cta p{margin:.3em 0 1em}
table{width:100%;border-collapse:collapse;font-size:15px}td,th{padding:8px 6px;border-bottom:1px solid var(--trait);text-align:left}th{font-size:13px;color:var(--doux);font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}@media (max-width:560px){.o{display:none}td,th{padding:8px 4px}}
.lettres{display:flex;flex-wrap:wrap;gap:6px}.lettres a{width:38px;text-align:center;padding:6px 0;border-radius:10px;background:var(--carte);border:1px solid var(--trait);text-decoration:none;font-weight:800}
footer{margin:40px 0 30px;padding-top:16px;border-top:1px solid var(--trait);font-size:13px;color:var(--doux)}
footer a{color:var(--doux)}
`.replace(/\n/g, '')

function page({ chemin, titre, description, fil = [], corps, jsonld = [], ariane = null, indexer = true }) {
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
<meta name="theme-color" content="#1a234e">
<link rel="icon" href="/logo.png" type="image/png">
<style>${CSS}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head><body><div class="l">
<header class="h"><a class="m" href="/prenoms/"><img src="/logo.png" alt="" width="28" height="28">${MARQUE}</a>
<a class="b p" href="${APP}">Choisir à deux</a></header>
<nav class="fil" aria-label="Fil d'Ariane">${bc.map((x, i) => i === bc.length - 1 ? esc(x.n) : `<a href="${x.u}">${esc(x.n)}</a>`).join(' › ')}</nav>
${corps}
<footer>
<p><a href="/prenoms/">Tous les prénoms</a> · <a href="/prenoms/tendance/filles/">Tendances filles</a> · <a href="/prenoms/tendance/garcons/">Tendances garçons</a> · <a href="/prenoms/rares/filles/">Rares filles</a> · <a href="/prenoms/rares/garcons/">Rares garçons</a> · <a href="${APP}">L’application</a></p>
<p>Chiffres : INSEE, fichier des prénoms (naissances en France, ${AN0}–${AN1}). Origines et significations : Wiktionnaire et relecture ; quand le sens est incertain, la fiche le dit.</p>
<p><a href="/mentions-legales">Mentions légales</a> · <a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions</a> · <a href="/accessibilite">Accessibilité</a></p>
</footer></div></body></html>`
}

const cta = (p) => `<section class="cta">
<h2 style="margin-top:0">${p ? `${esc(p.l)} vous plaît ?` : 'Trouver le prénom à deux'}</h2>
<p>Swipez chacun de votre côté, sans vous influencer. Vous ne voyez que les prénoms qui vous plaisent à tous les deux, puis vous les départagez en duels.</p>
<a class="b" rel="nofollow" href="/?ref=seo${p ? `&amp;prenom=${encodeURIComponent(p.slug)}` : ''}">Commencer gratuitement</a>
<p class="doute">Sans publicité. Votre partenaire rejoint par un simple lien, sans rien installer.</p>
</section>`

function courbe(p) {
  if (!p.sr || !p.sr.some(v => v > 0)) return ''
  const W = 640, H = 190, G = 34, B = 24, T = 12
  const max = Math.max(...p.sr)
  const x = i => G + (i / (p.sr.length - 1)) * (W - G - 8)
  const y = v => T + (1 - v / max) * (H - T - B)
  const pts = p.sr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const iMax = p.sr.indexOf(max)
  const graduations = [AN0, 2000, 2010, AN1].filter(a => a >= AN0 && a <= AN1)
  return `<svg class="courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Naissances de ${esc(p.l)} pour 10 000 bébés, de ${AN0} à ${AN1}">
<path d="M${x(0)},${H - B} L${pts.join(' L')} L${x(p.sr.length - 1)},${H - B} Z" fill="var(--menthe)" opacity=".7"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="var(--encre)" stroke-width="2.5" stroke-linejoin="round"/>
<line x1="${G}" x2="${W - 8}" y1="${H - B}" y2="${H - B}" stroke="var(--trait)"/>
${graduations.map((a, i) => `<text x="${x(a - AN0).toFixed(1)}" y="${H - 6}" font-size="12" fill="var(--doux)" text-anchor="${i === 0 ? 'start' : i === graduations.length - 1 ? 'end' : 'middle'}">${a}</text>`).join('')}
<circle cx="${x(iMax).toFixed(1)}" cy="${y(max).toFixed(1)}" r="4" fill="var(--encre)"/>
<text x="${Math.min(Math.max(x(iMax), 60), W - 60).toFixed(1)}" y="${Math.max(y(max) - 8, 11).toFixed(1)}" font-size="12" fill="var(--texte)" text-anchor="middle">${dec(max)} / 10 000 en ${AN0 + iMax}</text>
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
  const description = `${p.l}, prénom ${genre}${origines.length ? ` d’origine ${liste(origines)}` : ''}${p.m ? ` : « ${p.m} »` : ''}. ${nf(nTot)} naissances en France de ${AN1 - 2} à ${AN1}, tendance ${tendanceMot(p.t)}, graphies et prénoms proches.`

  const corps = `
<section class="hero"><h1>${esc(p.l)}</h1>
<p class="sous">Prénom ${genre}${origines.length ? ` · origine ${esc(liste(origines))}` : ''}${p.rv ? ' · prénom rétro qui revient' : ''}</p></section>

<div class="chiffres">
<div><b>${nf(nTot)}</b><span>naissances en ${AN1 - 2}-${AN1}</span></div>
<div><b>${unSur(p.f)}</b><span>en France, filles et garçons</span></div>
${rang <= 2000 ? `<div><b>${rang}<sup>${rang === 1 ? 'er' : 'e'}</sup></b><span>prénom ${p.sexe === 'fm' ? 'le plus donné' : p.sexe === 'f' ? 'féminin' : 'masculin'}</span></div>` : ''}
<div><b>${p.t > 0 ? '+' : p.t < 0 ? '−' : ''}${dec(Math.abs(p.t))} %/an</b><span>tendance récente : ${tendanceMot(p.t)}</span></div>
<div><b>${nf(p.o)}/100</b><span>originalité</span></div>
</div>

<h2>Signification et origine de ${esc(p.l)}</h2>
<div class="carte"><p style="margin:0">${phraseSens}</p>${doute}</div>

<h2>Popularité de ${esc(p.l)} depuis ${AN0}</h2>
${courbe(p)}
<p>${pic} Sur les dernières années, ${esc(p.l)} est ${tendanceMot(p.t)} (${p.t > 0 ? '+' : ''}${dec(p.t)} % par an). ${phraseClasse}</p>

${groupe.length || autresGraphies.length ? `<h2>Même prononciation, autres graphies</h2>
<ul class="puces">${[...autresGraphies, ...groupe.filter(x => !autresGraphies.includes(x))].slice(0, 20).map(x =>
  aPage(x) && x.slug !== p.slug ? `<li><a href="${url(x)}">${esc(x.l)} <small>${nf(x.n)}</small></a></li>` : `<li><span>${esc(x.l)} <small>${nf(x.n)}</small></span></li>`).join('')}</ul>
<p class="doute">Nombre de naissances ${AN1 - 2}-${AN1}. À l’école, on les entend pareil : c’est ce total qui compte pour savoir si l’enfant sera seul à porter son prénom.</p>` : ''}

${p.dm.length ? `<h2>Diminutifs</h2><ul class="puces">${p.dm.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}

${cta(p)}

<h2>Prénoms proches de ${esc(p.l)}</h2>
<ul class="puces">${proches(p).map(x => `<li><a href="${url(x)}">${esc(x.l)}</a></li>`).join('')}</ul>
`
  const lettre = lettreDe(p)
  return page({
    chemin: url(p), titre, description, corps, indexer: !mince(p),
    fil: [{ n: `Lettre ${lettre.toUpperCase()}`, u: `/prenoms/lettre/${lettre}/` }, { n: p.l, u: url(p) }]
  })
}

// ---------------------------------------------------------------- listes
function tableau(xs, colonne = 'tendance') {
  return `<table><thead><tr><th>#</th><th>Prénom</th><th class="o">Origine</th><th class="n">Naissances ${AN1 - 2}-${AN1}</th><th class="n">${colonne === 'tendance' ? 'Tendance/an' : 'Originalité'}</th></tr></thead><tbody>
${xs.map((x, i) => `<tr><td>${i + 1}</td><td><a href="${url(x)}"><b>${esc(x.l)}</b></a>${x.m ? `<br><small style="color:var(--doux)">${esc(x.m)}</small>` : ''}</td><td class="o">${esc(liste(x.g.map(ORIGINE_LIB)))}</td><td class="n">${nf(x.n)}</td><td class="n">${colonne === 'tendance' ? `${x.t > 0 ? '+' : ''}${dec(x.t)} %` : `${nf(x.o)}/100`}</td></tr>`).join('')}
</tbody></table>`
}

const tetes = [...pages.values()].map(e => e[0])
const sexeOk = (x, s) => x.sexe === s || x.sexe === 'fm'
const listes = []

for (const [s, mot] of [['f', 'filles'], ['m', 'garcons']]) {
  const nom = genreNom[s]
  // Tendances : assez de volume pour que la pente veuille dire quelque chose.
  const tend = tetes.filter(x => sexeOk(x, s) && x.n >= 150 && x.t > 0).sort((a, b) => b.t - a.t).slice(0, 60)
  listes.push({
    chemin: `/prenoms/tendance/${mot}/`,
    titre: `Prénoms de ${nom} tendance en ${AN1 + 1} : ceux qui montent vraiment`,
    description: `Les 60 prénoms de ${nom} qui progressent le plus en France, calculés sur les naissances INSEE jusqu’en ${AN1} — pas une sélection au goût du jour.`,
    h1: `Prénoms de ${nom} qui montent`,
    intro: `Classés par progression annuelle sur les dernières années de naissances INSEE, parmi les prénoms donnés au moins 150 fois de ${AN1 - 2} à ${AN1}. Un prénom qui monte vite peut devenir courant d’ici l’entrée à l’école : regardez aussi le nombre de naissances.`,
    xs: tend, col: 'tendance'
  })
  // Rares mais portables : originaux, avec un sens connu, pas des graphies d'un seul foyer.
  const rares = tetes.filter(x => sexeOk(x, s) && !x.q && x.o >= 60 && x.m && x.cf === 2).sort((a, b) => b.n - a.n).slice(0, 80)
  listes.push({
    chemin: `/prenoms/rares/${mot}/`,
    titre: `Prénoms de ${nom} rares (et qui ont du sens) — liste ${AN1 + 1}`,
    description: `80 prénoms de ${nom} rares en France mais portés : originalité mesurée sur les naissances INSEE, signification vérifiée.`,
    h1: `Prénoms de ${nom} rares`,
    intro: `Des prénoms peu donnés en France (originalité ≥ 60/100, mesurée sur les naissances INSEE), dont la signification est établie. Classés du plus porté au plus confidentiel.`,
    xs: rares, col: 'originalite'
  })
  const pop = tetes.filter(x => sexeOk(x, s)).sort((a, b) => b.n - a.n).slice(0, 100)
  listes.push({
    chemin: `/prenoms/populaires/${mot}/`,
    titre: `Les 100 prénoms de ${nom} les plus donnés en France (${AN1 - 2}-${AN1})`,
    description: `Classement des prénoms de ${nom} les plus donnés en France selon l’INSEE, avec origine, signification et tendance.`,
    h1: `Les 100 prénoms de ${nom} les plus donnés`,
    intro: `Naissances cumulées de ${AN1 - 2} à ${AN1}, source INSEE.`,
    xs: pop, col: 'tendance'
  })
}

const origines = [...new Set(tetes.flatMap(x => x.g))].sort((a, b) => a.localeCompare(b, 'fr'))
for (const o of origines) {
  const xs = tetes.filter(x => x.g.includes(o)).sort((a, b) => b.n - a.n).slice(0, 150)
  if (xs.length < 8) continue
  const lib = ORIGINE_F(o)
  listes.push({
    chemin: `/prenoms/origine/${slugOrigine(o)}/`,
    titre: `Prénoms d’origine ${lib} : liste, signification et popularité`,
    description: `Les prénoms d’origine ${lib} donnés en France, filles et garçons, avec leur signification et leur nombre de naissances.`,
    h1: `Prénoms d’origine ${lib}`,
    intro: `Les ${xs.length} prénoms d’origine ${lib} les plus donnés en France de ${AN1 - 2} à ${AN1}. L’origine indiquée est la racine la plus ancienne connue, pas la langue par laquelle le prénom est arrivé en France.`,
    xs, col: 'tendance', origine: o
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

const urls = []
for (const e of pages.values()) {
  ecrire(url(e[0]), fiche(e))
  if (!mince(e[0])) urls.push(url(e[0]))
}

for (const L of listes) {
  ecrire(L.chemin, page({
    chemin: L.chemin, titre: L.titre, description: L.description,
    fil: [{ n: L.h1, u: L.chemin }],
    corps: `<section class="hero"><h1>${esc(L.h1)}</h1></section><p>${esc(L.intro)}</p>${tableau(L.xs, L.col)}${cta(null)}`
  }))
  urls.push(L.chemin)
}

const lettres = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(l => tetes.some(x => lettreDe(x) === l))
const navLettres = `<div class="lettres">${lettres.map(l => `<a href="/prenoms/lettre/${l}/">${l.toUpperCase()}</a>`).join('')}</div>`
for (const l of lettres) {
  const xs = tetes.filter(x => lettreDe(x) === l).sort((a, b) => a.l.localeCompare(b.l, 'fr'))
  const col = s => xs.filter(x => sexeOk(x, s))
  const bloc = (s, t) => `<h2>${t}</h2><ul class="puces">${col(s).map(x => `<li><a href="${url(x)}">${esc(x.l)}</a></li>`).join('')}</ul>`
  const chemin = `/prenoms/lettre/${l}/`
  ecrire(chemin, page({
    chemin, fil: [{ n: `Lettre ${l.toUpperCase()}`, u: chemin }],
    titre: `Prénoms en ${l.toUpperCase()} : ${xs.length} prénoms de fille et de garçon`,
    description: `Tous les prénoms commençant par ${l.toUpperCase()} donnés en France : filles, garçons et mixtes, avec signification, origine et popularité.`,
    corps: `<section class="hero"><h1>Prénoms en ${l.toUpperCase()}</h1><p class="sous">${xs.length} prénoms donnés en France</p></section>${navLettres}${bloc('f', 'Filles')}${bloc('m', 'Garçons')}`
  }))
  urls.push(chemin)
}

// Portail
ecrire('/prenoms/', page({
  chemin: '/prenoms/',
  titre: `Prénoms : ${nf(pages.size)} fiches avec signification, origine et popularité`,
  description: `Signification, origine et courbe de popularité de ${nf(pages.size)} prénoms donnés en France, d’après les naissances INSEE. Tendances, prénoms rares, par origine.`,
  corps: `<section class="hero"><h1>Trouver un prénom</h1><p class="sous">${nf(pages.size)} prénoms donnés en France, avec leurs vrais chiffres.</p></section>
<h2>Par lettre</h2>${navLettres}
<h2>Listes</h2><ul class="puces">
${listes.filter(L => !L.origine).map(L => `<li><a href="${L.chemin}">${esc(L.h1)}</a></li>`).join('')}</ul>
<h2>Par origine</h2><ul class="puces">
${listes.filter(L => L.origine).map(L => `<li><a href="${L.chemin}">${esc(ORIGINE_LIB(L.origine))}</a></li>`).join('')}</ul>
${cta(null)}`
}))
urls.unshift('/prenoms/')

// ---------------------------------------------------------------- l'application
/**
 * La page qui dit ce qu'est babyNames. La racine « / » est l'application :
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
   'Seulement sur les prénoms qu’il ou elle a déjà jugés soi-même. Avant, rien : c’est le vote à l’aveugle. Un « non » n’est jamais annoncé, et personne ne sait qui a bloqué un prénom.'],
  ['Faut-il installer une application ?',
   'Non. babyNames s’ouvre dans le navigateur, sur téléphone comme sur ordinateur, et s’ajoute à l’écran d’accueil si vous le souhaitez. Votre partenaire rejoint votre liste par un simple lien.'],
  ['Est-ce vraiment gratuit ?',
   `Oui : on trie, on trouve ses accords et on choisit sans rien payer — ${QUOTA_DEPART} prénoms pour commencer, puis ${QUOTA_JOUR} par jour, sans jamais être bloqué. L’option à ${PRIX} TTC débloque une liste pour tous ses membres, en une fois : pas d’abonnement.`],
  ['D’où viennent les chiffres ?',
   `Du fichier des prénoms de l’INSEE : les naissances en France de ${AN0} à ${AN1}. Les significations viennent du Wiktionnaire, relues ; quand un sens est incertain, la fiche le dit au lieu de l’inventer.`],
  ['Peut-on être plus de deux ?',
   'Oui. Chacun juge de son côté, et un prénom n’est « en commun » que si tout le monde l’a jugé et que personne n’a dit non. Avec l’option, les grands-parents peuvent observer et donner leur avis sans rien bloquer.']
]

ecrire(APP, page({
  chemin: APP,
  ariane: [{ n: MARQUE, u: '/' }, { n: 'Choisir à deux', u: APP }],
  titre: `Choisir un prénom à deux, sans s’influencer — l’application ${MARQUE}`,
  description: `Chacun trie les prénoms de son côté, sans voir l’avis de l’autre ; ${MARQUE} ne montre que ceux que vous aimez tous les deux. ${nf(d.n)} prénoms, chiffres INSEE. Gratuit, sans mot de passe.`,
  jsonld: [{
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: MARQUE, url: `${SITE}/`, inLanguage: 'fr-FR',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Navigateur web (téléphone et ordinateur)',
    description: `Application pour choisir le prénom d’un bébé à deux : chacun juge les prénoms à l’aveugle, l’application montre les accords. ${nf(d.n)} prénoms, naissances INSEE ${AN0}–${AN1}.`,
    isAccessibleForFree: true,
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'EUR', name: 'Gratuit' },
      { '@type': 'Offer', price: String(PRIX_NOMBRE), priceCurrency: 'EUR',
        name: 'Déblocage d’une liste', description: 'Paiement unique, pour tous les membres de la liste' }
    ]
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, r]) => ({ '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: r } }))
  }],
  corps: `<section class="hero"><h1>Choisir un prénom à deux, sans s’influencer</h1>
<p class="sous">${MARQUE} trouve les prénoms sur lesquels vous êtes d’accord — sans que l’un décide pour l’autre.</p></section>

<p>${MARQUE} est une application web gratuite pour choisir le prénom de votre bébé à deux. Chacun juge les prénoms de son côté, sans voir l’avis de l’autre ; l’application ne vous montre que ceux que vous aimez tous les deux.</p>

<div class="chiffres">
<div><b>${nf(d.n)}</b><span>prénoms, naissances INSEE ${AN0}–${AN1}</span></div>
<div><b>0</b><span>mot de passe : passkey ou lien par e-mail</span></div>
<div><b>Gratuit</b><span>option à ${esc(PRIX)} par liste, une fois</span></div>
</div>

<h2>Comment ça marche</h2>
<ol>
<li><b>Vous créez une liste</b> en quelques questions : fille, garçon ou les deux, répandu ou rare, court ou long, les origines. Tout se change ensuite.</li>
<li><b>Chacun trie de son côté</b> : oui, non ou neutre, d’un geste, un prénom à la fois. Les graphies qui se prononcent pareil (Nélia, Nelya…) tiennent sur une seule carte.</li>
<li><b>Vous ne voyez l’avis de l’autre qu’après avoir donné le vôtre.</b> Un refus n’est jamais annoncé.</li>
<li><b>Vos accords apparaissent</b> : les prénoms que vous aimez tous les deux, à classer, et ceux qui vous divisent, à revoir quand vous voulez.</li>
</ol>

<h2>Pourquoi à l’aveugle</h2>
<p>À deux, le premier qui dit « j’adore » influence l’autre, et un « non » lâché trop vite enterre un prénom que l’autre aimait. En jugeant séparément, chacun dit ce qu’il pense vraiment : l’accord qui en sort est le vôtre, pas celui du plus rapide.</p>

<h2>Des chiffres, pas une liste à la mode</h2>
<p>Chaque prénom a sa <a href="/prenoms/">fiche</a> : naissances depuis ${AN0}, tendance, rang, signification avec son niveau de certitude, graphies qui se prononcent pareil. Un prénom rare qui monte vite finit souvent en double dans la classe : l’application le signale.</p>

<h2>Ce qui est gratuit, ce qui est payant</h2>
<div class="carte"><p style="margin:0 0 .6em"><b>Gratuit</b> : ${QUOTA_DEPART} prénoms pour commencer, puis ${QUOTA_JOUR} par jour, sans jamais être bloqué ; tout le catalogue, la recherche, les fiches, les accords et le classement, le blocage d’un prénom, le deuxième parent.</p>
<p style="margin:0"><b>${esc(PRIX)} TTC, une fois, par liste</b> — pour tous ses membres : le tri sans limite, l’essai avec votre nom de famille, le nombre d’enfants qui porteront le prénom dans une classe, le portrait de vos goûts, l’explication de vos désaccords, et les observateurs (les grands-parents donnent leur avis sans rien bloquer). Pas d’abonnement.</p></div>

<h2>Vos données</h2>
<p>Un prénom ou un pseudo suffit pour commencer, et aucun mot de passe : on revient avec une passkey (Face ID, empreinte) ou un lien reçu par e-mail — l’adresse n’est demandée que si vous choisissez le lien. Aucune publicité, aucune mesure d’audience, aucun cookie tiers. Votre compte s’efface en un geste, et vos données se téléchargent à tout moment. <a href="/confidentialite">Ce qu’on garde et pourquoi</a>.</p>

<h2>Questions fréquentes</h2>
${FAQ.map(([q, r]) => `<h3>${esc(q)}</h3><p>${esc(r)}</p>`).join('\n')}

<section class="cta">
<h2 style="margin-top:0">Commencer maintenant</h2>
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

- Gratuit : ${QUOTA_DEPART} prénoms pour commencer, puis ${QUOTA_JOUR} par jour, sans jamais être bloqué. Option à ${PRIX} TTC par liste, en une fois, pour tous ses membres (tri sans limite, essai avec le nom de famille, projection dans une classe, explication des désaccords, observateurs).
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

console.log(`[seo] ${pages.size} fiches, ${listes.length + lettres.length + 1} listes, page de l’app, llms.txt, sitemap ${urls.length + 1} URL — domaine ${SITE}`)
