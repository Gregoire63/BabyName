/**
 * Les fiches des prénoms sans page statique, rendues à la demande.
 *
 * Voir scripts/fiches-insee.mjs pour le pourquoi et le format. Le modèle et
 * le sommaire sont dans server/assets/fiches (écrits par scripts/seo.mjs) ;
 * les tranches de données sont des fichiers statiques, lus une fois par
 * tranche et gardés en mémoire tant que le Worker vit.
 */
import type { H3Event } from 'h3'

interface Sommaire {
  an1: number
  lettres: string[]
  chercher: string
  tranches: Record<string, string>
}
export interface FicheInsee {
  slug: string
  l: string
  sexe: 'f' | 'm' | 'fm'
  debut: number
  /** Naissances par an (déjà multipliées par 5), de `debut` à la dernière publiée. */
  serie: number[]
  proches: { slug: string; l: string }[]
}

let sommaire: Promise<Sommaire | null> | null = null
let modele: Promise<string | null> | null = null
const tranches = new Map<string, Promise<Map<string, string> | null>>()

const stockage = () => useStorage('assets:server')
function lireSommaire() {
  return (sommaire ??= stockage().getItem<Sommaire>('fiches/sommaire.json').then(x => x ?? null))
}
function lireModele() {
  return (modele ??= stockage().getItemRaw('fiches/modele.html')
    .then(x => x == null ? null : typeof x === 'string' ? x : new TextDecoder().decode(x as any)))
}

/** Un fichier statique : par la liaison ASSETS sur Cloudflare, par HTTP en dev. */
async function statique(e: H3Event, chemin: string): Promise<string | null> {
  const env = (e.context as any).cloudflare?.env
  const url = new URL(chemin, getRequestURL(e).origin)
  const r = env?.ASSETS ? await env.ASSETS.fetch(new Request(url)) : await fetch(url)
  return r.ok ? r.text() : null
}

export async function lireFiche(e: H3Event, slug: string): Promise<FicheInsee | null> {
  const s = await lireSommaire()
  const cle = slug.slice(0, 2)
  const chemin = s?.tranches[cle]
  if (!chemin) return null
  let t = tranches.get(cle)
  if (!t) {
    t = statique(e, chemin).then((txt) => {
      if (txt == null) { tranches.delete(cle); return null }
      return new Map(txt.split('\n').map(l => [l.slice(0, l.indexOf('\t')), l] as [string, string]))
    })
    tranches.set(cle, t)
  }
  const ligne = (await t)?.get(slug)
  if (!ligne) return null
  const [, l, sexe, debut, vals, proches] = ligne.split('\t')
  return {
    slug, l: l!, sexe: sexe as FicheInsee['sexe'], debut: Number(debut),
    serie: vals!.split(',').map(x => Number(x) * 5),
    proches: (proches || '').split(';').filter(Boolean).map((x) => {
      const i = x.indexOf(':'); return { slug: x.slice(0, i), l: x.slice(i + 1) }
    })
  }
}

// ------------------------------------------------------------------ rendu
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
const nf = (x: number) => Math.round(x).toLocaleString('fr-FR')
const GENRE = { f: 'féminin', m: 'masculin', fm: 'mixte' } as const
const lettreDe = (slug: string) => slug[0] ?? 'a'

