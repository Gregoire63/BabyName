/**
 * Le fond qui respire (Ambiance.vue) : léger pour l'œil, et pour le téléphone.
 *
 * Ce qui se vérifie ici :
 *  - chaque page porte son fond, derrière son contenu (accueil, tri,
 *    connexion, page légale) ;
 *  - il bouge, et seulement par ce que le compositeur déplace sans repeindre
 *    (translate, scale, rotate, opacity) ;
 *  - mesuré : aucun Paint en trois secondes de tri au repos — un témoin
 *    animé « à l'ancienne » (background-position) en fait des centaines ;
 *  - il se fige sous une feuille ouverte (son voile floute ce qui est
 *    derrière), et repart quand elle se ferme ;
 *  - « réduire les animations » : il ne bouge plus du tout ;
 *  - pendant le glissement vers la liste, la page qui arrive est isolée et
 *    emporte son propre fond.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { ctx, page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

const fond = () => page.evaluate(() => {
  const a = document.querySelectorAll('.ambiance')
  const anims = document.getAnimations().filter(x => x.effect?.target?.closest?.('.ambiance'))
  const props = new Set()
  for (const x of anims) for (const k of x.effect.getKeyframes()) {
    for (const p of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p)
  }
  const z = a[0] ? getComputedStyle(a[0]) : null
  return { n: a.length, anims: anims.length, props: [...props].sort(),
           enCours: anims.filter(x => x.playState === 'running').length,
           fixe: z?.position === 'fixed' && z?.zIndex === '-1', cache: a[0]?.getAttribute('aria-hidden') === 'true' }
})

/** Les Paint d'une trace Chrome de `ms` millisecondes. */
async function paints(ms) {
  const cdp = await ctx.newCDPSession(page)
  const evts = []
  cdp.on('Tracing.dataCollected', e => evts.push(...e.value))
  await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' })
  await page.waitForTimeout(ms)
  const fini = new Promise(r => cdp.once('Tracing.tracingComplete', r))
  await cdp.send('Tracing.end'); await fini
  await cdp.detach()
  return evts.filter(e => e.name === 'Paint').length
}

// ---------- 1. sur chaque page ------------------------------------------
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const connexion = await fond()
dit(connexion.n === 1 && connexion.fixe && connexion.cache, `la connexion a son fond, derrière tout, caché aux lecteurs d’écran`)
await page.goto(`${BASE}/conditions`, { waitUntil: 'networkidle' })
dit((await fond()).n === 1, 'une page légale aussi')
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
await page.waitForTimeout(400)
dit((await fond()).n === 1, 'l’accueil aussi')

// ---------- 2. le glissement vers la liste --------------------------------
// Relevé image par image, jusqu'à la fin du glissement (la première ouverture
// d'un serveur de dev neuf compile la liste : il peut commencer tard).
const pendant = page.evaluate(() => new Promise(fini => {
  const t0 = performance.now(); const vus = []
  const tic = () => {
    const p = document.querySelector('.page-enter-active')
    if (p) vus.push({ iso: getComputedStyle(p).isolation, fond: !!p.querySelector('.ambiance') })
    const fin = vus.length > 0 && !p
    if (!fin && performance.now() - t0 < 10000) requestAnimationFrame(tic); else fini(vus)
  }
  requestAnimationFrame(tic)
}))
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
const vus = await pendant
dit(vus.length > 0 && vus.every(v => v.iso === 'isolate' && v.fond),
  `pendant le glissement, la page qui arrive est isolée et porte son fond (${vus.length} images relevées)`)
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
await page.waitForTimeout(800)

// ---------- 3. il bouge, sans rien repeindre ------------------------------
const tri = await fond()
dit(tri.n === 1 && tri.anims >= 8 && tri.enCours === tri.anims,
  `sur le tri : un fond, ${tri.anims} animations en cours`)
dit(tri.props.length > 0 && tri.props.every(p => ['translate', 'scale', 'rotate', 'opacity'].includes(p)),
  `seulement ce que le compositeur déplace : ${tri.props.join(', ')}`)
const nAnime = await paints(3000)
await page.addStyleTag({ content: '@keyframes temoin { to { background-position: 160px 240px } } .ambiance { animation: temoin 2s linear infinite alternate; background-image: radial-gradient(circle, red, transparent) !important }' })
await page.waitForTimeout(200)
const nTemoin = await paints(3000)
dit(nAnime === 0 && nTemoin > 50,
  `aucun Paint en 3 s de fond animé (${nAnime}) ; le témoin animé à l’ancienne en fait ${nTemoin}`)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
await page.waitForTimeout(500)

// ---------- 4. figé sous une feuille --------------------------------------
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('[aria-modal="true"]', { timeout: 8000 })
await page.waitForTimeout(400)
const sous = await page.evaluate(() => [...document.querySelectorAll('.ambiance .halo')]
  .map(e => getComputedStyle(e).animationPlayState))
dit(sous.length > 0 && sous.every(s => s.split(',').every(x => x.trim() === 'paused')),
  `sous la feuille de recherche, le fond se fige (${sous.length} taches en pause)`)
await page.keyboard.press('Escape')
await page.waitForTimeout(800)
dit((await fond()).enCours === tri.anims, 'la feuille fermée, il repart')

// ---------- 5. réduire les animations --------------------------------------
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.waitForTimeout(300)
dit((await fond()).anims === 0, '« réduire les animations » : le fond ne bouge plus du tout')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
