import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => erreurs.push(e.message))
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()) })

// On reproduit l'etat de Paul : un worker deja installe sur l'origine,
// herite d'un `npm run preview` servi sur le meme port que le dev.
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const pose = await page.evaluate(async () => {
  try { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; return true }
  catch (e) { return 'echec: ' + e.message }
})
dit(pose === true, `worker installe a la main pour l'essai (${pose})`)

// Rechargement : le plugin doit le desinstaller tout seul.
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const restants = await page.evaluate(() =>
  navigator.serviceWorker.getRegistrations().then(rs => rs.length))
dit(restants === 0, `plus aucun worker apres rechargement (${restants})`)
const cs = await page.evaluate(() => 'caches' in window ? caches.keys() : [])
dit(cs.length === 0, `caches vides (${cs.length})`)

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.waitForSelector('button', { timeout: 15000 })
const mime = erreurs.filter(e => /MIME type|dynamically imported module/.test(e))
dit(mime.length === 0, `aucune erreur de module ni de MIME (${mime.length})`)
dit(await page.getByRole('tab', { name: 'Inscription' }).count() === 1,
    'la page de connexion s’affiche')

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
if (ko.length) console.log('erreurs vues :', erreurs.slice(0, 6))
process.exit(ko.length ? 1 : 0)