function graphe(f: FicheInsee, an1: number) {
  const serie = [...f.serie]
  while (f.debut + serie.length - 1 < an1) serie.push(0)
  const W = 400, B = 26
  if (serie.length <= 30) {
    const H = 180, G = 4, D = 4, T = 22
    const max = Math.max(...serie, 1)
    const pas = (W - G - D) / serie.length
    const y = (v: number) => T + (1 - v / max) * (H - T - B)
    const cx = (i: number) => (G + i * pas + pas / 2).toFixed(1)
    const a0 = f.debut, a1 = f.debut + serie.length - 1
    const annees = serie.map((_, i) => a0 + i)
      .filter(a => a === a0 || a === a1 || (a % 5 === 0 && a - a0 >= 3 && a1 - a >= 3))
    return `<svg class="courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Naissances de ${esc(f.l)} par an, de ${a0} à ${a1}, arrondies à 5 par l’INSEE">
${serie.map((v, i) => v > 0 ? `<rect class="barre" style="--i:${i};fill:var(--menthe);stroke:var(--encre)" x="${(G + i * pas + pas * 0.16).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(pas * 0.68).toFixed(1)}" height="${(H - B - y(v)).toFixed(1)}" rx="3" stroke-width="1.5"/>${serie.length <= 20 ? `<text class="val" style="--i:${i};fill:var(--texte)" x="${cx(i)}" y="${(y(v) - 5).toFixed(1)}" font-size="12" font-weight="800" text-anchor="middle">${v}</text>` : ''}` : '').join('')}
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--trait)" stroke-width="1.5"/>
${annees.map(a => `<text x="${cx(a - a0)}" y="${H - 6}" font-size="13" style="fill:var(--doux)" text-anchor="middle">${a}</text>`).join('')}
</svg>`
  }
  const H = 200, G = 8, D = 8, T = 34
  const max = Math.max(...serie, 1)
  const x = (i: number) => G + (i / (serie.length - 1)) * (W - G - D)
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const pts = serie.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const iMax = serie.indexOf(max)
  const a0 = f.debut, a1 = f.debut + serie.length - 1
  const grad = [a0, ...[1925, 1950, 1975, 2000].filter(a => a - a0 >= 12 && a1 - a >= 12), a1]
  return `<svg class="courbe" viewBox="0 0 ${W} ${H}" role="img" aria-label="Naissances de ${esc(f.l)} par an, de ${a0} à ${a1} (INSEE)">
<defs><linearGradient id="degrade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--menthe)"/><stop offset="1" style="stop-color:var(--menthe);stop-opacity:.2"/></linearGradient></defs>
<path class="aire" d="M${x(0).toFixed(1)},${H - B} L${pts.join(' L')} L${x(serie.length - 1).toFixed(1)},${H - B} Z" style="fill:url(#degrade)"/>
<line x1="${G}" x2="${W - D}" y1="${H - B}" y2="${H - B}" style="stroke:var(--trait)" stroke-width="1.5"/>
<polyline class="trait" pathLength="1" points="${pts.join(' ')}" fill="none" style="stroke:var(--encre)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
${grad.map((a, i) => `<text x="${x(a - a0).toFixed(1)}" y="${H - 6}" font-size="13" style="fill:var(--doux)" text-anchor="${i === 0 ? 'start' : i === grad.length - 1 ? 'end' : 'middle'}">${a}</text>`).join('')}
<circle class="pic" cx="${x(iMax).toFixed(1)}" cy="${y(max).toFixed(1)}" r="5" style="fill:var(--encre)"/>
<text class="etiquette-pic" x="${Math.min(Math.max(x(iMax), 70), W - 70).toFixed(1)}" y="${Math.max(y(max) - 13, 15).toFixed(1)}" font-size="13" font-weight="800" style="fill:var(--texte)" text-anchor="middle">${nf(max)} bébés en ${a0 + iMax}</text>
</svg>`
}

const cta = (f: FicheInsee) => `<section class="cta r">
<h2>${esc(f.l)} vous plaît ?</h2>
<p>Swipez chacun de votre côté, sans vous influencer. Vous ne voyez que les prénoms qui vous plaisent à tous les deux, puis vous les départagez en duels.</p>
<a class="b" rel="nofollow" href="/?ref=seo&amp;prenom=${encodeURIComponent(f.slug)}">Commencer gratuitement</a>
<p class="doute">Sans publicité. Votre partenaire rejoint par un simple lien, sans rien installer.</p>
</section>`

function remplir(m: string, v: Record<string, string>) {
  return m.replace(/__(SLUG|TITRE|DESCRIPTION|CORPS|LETTRE_MAJ|LETTRE|NOM)__/g, (_, k) => v[k] ?? '')
}

