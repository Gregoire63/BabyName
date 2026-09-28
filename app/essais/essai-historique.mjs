/**
 * L'historique, les feuilles et le glissement entre pages.
 *
 * Ce qui se vérifie ici :
 *  - les textes légaux (conditions, confidentialité, mentions, accessibilité)
 *    s'ouvrent dans une FEUILLE qui monte du bas et redescend en se fermant :
 *    on les lit sans quitter l'écran, l'adresse ne change pas, l'historique
 *    non plus ; les onglets et les liens d'un texte à l'autre restent dans la
 *    feuille ;
 *  - arrivé par un lien direct, un texte légal reste une page, dont le
 *    « Retour » ramène à l'app ;
 *  - pendant le glissement vers une liste, la page qui bouge est opaque : on
 *    ne voit pas l'autre au travers ;
 *  - les onglets d'une liste n'empilent rien : un retour ramène à l'accueil.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

/** Relève le haut de la feuille, image après image, pendant `ms`. */
const mouvement = (ms) => page.evaluate(duree => new Promise(ok => {
  const t0 = performance.now(), tops = []
  let vue = false, partie = false
  const tic = () => {
    const f = document.querySelector('.feuille-corps')
    if (f) { vue = true; tops.push(Math.round(f.getBoundingClientRect().top)) } else if (vue) partie = true
    if (performance.now() - t0 < duree) requestAnimationFrame(tic); else ok({ tops, partie })
  }
  requestAnimationFrame(tic)
}), ms)
const titreFeuille = () => page.locator('.feuille-corps h2').first().innerText().catch(() => '')
const descend = t => t.length > 2 && t[t.length - 1] > t[0] + 40
const monte = t => t.length > 2 && t[0] > t[t.length - 1] + 40

// =================== 0. DE LA CONNEXION AUX CONDITIONS ======================
// Les conditions se lisent dans une feuille, par-dessus la connexion : on ne
// perd pas le formulaire, et on n'a rien à « retrouver » en revenant.
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const hist0 = await page.evaluate(() => history.length)
const yForm = Math.round((await page.locator('.accueil .carte').first().boundingBox()).y)
const ouverture = mouvement(700)
await page.locator('.accueil').getByRole('link', { name: 'conditions' }).first().click()
const o0 = await ouverture
dit(new URL(page.url()).pathname === '/connexion' && /Conditions générales/.test(await titreFeuille()),
  `« conditions » ouvre une feuille, l’adresse reste /connexion (« ${await titreFeuille()} »)`)
dit(monte(o0.tops), `la feuille monte du bas (${o0.tops[0]} → ${o0.tops[o0.tops.length - 1]} px)`)
dit(await page.getByRole('dialog').count() === 1, 'une seule feuille, un vrai dialogue')
const fermeture = mouvement(700)
await page.locator('.feuille-corps').getByRole('button', { name: 'Fermer' }).click()
const f0 = await fermeture
dit(descend(f0.tops) && f0.partie && await page.locator('.feuille-corps').count() === 0,
  `et redescend en se fermant (${f0.tops[0]} → ${f0.tops[f0.tops.length - 1]} px), puis disparaît`)
dit(await page.evaluate(() => history.length) === hist0
    && Math.round((await page.locator('.accueil .carte').first().boundingBox()).y) === yForm,
  'l’historique n’a pas bougé, le formulaire non plus')

await entrerComme(page, 'Paul')
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
      // Jusqu'à 8 s : sous `nuxt dev`, la première visite d'une liste compile
      // ses modules, et le glissement ne part qu'après (1,5 s ne suffisait pas).
      // On rend la main dès qu'il part : un essai qui passe n'attend pas plus.
      if (performance.now() - t0 < 8000) requestAnimationFrame(tic); else ok(null)
    }
    requestAnimationFrame(tic)
  }))
  await declencher()
  return releve
}
const opaque = c => !!c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'

// =================== 1. LES TEXTES LÉGAUX, D'UN ONGLET À L'AUTRE ============
const hist1 = await page.evaluate(() => history.length)
const ouv1 = mouvement(700)
await pied('Mentions légales').click()
const o1 = await ouv1
dit(monte(o1.tops) && await titreFeuille() === 'Mentions légales' && chemin() === '/',
  `le pied de l’accueil ouvre les mentions dans une feuille (« ${await titreFeuille()} », ${chemin()})`)
dit(/06 69 36 57 34/.test(await page.locator('.feuille-corps').innerText()), 'le téléphone de l’éditeur y figure')
await page.locator('.feuille-corps .onglets-legaux').getByRole('button', { name: 'Confidentialité' }).click()
await page.waitForTimeout(300)
dit(await titreFeuille() === 'Confidentialité'
    && /L’essentiel/.test(await page.locator('.feuille-corps').innerText()),
  'un onglet, et c’est la confidentialité, dans la même feuille')
await page.locator('.feuille-corps .texte-legal').getByRole('link', { name: 'mentions légales' }).first().click()
await page.waitForTimeout(300)
dit(await titreFeuille() === 'Mentions légales' && chemin() === '/'
    && await page.getByRole('dialog').count() === 1,
  'un lien d’un texte vers l’autre change d’onglet, sans quitter la feuille ni l’accueil')
const ferme1 = mouvement(700)
await page.keyboard.press('Escape')
const f1 = await ferme1
dit(descend(f1.tops) && await page.locator('.feuille-corps').count() === 0,
  'Échap la referme, en descendant')
dit(await page.evaluate(() => history.length) === hist1, `aucune entrée d’historique (${hist1})`)

// Arrivé par un lien direct, c'est une page : son « Retour » ramène à l'app.
await page.goto(`${BASE}/mentions-legales`, { waitUntil: 'networkidle' })
dit(/Mentions légales/.test(await page.locator('main#contenu h1').innerText().catch(() => '')),
  'l’adresse directe /mentions-legales reste une page')
await page.getByRole('button', { name: 'Retour' }).click()
await page.waitForURL(u => new URL(u).pathname === '/', { timeout: 8000 }).catch(() => null)
dit(chemin() === '/', `son « Retour » ramène à l’accueil (${chemin()})`)
await page.waitForSelector('.bento', { timeout: 10000 })
await page.waitForTimeout(500)

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
