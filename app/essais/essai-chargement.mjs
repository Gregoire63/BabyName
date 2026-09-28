import { lancer, entrerComme } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const nav = await lancer()

const sansDevtools = async ctx => ctx.addInitScript(() => {
  const cacher = () => {
    const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s)
  }
  document.head ? cacher() : document.addEventListener('DOMContentLoaded', cacher)
})

// ---------- 1. l'ecran d'amorce, avant que Vue ne demarre -----------------
for (const [nom, theme] of [['clair', 'light'], ['sombre', 'dark']]) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme })
  const p = await ctx.newPage()
  // On empeche le bundle de se charger : l'ecran d'amorce reste affiche, c'est
  // exactement ce que voit quelqu'un sur un reseau lent.
  await p.route('**/_nuxt/**', r => r.abort())
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => null)
  await p.waitForTimeout(900)
  const vu = await p.locator('.amorce').count()
  dit(vu === 1, `écran d’amorce présent avant le bundle (thème ${nom})`)
  await p.screenshot({ path: `/tmp/c0-amorce-${nom}.png` })
  await ctx.close()
}

// ---------- 2. les squelettes, API ralentie -------------------------------
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await sansDevtools(ctx)
const page = await ctx.newPage()
page.on('pageerror', e => console.log('   [err]', e.message))

// connexion rapide, puis on ralentit
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })

const LENT = 2600
await page.route('**/api/groupes**', async r => {
  await new Promise(res => setTimeout(res, LENT))
  // la page peut avoir ete quittee entre-temps : ce n'est pas une erreur
  await r.continue().catch(() => null)
})

// accueil
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.bento .fantome', { timeout: 10000 })
dit(await page.locator('.bento .fantome').count() >= 4, 'accueil : squelette bento à la place du mot « Chargement… »')
dit(await page.locator('.squelette').first().isVisible(), 'les barres balaient')
await page.screenshot({ path: '/tmp/c1-accueil.png' })
await page.waitForSelector('.bento .grande:not(.fantome)', { timeout: 20000 })
dit(true, 'puis le vrai contenu prend sa place')

// swipe
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.fantome', { timeout: 10000 })
dit(await page.locator('.fiche.fantome').count() === 1, 'tri : la carte est dessinée avant d’arriver')
dit(await page.locator('.boutons .squelette').count() === 3, 'et les trois boutons aussi')
await page.screenshot({ path: '/tmp/c2-swipe.png' })

// reglages
await page.goto(`${BASE}/g/1/reglages`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('section[aria-busy="true"]', { timeout: 10000 })
dit(await page.locator('section[aria-busy="true"]').count() === 3, 'réglages : trois cartes esquissées')
await page.screenshot({ path: '/tmp/c3-reglages.png' })

// ---------- 3. Top a disparu ----------------------------------------------
// page neuve : celle du dessus a encore un ralentisseur branche
const net = await ctx.newPage()
await net.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
await net.waitForSelector('.segment button', { timeout: 20000 })
const volets = (await net.locator('.segment button').allInnerTexts()).map(t => t.trim().split('\n')[0].trim())
dit(JSON.stringify(volets) === JSON.stringify(['Communs', 'À revoir', 'Mes choix', 'Portrait']),
    `volets : ${volets.join(' | ')}`)
const t2 = await ctx.newPage()
await t2.goto(`${BASE}/g/1/top`, { waitUntil: 'networkidle' })
await t2.waitForSelector('.segment button.on', { timeout: 20000 })
dit((await t2.locator('.segment button.on').innerText()).trim().split('\n')[0].trim() === 'Communs',
    '/g/1/top retombe sur Communs')

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
