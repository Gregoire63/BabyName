/**
 * L'historique et le glissement entre pages.
 *
 * Ce qui se vérifie ici :
 *  - lire les pages légales en chaîne (conditions → confidentialité →
 *    mentions) ne demande qu'UN « Retour » pour revenir dans l'app — le
 *    bouton de la page comme celui du navigateur ;
 *  - les pages légales ne glissent pas : un fondu, une page APRÈS l'autre —
 *    jamais deux superposées (le formulaire de connexion arrivait « par le
 *    bas » en revenant des conditions) ;
 *  - pendant le glissement vers une liste, la page qui bouge est opaque : on
 *    ne voit pas l'autre au travers ;
 *  - les onglets d'une liste n'empilent rien : un retour ramène à l'accueil.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

// =================== 0. DE LA CONNEXION AUX CONDITIONS, ET RETOUR ==========
// Le formulaire arrivait d'un coup « par le bas » : il revient en fondu, et
// ne bouge pas d'un pixel pendant qu'il apparaît.
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.locator('.accueil').getByRole('link', { name: 'conditions' }).first().click()
await page.waitForURL(/\/conditions$/, { timeout: 8000 })
await page.waitForTimeout(500)
const retourConnexion = page.evaluate(() => new Promise(ok => {
  const t0 = performance.now(), ys = []
  let max = 0
  const tic = () => {
    max = Math.max(max, document.querySelectorAll('.fondu-enter-active, .fondu-leave-active').length)
    const c = document.querySelector('.accueil .carte')
    if (c) ys.push(Math.round(c.getBoundingClientRect().y))
    if (performance.now() - t0 < 1200) requestAnimationFrame(tic); else ok({ max, ys })
  }
  requestAnimationFrame(tic)
}))
await page.getByRole('button', { name: 'Retour' }).click()
const r0 = await retourConnexion
dit(new URL(page.url()).pathname === '/connexion' && r0.max === 1 && r0.ys.length > 0
    && Math.max(...r0.ys) - Math.min(...r0.ys) <= 1,
  `retour à la connexion : un fondu, le formulaire reste en place (y ${Math.min(...r0.ys)}–${Math.max(...r0.ys)})`)

await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
await page.waitForTimeout(600)

const chemin = () => new URL(page.url()).pathname
const pied = nom => page.locator('nav.pied-legal').last().getByRole('link', { name: nom })

/** Relève, pendant un glissement, le fond et l'ordre des deux pages. */
async function pendantGlissement(declencher) {
  const releve = page.evaluate(() => new Promise(ok => {
    const t0 = performance.now()
    const tic = () => {
      const el = document.querySelector('.page-enter-active')
      if (el) {
        const sortante = document.querySelector('.page-leave-active')
        const s = getComputedStyle(el), s2 = sortante ? getComputedStyle(sortante) : null
        ok({ fond: s.backgroundColor, image: s.backgroundImage.slice(0, 15),
             fondSortante: s2?.backgroundColor ?? null,
             zEntree: s.zIndex, zSortie: s2?.zIndex ?? null,
             sens: document.documentElement.dataset.sens })
        return
      }
      if (performance.now() - t0 < 1500) requestAnimationFrame(tic); else ok(null)
    }
    requestAnimationFrame(tic)
  }))
  await declencher()
  return releve
}
const opaque = c => !!c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'

/** Relève, pendant un fondu, combien de pages sont là en même temps. */
async function pendantFondu(declencher) {
  const releve = page.evaluate(() => new Promise(ok => {
    const t0 = performance.now()
    let vu = false, max = 0, glisse = false
    const tic = () => {
      const f = document.querySelectorAll('.fondu-enter-active, .fondu-leave-active').length
      if (f) vu = true
      max = Math.max(max, f)
      if (document.querySelector('.page-enter-active, .page-leave-active')) glisse = true
      if (performance.now() - t0 < 1200) requestAnimationFrame(tic); else ok({ vu, max, glisse })
    }
    requestAnimationFrame(tic)
  }))
  await declencher()
  return releve
}

// =================== 1. LES PAGES LEGALES EN CHAINE ======================
const g1 = await pendantFondu(() => pied('Conditions').click())
dit(g1.vu && g1.max === 1 && !g1.glisse,
  `vers une page légale : un fondu, jamais deux pages à la fois (${JSON.stringify(g1)})`)
await page.waitForURL(/\/conditions$/, { timeout: 8000 })
await page.waitForTimeout(500)
await pied('Confidentialité').click()
await page.waitForURL(/\/confidentialite$/, { timeout: 8000 })
await page.waitForTimeout(500)
await page.locator('main#contenu').getByRole('link', { name: 'mentions légales' }).first().click()
await page.waitForURL(/\/mentions-legales$/, { timeout: 8000 })
await page.waitForTimeout(500)
dit(await page.evaluate(() => history.length) <= 3,
  `trois pages lues, une seule entrée d’historique pour elles (history.length = ${await page.evaluate(() => history.length)})`)

const g2 = await pendantFondu(() => page.getByRole('button', { name: 'Retour' }).click())
await page.waitForURL(u => new URL(u).pathname === '/', { timeout: 8000 }).catch(() => null)
dit(chemin() === '/', `un seul « Retour » ramène à l’accueil (${chemin()})`)
dit(g2.vu && g2.max === 1 && !g2.glisse, `et le retour aussi, en fondu (${JSON.stringify(g2)})`)
await page.waitForSelector('.bento', { timeout: 10000 })
await page.waitForTimeout(500)

// Le bouton du navigateur fait pareil.
await pied('Conditions').click()
await page.waitForURL(/\/conditions$/, { timeout: 8000 })
await page.waitForTimeout(400)
await pied('Accessibilité').click()
await page.waitForURL(/\/accessibilite$/, { timeout: 8000 })
await page.waitForTimeout(400)
await page.goBack({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
dit(chemin() === '/', `le retour du navigateur aussi (${chemin()})`)

// =================== 2. ENTRER DANS UNE LISTE ============================
const g3 = await pendantGlissement(() =>
  page.locator('a.carte', { hasText: 'Notre liste' }).first().click())
dit(g3 && opaque(g3.fond) && g3.zEntree === '1',
  `la liste qui arrive est opaque et par-dessus (${g3?.fond})`)
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
await page.waitForTimeout(500)

// =================== 3. LES ONGLETS N'EMPILENT RIEN ======================
const avant = await page.evaluate(() => history.length)
for (const o of ['Classement', 'La liste', 'Swipe', 'La liste']) {
  await page.locator('.onglets button', { hasText: o }).click()
  await page.waitForTimeout(600)
}
dit(await page.evaluate(() => history.length) === avant, 'quatre changements d’onglet, aucune entrée d’historique')
await page.goBack({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
dit(chemin() === '/', `un retour depuis la liste ramène à l’accueil (${chemin()})`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
