import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s) }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|favicon|fonts|preload/.test(m.text())) { erreurs.push(m.text()); console.log('   [js]', m.text()) } })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVP-ARNA-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(600)

// La carte votee reste un moment dans l'arbre, hors ecran et a opacite 0 :
// lire la premiere du DOM renvoyait le prenom qu'on venait de juger.
const devantVisible = () => page.evaluate(() => {
  const e = [...document.querySelectorAll('.carte.fiche:not(.derriere)')].find(el => {
    const st = getComputedStyle(el); const r = el.getBoundingClientRect()
    return +st.opacity > 0.5 && r.left > -40 && r.left < innerWidth / 2
  })
  return e?.querySelector('.nom')?.textContent?.trim() ?? null
})
const attendreCarte = async (sauf) => {
  for (let i = 0; i < 25; i++) {
    const n = await devantVisible()
    if (n && n !== sauf) return n
    await page.waitForTimeout(120)
  }
  return await devantVisible()
}

// ---------- 1. le catalogue porte les groupes ----------------------------
const cat = await page.evaluate(async () => {
  const r = await fetch('/data/catalogue.json.gz')
  const b = new Uint8Array(await r.arrayBuffer())
  const gz = b[0] === 0x1f && b[1] === 0x8b
  const t = gz ? await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
               : new TextDecoder().decode(b)
  const d = JSON.parse(t)
  const groupes = new Set(d.cols.gp).size
  // un groupe temoin : toutes les graphies de « Elio »
  const i = d.cols.l.indexOf('Elio')
  const gp = d.cols.gp[i]
  const memes = d.cols.l.filter((_, k) => d.cols.gp[k] === gp)
  return { n: d.n, groupes, champ: d.champs.gp, memes, octets: b.length }
})
dit(cat.champ === 'groupe_prononciation', 'le champ gp est documenté dans champs')
dit(cat.groupes > 10000 && cat.groupes < cat.n,
    `${cat.n} prénoms pour ${cat.groupes} prononciations (−${Math.round((1 - cat.groupes / cat.n) * 100)} %)`)
dit(cat.memes.length >= 8 && cat.memes.includes('Elyo') && cat.memes.includes('Hélio'),
    `le groupe d’Elio : ${cat.memes.join(', ')}`)
// b.length mesure le corps DECOMPRESSE quand le serveur pose
// Content-Encoding: gzip (c'est ce que fait le serveur de dev). Le poids reseau
// se lit dans content-length, pas dans le buffer.
const poids = await page.evaluate(async () => {
  const r = await fetch('/data/catalogue.json.gz', { cache: 'reload' })
  return +(r.headers.get('content-length') ?? 0)
})
// Budget : 460 Ko. Le 27/09 il est passé de 430 à 460 pour de bonnes raisons —
// une courbe pour les 794 prénoms qui ont eu un sommet (Aurélie, Stéphanie…)
// et les barres des 3 849 petits prénoms de la pile (+44 Ko en tout). Pas
// davantage sans une raison du même ordre.
dit(poids > 0 && poids < 460000, `catalogue ${(poids / 1024).toFixed(0)} Ko sur le fil`)

// ---------- 2. la pile ne montre plus les doublons -----------------------
const noms = []
const variantesVues = []
let precedent = null
for (let i = 0; i < 14; i++) {
  const n = await attendreCarte(precedent)
  noms.push(n); precedent = n
  const gr = await page.locator('.carte.fiche:not(.derriere) .graphies').count()
  if (gr) variantesVues.push((await page.locator('.carte.fiche:not(.derriere) .graphies').first()
    .innerText()).replace(/\s+/g, ' ').trim())
  await page.getByRole('button', { name: 'Oui' }).first().click()
  await page.waitForTimeout(650)
}
console.log('   [pile]', noms.join(' · '))
if (variantesVues.length) console.log('   [graphies]', variantesVues[0])
dit(variantesVues.length > 0, `${variantesVues.length} cartes sur 14 annoncent leurs autres graphies`)

// ---------- 3. le vote emporte tout le groupe, et rien ne revient -------
// On ne demande pas au serveur « quels sont mes votes » : /votes renvoie aussi
// ceux des autres membres, et un prenom juge par Alice a parfaitement le
// droit de rester dans MA pile. On verifie la propriete qui compte vraiment :
// une prononciation jugee ne revient plus, sous aucune graphie.
const groupeDe = (nom) => page.evaluate(async (n) => {
  const r = await fetch('/data/catalogue.json.gz')
  const b = new Uint8Array(await r.arrayBuffer())
  const gz = b[0] === 0x1f && b[1] === 0x8b
  const t = gz ? await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
               : new TextDecoder().decode(b)
  const d = JSON.parse(t)
  const i = d.cols.l.indexOf(n)
  return i < 0 ? null : d.cols.gp[i]
}, nom)

const gpJuges = new Set()
for (const n of noms) {
  const gp = await groupeDe(n)
  if (gp !== null) gpJuges.add(gp)
}
dit(gpJuges.size >= 12, `${noms.length} cartes ont couvert ${gpJuges.size} prononciations`)

const revenus = []
const vus = []
for (let i = 0; i < 12; i++) {
  const n = await attendreCarte(precedent)
  precedent = n
  vus.push(n)
  const gp = await groupeDe(n)
  if (gp !== null && gpJuges.has(gp)) revenus.push(n)
  gpJuges.add(gp)
  await page.getByRole('button', { name: 'Neutre' }).first().click()
  await page.waitForTimeout(600)
}
console.log('   [suite]', vus.join(' · '))
dit(revenus.length === 0, revenus.length === 0
  ? `aucune prononciation déjà jugée ne réapparaît (${vus.length} cartes de plus)`
  : `reviennent sous une autre graphie : ${revenus.join(', ')}`)

// ---------- 4. la recherche trouve encore chaque graphie ----------------
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
await page.locator('input.chercher').fill('hélyo')
await page.waitForTimeout(500)
const trouve = await page.locator('.trouve', { hasText: 'Hélyo' }).count()
dit(trouve > 0, 'la recherche trouve encore une graphie qui n’a jamais eu sa carte')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
