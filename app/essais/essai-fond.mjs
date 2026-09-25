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
  document.head ? c() : document.addEventListener('DOMContentLoaded', c) })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('   [err]', e.message))

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })

const devant = page.locator('.carte.fiche:not(.derriere)')
const fond = page.locator('.carte.fiche.derriere')

// ---------- 1. la carte du fond est complete -------------------------------
const part = async (l, sel) => (await l.locator(sel).count())
for (const [nom, sel] of [
  ['le prénom', '.nom'], ['le bouton Favoris', '.etoile'],
  ['la ligne de stats', '.resume'], ['les trois boutons du bas', '.bas .btn']
]) {
  const a = await part(devant, sel), b = await part(fond, sel)
  dit(b === a && b > 0, `${nom} : ${a} devant, ${b} derrière`)
}
// Les puces d'origine varient d'un prenom a l'autre : on compare la premiere,
// celle du sexe, pas leur nombre.
const sexe = async l => (await l.locator('.puce').first().innerText()).trim()
const [sd, sf] = [await sexe(devant), await sexe(fond)]
dit(['fille', 'garçon', 'mixte'].includes(sd) && ['fille', 'garçon', 'mixte'].includes(sf),
    `la puce fille/garçon : « ${sd} » devant, « ${sf} » derrière`)
const g1 = await part(devant, '.graphe svg'), g2 = await part(fond, '.graphe svg')
dit(g1 === g2, `la courbe : ${g1} devant, ${g2} derrière`)
const h1 = await devant.evaluate(e => e.offsetHeight)
const h2 = await fond.evaluate(e => e.offsetHeight)
dit(Math.abs(h1 - h2) < 2, `même hauteur (${h1} / ${h2} px)`)

// ---------- 2. mais inerte -------------------------------------------------
dit(await fond.locator('.contenu[inert]').count() === 1, 'le contenu du fond est inert')
dit(await devant.locator('.contenu[inert]').count() === 0, 'celui de devant ne l’est pas')
const favAvant = await page.evaluate(() =>
  fetch('/api/groupes/1').then(r => r.json()).then(d => d.mes_favoris.length))
await fond.locator('.etoile').click({ force: true }).catch(() => {})
await page.waitForTimeout(700)
// Le clic tombe sur la carte de DEVANT (celle du fond est dessous) : la
// toucher ouvre sa fiche. On la referme — ce qui compte ici, c'est que le
// favori du fond n'ait pas bougé.
if (await page.locator('.voile').count()) {
  await page.getByRole('button', { name: 'Fermer la fiche' }).click()
  await page.waitForTimeout(600)
}
const favApres = await page.evaluate(() =>
  fetch('/api/groupes/1').then(r => r.json()).then(d => d.mes_favoris.length))
dit(favAvant === favApres, `cliquer le Favoris du fond ne fait rien (${favAvant} → ${favApres})`)

// ---------- 3. et elle monte toujours pendant le vol -----------------------
const nomFond = await fond.locator('.nom').innerText()
await page.screenshot({ path: '/tmp/w1-repos.png' })
const film = page.evaluate(async () => {
  const v = []
  const t0 = performance.now()
  while (performance.now() - t0 < 500) {
    const el = document.querySelector('.carte.fiche.derriere')
    if (el) v.push(+(+getComputedStyle(el).opacity).toFixed(2))
    await new Promise(r => requestAnimationFrame(r))
  }
  return v
})
await page.locator('.rond.non').click()
const ops = await film
dit(Math.max(...ops) > 0.9, `la carte du fond monte bien pendant le vol (opacité max ${Math.max(...ops)})`)
await page.waitForTimeout(250)
await page.screenshot({ path: '/tmp/w2-vol.png' })
await page.waitForTimeout(900)
dit((await devant.locator('.nom').innerText()) === nomFond,
    `celle qu’on voyait derrière est passée devant (${nomFond})`)

// ---------- 4. plus de puce de score dans Communs --------------------------
await page.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
await page.waitForSelector('.segment button', { timeout: 20000 })
const cl = page.locator('.pager > section:nth-child(2)')
await page.waitForSelector('.pager > section:nth-child(2) article h2', { timeout: 20000 })
const carte1 = cl.locator('article').first()
dit(await carte1.locator('.puce').count() === 0,
    `plus aucune puce chiffrée sur une ligne de Communs (${await carte1.locator('.puce').count()})`)
console.log('   première ligne :', (await carte1.innerText()).replace(/\n/g, ' · '))
await page.screenshot({ path: '/tmp/w3-communs.png' })

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
