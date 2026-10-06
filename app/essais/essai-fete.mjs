/**
 * La fête d'un accord arrive là où l'on est — et l'écran reste utilisable.
 *
 * Un accord se fête quand le serveur a répondu : un tiers de seconde après le
 * geste au mieux, plusieurs sur un réseau de téléphone. Entre-temps on a pu
 * changer d'onglet ou de volet. La fête s'ouvrait alors DANS l'écran qu'on
 * venait de quitter : dessinée par-dessus tout mais inerte (un onglet qu'on ne
 * regarde pas l'est), ou pas dessinée du tout (un volet replié) — et comme un
 * dialogue rend inerte tout ce qui n'est pas lui, plus rien ne répondait.
 * Il fallait recharger la page.
 *
 * Ici, le serveur met une seconde et demie à répondre au vote, et on part
 * avant :
 *  A. swipe « oui » qui fait un accord, puis onglet Classement ;
 *  B. le même, puis retour à l'accueil : pas de fête hors de la liste ;
 *  C. « finalement oui » dans À revoir, puis volet Communs ;
 *  D. « finalement oui » dans À revoir, puis onglet Swipe — et « Voir nos
 *     accords » y mène (le bouton ne faisait rien depuis À revoir) ;
 *  E. swipe « oui », puis la loupe : la fête arrive par-dessus la recherche,
 *     et « Voir nos accords » ne laisse pas la recherche fermer la page.
 *
 * Les gestes sont de vrais touchers aux coordonnées de l'élément, pas des
 * click() : c'est `inert` qu'on éprouve, et un click() synthétique passe au
 * travers.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []
const RETARD = 1500

async function ouvrir(qui) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  // Le serveur lent : chaque vote attend `lent.ms` avant de partir.
  const lent = { ms: 0 }
  await page.route('**/api/groupes/1/vote', async route => {
    if (lent.ms && route.request().method() === 'POST') await new Promise(r => setTimeout(r, lent.ms))
    await route.continue()
  })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.locator('.bento').first().waitFor({ timeout: 30000 })
  return { ctx, page, lent }
}

async function entrerDansLaListe(page) {
  await page.locator('.bento .grande').first().click()
  await page.locator('.carte.fiche:not(.derriere) .nom').first().waitFor({ timeout: 45000 })
  await page.waitForTimeout(700)
}

/** Un vrai toucher au milieu de l'élément, où qu'il soit. Faux s'il n'est pas dessiné. */
async function toucher(page, selecteur, texte = '') {
  const p = await page.evaluate(([selecteur, texte]) => {
    const el = [...document.querySelectorAll(selecteur)].find(x => !texte || x.textContent.includes(texte))
    const r = el?.getBoundingClientRect()
    return r?.width ? [r.x + r.width / 2, r.y + r.height / 2] : null
  }, [selecteur, texte])
  if (!p) return false
  await page.touchscreen.tap(p[0], p[1])
  return true
}

/** Ce que l'écran montre et laisse faire. */
const etat = (page) => page.evaluate(() => {
  const f = document.querySelector('.fete')
  const r = f?.getBoundingClientRect()
  const pager = document.querySelector('.pager')
  return {
    fete: !!f,
    pleinEcran: !!r && r.width >= innerWidth - 1 && r.height >= innerHeight - 1,
    inerte: !!f?.closest('[inert]'),
    texte: (f?.innerText ?? '').replace(/\s+/g, ' ').trim(),
    onglet: pager ? Math.round(pager.scrollLeft / pager.clientWidth) : null,
    volet: document.querySelector('.segment [aria-selected="true"]')?.id ?? null,
    sectionsInertes: [...document.querySelectorAll('.pager > section')].map(s => !!s.inert),
    navInerte: !!document.querySelector('nav.onglets')?.closest('[inert]'),
    inertes: document.querySelectorAll('[inert]').length,
    dialogue: document.documentElement.classList.contains('dialogue')
  }
})

/** Mettre un prénom précis en première carte, par la loupe (voir essai-social). */
async function pileSur(page, nom) {
  await page.getByRole('button', { name: 'Chercher un prénom' }).click()
  await page.locator('.feuille-corps input.chercher').waitFor({ timeout: 10000 })
  await page.locator('input.chercher').fill(nom)
  await page.waitForTimeout(400)
  await page.locator('.trouve').filter({ has: page.locator(`.nom:text-is("${nom}")`) }).click()
  await page.waitForTimeout(900)
}

