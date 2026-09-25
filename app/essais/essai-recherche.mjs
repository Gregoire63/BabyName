/**
 * La recherche sous la loupe du tri, et les feuilles.
 *
 * Ce qui se vérifie ici :
 *  - la loupe du tri ouvre la recherche, curseur déjà dans le champ ;
 *  - un résultat n'a qu'une action : le toucher le met EN PREMIÈRE CARTE et
 *    referme la feuille — plus de votes ni de blocage ligne par ligne ;
 *  - un prénom déjà jugé revient aussi, la carte dit ce qu'on en avait dit,
 *    et le rejuger remplace l'ancien vote ; un prénom bloqué ne se propose
 *    pas ;
 *  - au bout du quota, le prénom choisi attend son tour (retenu) ;
 *  - le bouton Filtres est une icône, et la feuille Filtres n'a plus de
 *    champ de recherche ;
 *  - quand le clavier sort (iPhone : il se pose sur la page), la feuille
 *    remonte au-dessus, champ et résultats visibles ;
 *  - la feuille et la fiche se referment en glissant, pas d'un coup.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function entrer(cle, initialisation) {
  const { ctx, page } = await onglet(nav)
  if (initialisation) await ctx.addInitScript(initialisation)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.locator('input.champ').fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
  return page
}
const posee = p => p.waitForFunction(() =>
  document.querySelectorAll('.carte.fiche:not(.derriere)').length === 1, null, { timeout: 5000 }).catch(() => {})
const devant = p => p.locator('.carte.fiche:not(.derriere)')
const nomDevant = async p => { await posee(p); return (await devant(p).locator('.nom').innerText()).trim() }
const ouvrirRecherche = async p => {
  await p.getByRole('button', { name: 'Chercher un prénom' }).click()
  await p.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
  await p.waitForTimeout(400)
}
const ligne = (p, nom) => p.locator('.trouve').filter({ has: p.locator(`.nom:text-is("${nom}")`) })
const mesVotes = p => p.evaluate(() => fetch('/api/groupes/1/votes').then(r => r.json()))

/** Suit une fermeture image par image : en mouvement juste après le geste, partie ensuite. */
async function suivreFermeture(p, sel, declencher) {
  const releves = p.evaluate((s) => new Promise(ok => {
    const t0 = performance.now(), out = []
    const tic = () => {
      const el = document.querySelector(s)
      const m = el ? new DOMMatrix(getComputedStyle(el).transform) : null
      out.push({ t: Math.round(performance.now() - t0), la: !!el, y: m ? Math.round(m.m42) : null })
      if (performance.now() - t0 < 700) requestAnimationFrame(tic); else ok(out)
    }
    requestAnimationFrame(tic)
  }), sel)
  await declencher()
  const r = await releves
  return { r, glisse: r.filter(x => x.la && x.y > 20).length >= 3, partie: !r[r.length - 1].la }
}

// =================== 1. LA LOUPE, LES FILTRES ==============================
const page = await entrer('DEVG-REGX-2345')
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
await devant(page).locator('.nom').first().waitFor({ timeout: 25000 })
await page.waitForTimeout(500)

const loupe = page.getByRole('button', { name: 'Chercher un prénom' })
const boite = await loupe.boundingBox()
dit(!!boite && boite.x + boite.width > 390 - 40 && boite.y < 90,
  `la loupe est dans le coin haut droit (x=${Math.round(boite?.x)}, y=${Math.round(boite?.y)})`)
const filtres = page.getByRole('button', { name: /^Filtres/ })
dit(await filtres.locator('svg').count() === 1 && (await filtres.innerText()).trim() === '',
  'le bouton Filtres est une icône')
await filtres.click()
await page.waitForSelector('.feuille-corps', { timeout: 6000 })
dit(await page.locator('.feuille-corps input[type="search"], .feuille-corps input[placeholder*="prénom"]').count() === 0,
  'la feuille Filtres n’a plus de champ « Chercher un prénom »')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

await ouvrirRecherche(page)
dit(await page.evaluate(() => document.activeElement?.classList.contains('chercher')),
  'la recherche s’ouvre curseur dans le champ')

// =================== 2. TOUCHER = PREMIÈRE CARTE ============================
await page.locator('input.chercher').fill('anatole')
await page.waitForTimeout(400)
const anatole = ligne(page, 'Anatole')
dit(await anatole.count() === 1 && await anatole.locator('.trio, button.veto').count() === 0,
  'un résultat n’a plus ni votes ni blocage : une seule ligne à toucher')
await anatole.click()
await page.waitForTimeout(700)
dit(await page.locator('.feuille-corps').count() === 0, 'le toucher referme la feuille')
dit(await nomDevant(page) === 'Anatole', `et Anatole passe en première carte (${await nomDevant(page)})`)
await page.getByRole('button', { name: 'Oui à Anatole' }).click()
await page.waitForTimeout(900)
dit((await mesVotes(page)).votes.some(v => v.prenom === 'Anatole' && v.valeur === 2),
  'on le juge d’un geste, comme une autre carte')

// =================== 3. DÉJÀ JUGÉ : ON LE REJUGE ===========================
await ouvrirRecherche(page)
await page.locator('input.chercher').fill('colette')
await page.waitForTimeout(400)
dit((await ligne(page, 'Colette').locator('.puce').allInnerTexts()).includes('Oui'),
  'la ligne dit ce qu’on en a déjà dit (Colette : Oui)')