export async function pageFiche(f: FicheInsee): Promise<string | null> {
  const [m, s] = await Promise.all([lireModele(), lireSommaire()])
  if (!m || !s) return null
  const an1 = s.an1
  const total = f.serie.reduce((a, b) => a + b, 0)
  const a1 = f.debut + f.serie.length - 1
  const vMax = Math.max(...f.serie)
  const aMax = f.debut + f.serie.indexOf(vMax)
  const recents = f.serie.slice(Math.max(0, an1 - 2 - f.debut)).reduce((a, b) => a + b, 0)
  const genre = GENRE[f.sexe]
  const parAn = Math.max(1, Math.round(recents / 3))
  const periode = f.debut === a1 ? `en ${f.debut}` : `entre ${f.debut} et ${a1}`
  const nom = esc(f.l)
  const lettre = lettreDe(f.slug)
  const lienLettre = s.lettres.includes(lettre) ? `/prenoms/lettre/${lettre}/` : '/prenoms/#lettres'
  const rares = f.sexe === 'm' ? '/prenoms/rares/garcons/' : '/prenoms/rares/filles/'

  const etiquettes = [`Prénom ${genre}`,
    ...(total < 1000 ? ['Prénom rare'] : []),
    ...(a1 < an1 - 20 ? ['Prénom d’autrefois'] : [])]
  const faits = [
    vMax > 5 && f.serie.length > 1 ? `Son année record : ${aMax}, avec ${nf(vMax)} naissances.` : '',
    a1 < an1 - 2
      ? `Aucune naissance publiée depuis ${a1} : ${nom} ne se donne presque plus.`
      : recents ? `Environ ${nf(parAn)} bébé${parAn > 1 ? 's' : ''} par an ces trois dernières années.` : '',
    total < 2000
      ? 'L’INSEE ne publie un prénom qu’à partir de 3 naissances dans l’année, et arrondit à 5 : une année vide peut cacher un ou deux bébés.'
      : ''
  ].filter(Boolean)

  const corps = `
<section class="hero"><h1${f.l.length > 20 ? ' class="long"' : ''}>${nom}</h1>
<ul class="etiquettes">${etiquettes.map(e => `<li>${esc(e)}</li>`).join('')}</ul></section>

<div class="chiffres">
<div><b>${nf(total)}</b><span>naissances en France ${periode}</span></div>
<div><b>${a1 < an1 - 2 ? a1 : nf(recents)}</b><span>${a1 < an1 - 2 ? 'dernière naissance publiée' : `naissances en <span class="nw">${an1 - 2}-${an1}</span>`}</span></div>
${vMax > 5 ? `<div><b>${aMax}</b><span>année record (${nf(vMax)} bébés)</span></div>` : ''}
</div>

<section class="bloc r"><h2>Popularité de ${nom} depuis ${f.debut}</h2>
<div class="popularite"><figure class="carte graphe">${graphe(f, an1)}
<figcaption>Naissances par an en France, arrondies à 5 par l’INSEE.</figcaption></figure>
<ul class="faits">${faits.map(x => `<li><span>${x}</span></li>`).join('')}</ul></div></section>

<section class="bloc r"><h2>Signification et origine de ${nom}</h2>
<div class="carte"><p>L’origine et la signification de ${nom} ne sont pas établies de façon fiable : nous préférons ne rien inventer.</p></div></section>

${cta(f)}

${f.proches.length ? `<section class="bloc r"><h2>Prénoms proches de ${nom}</h2>
<ul class="puces">${f.proches.map(p => `<li><a href="/prenom/${esc(p.slug)}/">${esc(p.l)}</a></li>`).join('')}</ul></section>` : ''}

<section class="bloc r"><h2>À voir aussi</h2>
<ul class="rangs"><li><a href="${lienLettre}"><b aria-hidden="true">${lettre.toUpperCase()}</b><span>Tous les prénoms en ${lettre.toUpperCase()}</span></a></li>
<li><a href="${rares}"><b aria-hidden="true">→</b><span>Les prénoms rares</span></a></li>
<li><a href="${s.chercher}"><b aria-hidden="true">→</b><span>Chercher un autre prénom</span></a></li></ul></section>
`
  return remplir(m, {
    SLUG: esc(f.slug), NOM: nom, LETTRE: lettre, LETTRE_MAJ: lettre.toUpperCase(),
    TITRE: esc(`${f.l} : prénom ${genre}, popularité et naissances en France`),
    DESCRIPTION: esc(`${f.l}, prénom ${genre}${total < 1000 ? ' rare' : ''} : ${nf(total)} bébés l’ont reçu en France ${periode}, d’après l’INSEE. Naissances année par année et prénoms proches.`),
    CORPS: corps
  })
}

/** La page 404 d'une fiche : même habillage, et la recherche pour rebondir. */
export async function pageIntrouvable(slug: string): Promise<string | null> {
  const [m, s] = await Promise.all([lireModele(), lireSommaire()])
  if (!m || !s) return null
  const q = slug.replace(/-/g, ' ')
  const lettre = /^[a-z]/.test(slug) ? slug[0]! : 'a'
  const corps = `<section class="hero court"><h1>Prénom introuvable</h1>
<p class="sous">« ${esc(q)} » ne figure pas parmi les prénoms publiés par l’INSEE depuis 1900. Il peut exister quand même : l’INSEE ne publie un prénom qu’à partir de 3 naissances dans l’année.</p>
<p><a class="b p" href="${s.chercher}?q=${encodeURIComponent(q)}">Chercher un prénom proche</a></p></section>`
  return remplir(m, {
    SLUG: esc(slug), NOM: 'Prénom introuvable', LETTRE: lettre, LETTRE_MAJ: lettre.toUpperCase(),
    TITRE: 'Prénom introuvable', DESCRIPTION: 'Ce prénom ne figure pas dans les naissances publiées par l’INSEE.', CORPS: corps
  })
}