// =================================================================== Paul
const P = await ouvrir('Paul')
await entrerDansLaListe(P.page)

// ---------- A. swipe « oui » sur Adèle (Alice l'aime), puis onglet Classement
await pileSur(P.page, 'Adèle')
P.lent.ms = RETARD
await toucher(P.page, '.boutons .rond.oui')
await P.page.waitForTimeout(120)
await toucher(P.page, 'nav.onglets button', 'Classement')
await P.page.waitForTimeout(600)
const enRoute = await etat(P.page)
dit(!enRoute.fete && enRoute.onglet === 1, 'on est déjà dans Classement que le serveur n’a pas encore répondu')
await P.page.waitForTimeout(RETARD + 1200)
let e = await etat(P.page)
dit(e.fete && e.pleinEcran && /Adèle/.test(e.texte) && /Alice aussi/.test(e.texte),
  `A. la fête d’Adèle arrive dans l’onglet où l’on est (onglet ${e.onglet}) : « ${e.texte.slice(0, 48)}… »`)
dit(e.fete && !e.inerte, 'elle n’est pas inerte')
await toucher(P.page, '.fete .actions .btn', 'Continuer')
await P.page.waitForTimeout(500)
e = await etat(P.page)
dit(!e.fete && !e.dialogue, 'un toucher sur « Continuer à trier » la ferme')
dit(!e.navInerte && e.sectionsInertes.join() === 'true,false,true',
  `la page est rendue telle quelle : seuls les deux onglets qu’on ne regarde pas sont inertes (${e.sectionsInertes.join()})`)
await toucher(P.page, 'nav.onglets button', 'Swipe')
await P.page.waitForTimeout(900)
e = await etat(P.page)
dit(e.onglet === 0, 'la navigation répond : retour au tri')

// ---------- B. swipe « oui » sur Margot (Alice l'aime), puis l'accueil
await pileSur(P.page, 'Margot')
P.lent.ms = RETARD
await toucher(P.page, '.boutons .rond.oui')
await P.page.waitForTimeout(120)
await toucher(P.page, 'nav.onglets a.sortie')
await P.page.locator('.bento').first().waitFor({ timeout: 20000 })
await P.page.waitForTimeout(RETARD + 1500)
const accueil = await P.page.evaluate(() => ({
  fete: !!document.querySelector('.fete'),
  inertes: document.querySelectorAll('[inert]').length,
  dialogue: document.documentElement.classList.contains('dialogue')
}))
dit(!accueil.fete && !accueil.inertes && !accueil.dialogue,
  `B. parti à l’accueil avant la réponse : pas de fête, rien d’inerte (${accueil.inertes})`)
P.lent.ms = 0
await toucher(P.page, '.bento .grande')
await P.page.locator('.carte.fiche:not(.derriere) .nom').first().waitFor({ timeout: 45000 })
const accords = await P.page.evaluate(async () => (await fetch('/api/groupes/1/communs').then(r => r.json())).map(c => c.prenom))
dit(accords.includes('Adèle') && accords.includes('Margot'),
  'l’accueil répond, on rentre dans la liste, et les deux accords sont bien comptés')
await P.ctx.close()

// ================================================================== Alice
// Paul a dit oui à Marius et Hector ; Alice, non. Elle change d'avis.
const A = await ouvrir('Alice')
await entrerDansLaListe(A.page)
await toucher(A.page, 'nav.onglets button', 'Classement')
await A.page.waitForTimeout(900)
await toucher(A.page, '#onglet-revoir')
await A.page.waitForTimeout(900)
const aRevoir = await A.page.locator('#volet-revoir .desaccord .nom').allInnerTexts()
dit(aRevoir.sort().join() === 'Hector,Marius', `Alice a deux désaccords à revoir (${aRevoir.join(', ')})`)

const finalementOui = (prenom) => A.page.evaluate((prenom) => {
  const carte = [...document.querySelectorAll('#volet-revoir .desaccord')]
    .find(c => c.querySelector('.nom')?.textContent.trim() === prenom)
  const r = carte?.querySelector('.trio .v2')?.getBoundingClientRect()
  return r?.width ? [r.x + r.width / 2, r.y + r.height / 2] : null
}, prenom).then(p => p && A.page.touchscreen.tap(p[0], p[1]))