await ligne(page, 'Colette').click()
await page.waitForTimeout(800)
dit(await nomDevant(page) === 'Colette', 'un prénom déjà jugé revient quand même en première carte')
dit(/Vous aviez dit oui/.test(await devant(page).locator('.deja').innerText().catch(() => '')),
  'et la carte rappelle ce qu’on en avait dit')
await page.getByRole('button', { name: 'Neutre pour Colette' }).click()
await page.waitForTimeout(1100)
const moi = (await page.evaluate(() => fetch('/api/groupes/1').then(r => r.json()))).moi.user_id
const colette = (await mesVotes(page)).votes.find(v => v.prenom === 'Colette' && v.user_id === moi)
dit(colette?.valeur === 1, `le nouveau vote remplace l’ancien (Colette : ${colette?.valeur})`)
dit(await nomDevant(page) !== 'Colette', 'et la carte passe')

await ouvrirRecherche(page)
await page.locator('input.chercher').fill('brandon')
await page.waitForTimeout(400)
const brandon = ligne(page, 'Brandon')
dit(await brandon.count() === 1 && await brandon.evaluate(el => el.tagName) !== 'BUTTON'
    && (await brandon.locator('.puce').innerText()).trim() === 'Bloqué',
  'un prénom bloqué est affiché comme tel, sans rien à toucher')

// =================== 4. LA FERMETURE GLISSE ================================
const f1 = await suivreFermeture(page, '.feuille-corps',
  () => page.getByRole('button', { name: 'Fermer', exact: true }).click())
dit(f1.glisse && f1.partie,
  `la feuille descend avant de disparaître (${f1.r.filter(x => x.la).map(x => x.y).join(' → ')} px)`)
await page.waitForTimeout(300)
await devant(page).getByRole('button', { name: /^Infos sur / }).click()
await page.waitForSelector('.voile .feuille', { timeout: 6000 })
await page.waitForTimeout(450)
const f2 = await suivreFermeture(page, '.voile .feuille',
  () => page.getByRole('button', { name: 'Fermer la fiche' }).click())
dit(f2.glisse && f2.partie, `la fiche aussi (${f2.r.filter(x => x.la).map(x => x.y).join(' → ')} px)`)

// =================== 5. AU BOUT DU QUOTA, LE PRÉNOM ATTEND ================
await page.goto(`${BASE}/g/2/swipe`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.evaluate(async () => {
  for (const p of ['Iris', 'Jeanne', 'Adèle', 'Margot', 'Rose', 'Zoé']) {
    const r = await fetch('/api/groupes/2/vote', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prenom: p, valeur: 2 }) })
    if (r.status === 402) break
  }
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await ouvrirRecherche(page)
await page.locator('input.chercher').fill('gaspard')
await page.waitForTimeout(400)
await ligne(page, 'Gaspard').click()
await page.waitForTimeout(700)
dit(await page.locator('.vide', { hasText: 'aujourd’hui' }).count() === 1
    && await page.evaluate(() => localStorage.getItem('pr_epingle_2')) === 'Gaspard',
  'au bout du quota, le mur reste, et Gaspard est retenu pour la prochaine fois')

// =================== 6. LE CLAVIER NE CACHE PLUS LA FEUILLE =================
// Un iPhone simulé : le clavier se pose sur la page, seule la « vue visible »
// rétrécit. La feuille doit tenir au-dessus.
const iphone = await entrer('DEVG-REGX-2345', () => {
  const vv = new EventTarget()
  let hauteur = window.innerHeight
  Object.defineProperty(vv, 'height', { get: () => hauteur })
  Object.defineProperty(vv, 'offsetTop', { get: () => 0 })
  Object.defineProperty(vv, 'width', { get: () => window.innerWidth })
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  window.__clavier = (h) => { hauteur = window.innerHeight - h; vv.dispatchEvent(new Event('resize')) }
})
// Par l'accueil, comme au premier bloc : c'est le chemin que prend l'app.
await iphone.locator('a.carte', { hasText: 'Notre liste' }).first().click()
const carteVue = await devant(iphone).locator('.nom').first().waitFor({ timeout: 30000 }).then(() => true, () => false)
if (!carteVue) {
  await iphone.screenshot({ path: '/tmp/essai-recherche-iphone.png' })
  console.log('   [iphone]', iphone.url(), (await iphone.locator('main, body').first().innerText()).slice(0, 300).replace(/\s+/g, ' '))
}
await ouvrirRecherche(iphone)
await iphone.locator('input.chercher').fill('ma')
await iphone.waitForTimeout(300)
await iphone.evaluate(() => window.__clavier(336))
await iphone.waitForTimeout(300)
const vue = await iphone.evaluate(() => {
  const c = document.querySelector('.feuille-corps').getBoundingClientRect()
  const champ = document.querySelector('.feuille-corps input.chercher').getBoundingClientRect()
  return { bas: Math.round(c.bottom), haut: Math.round(c.top), champ: Math.round(champ.bottom),
           visible: window.innerHeight - 336 }
})
dit(vue.bas <= vue.visible + 1 && vue.haut >= 0 && vue.champ < vue.visible,
  `clavier sorti : la feuille tient au-dessus (bas ${vue.bas} ≤ ${vue.visible}), champ visible`)
await iphone.evaluate(() => window.__clavier(0))
await iphone.waitForTimeout(300)
const apres = await iphone.evaluate(() => Math.round(document.querySelector('.feuille-corps').getBoundingClientRect().bottom))
dit(apres >= await iphone.evaluate(() => window.innerHeight) - 1, 'clavier rentré : elle redescend')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
