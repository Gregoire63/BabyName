/**
 * Les liens légaux (PiedLegal) : sur UNE ligne, partout où ils sont, dans les
 * huit langues de l'app, dès 360 px de large. Ils en prenaient deux sur
 * presque chaque écran (65 px au lieu de 30).
 *
 * Ce qui se vérifie ici :
 *  - connexion, offrir, une page légale, l'accueil et « Mon compte » (le plus
 *    étroit : 320 px de place) : une ligne, rien qui dépasse ;
 *  - des liens lisibles (10,5 px au moins) et assez hauts pour le doigt
 *    (24 px) ;
 *  - un texte agrandi (deux fois) passe à la ligne, et rien ne sort de
 *    l'écran.
 *
 *   sh essais/relance.sh essais/essai-pied-legal.mjs
 */
import { lancer, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []
const ctx = await nav.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style'); s.textContent = '#nuxt-devtools-container{display:none!important}'; document.head?.appendChild(s) }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
const LANGUES = ['fr', 'en', 'de', 'nl', 'sv', 'nb', 'pl', 'lv']

/** Chaque pied légal visible (dans `dans`) : ses lignes, ce qui dépasse, sa police, la hauteur de ses liens. */
const releve = (dans = 'body') => page.evaluate(d => [...document.querySelector(d).querySelectorAll('nav.pied-legal ul')].filter(u => u.offsetParent).map(ul => {
  const liens = [...ul.querySelectorAll('a')]
  const r = liens.map(a => a.getBoundingClientRect())
  return { lignes: new Set(r.map(x => Math.round(x.top))).size, deborde: ul.scrollWidth > ul.clientWidth + 1 || r.some(x => x.right > innerWidth + 0.5 || x.left < -0.5),
    police: Math.min(...liens.map(a => parseFloat(getComputedStyle(a).fontSize))), haut: Math.min(...r.map(x => x.height)), n: liens.length,
    textes: liens.map(a => a.textContent.trim()).join(' · ') }
}), dans)
const fautes = []
async function verifier(langue, ecran, dans) {
  const p = await releve(dans)
  if (p.length !== 1) { fautes.push(`${langue} ${ecran} : ${p.length} pied(s) légal(aux) visible(s)`); return }
  const x = p[0]
  if (x.n !== 4 || x.lignes !== 1 || x.deborde || x.police < 10.5 || x.haut < 24) fautes.push(`${langue} ${ecran} : ${JSON.stringify(x)}`)
}
const langueLocale = l => page.evaluate(l => localStorage.setItem('pr_langue', l), l)
const langueCompte = l => page.evaluate(async l => {
  await fetch('/api/moi/langue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choix: l, langue: l }) })
  localStorage.setItem('pr_langue', l)
}, l)

// ---- Sans compte : la connexion, « Offrir », une page légale
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
for (const l of LANGUES) {
  await langueLocale(l)
  for (const [chemin, ecran] of [['/connexion', 'connexion'], ['/offrir', 'offrir'], ['/mentions-legales', 'page légale']]) {
    await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(l => document.documentElement.lang === l, l, { timeout: 8000 }).catch(() => null)
    await page.waitForTimeout(300)
    await verifier(l, ecran)
  }
}

// ---- Avec un compte : l'accueil, « Mon compte » (le plus étroit)
await langueLocale('fr')
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
for (const l of LANGUES) {
  await langueCompte(l)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForFunction(l => document.documentElement.lang === l, l, { timeout: 8000 }).catch(() => null)
  await page.waitForSelector('.bento', { timeout: 20000 })
  await page.waitForTimeout(300)
  await verifier(l, 'accueil')
  await page.getByRole('button', { name: /Paul/ }).first().click()
  await page.locator('.feuille-corps').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  await verifier(l, 'mon compte', '.feuille-corps')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}
dit(fautes.length === 0, `les liens légaux tiennent sur une ligne, lisibles et touchables, dans 5 écrans × 8 langues à 360 px${fautes.length ? ` — ${fautes.slice(0, 4).join(' | ')}` : ''}`)

// ---- Texte agrandi deux fois : à la ligne, rien qui sorte de l'écran
await langueCompte('fr')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.getByRole('button', { name: /Paul/ }).first().click()
await page.locator('.feuille-corps').waitFor({ timeout: 8000 })
await page.waitForTimeout(500)
await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
await page.waitForTimeout(300)
const grand = (await releve('.feuille-corps'))[0]
dit(!!grand && grand.lignes >= 2 && !grand.deborde,
  `texte agrandi deux fois : les liens passent à la ligne (${grand?.lignes} lignes), rien ne sort de l’écran`)

await langueCompte('fr')
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