// ---------- C. « finalement oui » à Marius, puis volet Communs
A.lent.ms = RETARD
await finalementOui('Marius')
await A.page.waitForTimeout(120)
await toucher(A.page, '#onglet-communs')
await A.page.waitForTimeout(RETARD + 2200)
e = await etat(A.page)
dit(e.fete && e.pleinEcran && !e.inerte && /Marius/.test(e.texte) && /Paul aussi/.test(e.texte),
  `C. la fête de Marius se voit depuis le volet Communs (${e.volet}), et n’est pas inerte`)
await toucher(A.page, '.fete .actions .btn', 'Continuer')
await A.page.waitForTimeout(500)
e = await etat(A.page)
dit(!e.fete && !e.navInerte && e.sectionsInertes.join() === 'true,false,true', 'elle se ferme, la page est rendue')
const communs = await A.page.locator('#volet-communs .commun').allInnerTexts()
dit(communs.some(t => /Marius/.test(t)), 'Marius est dans les accords')

// ---------- D. « finalement oui » à Hector, puis onglet Swipe
await toucher(A.page, '#onglet-revoir')
await A.page.waitForTimeout(900)
await finalementOui('Hector')
await A.page.waitForTimeout(120)
await toucher(A.page, 'nav.onglets button', 'Swipe')
await A.page.waitForTimeout(RETARD + 2200)
e = await etat(A.page)
dit(e.fete && e.pleinEcran && !e.inerte && /Hector/.test(e.texte) && e.onglet === 0,
  'D. la fête d’Hector se voit depuis le tri, et n’est pas inerte')
await toucher(A.page, '.fete .actions .btn', 'Voir nos accords')
await A.page.waitForTimeout(1200)
e = await etat(A.page)
dit(!e.fete && e.onglet === 1 && e.volet === 'onglet-communs',
  `« Voir nos accords » ferme la fête et y mène (onglet ${e.onglet}, ${e.volet})`)
dit(!e.navInerte && e.sectionsInertes.join() === 'true,false,true', 'et rien ne reste inerte derrière')

// ---------- E. une feuille ouverte sous la fête, puis « Voir nos accords »
// Paul aime Lucien, Alice ne l'a pas jugé. Elle dit oui, et ouvre la loupe
// avant la réponse : la fête arrive par-dessus la recherche. « Voir nos
// accords » change d'onglet — la recherche, restée ouverte dans le tri qu'on
// quitte, gardait toute la page inerte.
await toucher(A.page, 'nav.onglets button', 'Swipe')
await A.page.waitForTimeout(900)
await pileSur(A.page, 'Lucien')
await toucher(A.page, '.boutons .rond.oui')
await A.page.waitForTimeout(500)
await toucher(A.page, 'button.loupe[aria-label="Chercher un prénom"]')
await A.page.waitForTimeout(RETARD + 1400)
e = await etat(A.page)
const dessous = await A.page.locator('.feuille-corps').count()
dit(e.fete && !e.inerte && /Lucien/.test(e.texte) && dessous === 1,
  `E. la fête de Lucien arrive par-dessus la recherche ouverte (${dessous} feuille dessous)`)
await toucher(A.page, '.fete .actions .btn', 'Voir nos accords')
await A.page.waitForTimeout(1500)
e = await etat(A.page)
const restent = await A.page.locator('[aria-modal="true"]').count()
dit(!e.fete && restent === 0 && !e.dialogue,
  `« Voir nos accords » : la fête part, et la recherche restée dans le tri se ferme toute seule (${restent} dialogue)`)
dit(e.onglet === 1 && e.volet === 'onglet-communs' && !e.navInerte && e.sectionsInertes.join() === 'true,false,true',
  `on est dans les accords, et la page répond (inertes : ${e.sectionsInertes.join()}, navigation ${e.navInerte ? 'inerte' : 'libre'})`)
await toucher(A.page, 'nav.onglets button', 'Swipe')
await A.page.waitForTimeout(900)
await toucher(A.page, 'button.loupe[aria-label="Chercher un prénom"]')
await A.page.waitForTimeout(700)
e = await etat(A.page)
dit(e.onglet === 0 && await A.page.locator('.feuille-corps input.chercher').count() === 1,
  'retour au tri d’un toucher, et la loupe s’ouvre de nouveau')
A.lent.ms = 0

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
