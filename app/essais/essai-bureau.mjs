/**
 * Sur un ordinateur (25/10). L'app est pensée pour le téléphone ; sur un écran
 * de 1 440 px, tout s'étirait d'un bord à l'autre. Ce que l'on garde :
 *
 *  1. L'accueil se range au centre (880 px au plus), les palmarès par paires ;
 *     pas de tirette à la souris (la carte se clique).
 *  2. Dans une liste, chaque volet a sa largeur : la carte du tri 600 px, le
 *     classement et les réglages 760 px ; la barre d'onglets 600 px. Le
 *     volet, lui, défile toujours sur toute la fenêtre.
 *  3. Les feuilles et la fiche d'un prénom : une fenêtre au milieu de
 *     l'écran, pas un tiroir collé en bas.
 *  4. Sur un téléphone, rien de tout cela : pleine largeur, feuille en bas.
 */
import { lancer, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function onglet(largeur, hauteur, souris) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, hasTouch: !souris, locale: 'fr-FR' })
  const page = await ctx.newPage()
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, 'Paul')
  await page.waitForSelector('.bento .grande .titre', { timeout: 20000 })
  await page.waitForTimeout(500)
  return page
}
const boite = (page, sel) => page.evaluate(s => {
  const r = document.querySelector(s)?.getBoundingClientRect()
  return r ? { g: Math.round(r.left), d: Math.round(r.right), l: Math.round(r.width), h: Math.round(r.top), b: Math.round(r.bottom) } : null
}, sel)

// ---------- 1440 × 900, à la souris -----------------------------------------
const p = await onglet(1440, 900, true)
const grande = await boite(p, '.bento .grande')
dit(grande && grande.l <= 880 && Math.abs((grande.g + grande.d) / 2 - 720) <= 2,
  `accueil : la carte de la liste au centre, ${grande?.l} px de large`)
const [filles, garcons] = await p.evaluate(() => [...document.querySelectorAll('.bento .demi')].slice(0, 2)
  .map(e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.top), g: Math.round(r.left) } }))
dit(filles && garcons && filles.h === garcons.h && garcons.g > filles.g,
  'accueil : filles et garçons côte à côte')
dit(!(await p.locator('.tirette').isVisible()), 'à la souris : pas de tirette au bord de l’écran')

await p.locator('.bento button.partager').click()
await p.waitForSelector('.feuille-corps'); await p.waitForTimeout(600)
const f = await boite(p, '.feuille-corps')
dit(f && f.h >= 20 && f.b <= 900 - 20 && Math.abs((f.h + f.b) / 2 - 450) <= 40,
  `la feuille de partage : une fenêtre au milieu de l’écran (de ${f?.h} à ${f?.b} px)`)
await p.keyboard.press('Escape')
await p.locator('.feuille-corps').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})

const listes = await p.evaluate(() => fetch('/api/groupes').then(r => r.json()))
const id = listes.find(l => l.nom === 'Notre liste').id
await p.goto(`${BASE}/g/${id}/swipe`, { waitUntil: 'networkidle' })
await p.waitForSelector('.cartes article.carte', { timeout: 20000 }); await p.waitForTimeout(800)
const carte = await boite(p, '.cartes article.carte')
dit(carte && carte.l <= 600 && Math.abs((carte.g + carte.d) / 2 - 720) <= 2, `tri : la carte au centre, ${carte?.l} px de large`)
const volet = await boite(p, '.pager > section')
dit(volet && volet.l === 1440, 'tri : le volet, lui, défile sur toute la fenêtre')
const barre = await p.evaluate(() => {
  const b = [...document.querySelectorAll('.onglets > a, .onglets > button')].map(e => e.getBoundingClientRect())
  return { g: Math.round(Math.min(...b.map(r => r.left))), d: Math.round(Math.max(...b.map(r => r.right))) }
})
dit(barre.d - barre.g <= 600 && Math.abs((barre.g + barre.d) / 2 - 720) <= 2,
  `onglets : regroupés au centre (${barre.d - barre.g} px)`)

for (const [o, nom] of [['classement', 'classement'], ['reglages', 'réglages']]) {
  await p.goto(`${BASE}/g/${id}/${o}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
  const largeur = await p.evaluate(i => {
    const s = document.querySelectorAll('.pager > section')[i]
    const cs = getComputedStyle(s)
    return Math.round(s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
  }, o === 'classement' ? 1 : 2)
  dit(largeur === 760, `${nom} : une colonne de ${largeur} px`)
}

// la fiche d'un prénom
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await p.waitForSelector('.bento .rang'); await p.locator('.bento .rang').first().click()
await p.waitForSelector('.voile .feuille'); await p.waitForTimeout(600)
const fiche = await boite(p, '.voile .feuille')
dit(fiche && fiche.h >= 20 && fiche.b <= 880, `la fiche d’un prénom : une fenêtre, détachée du bas (de ${fiche?.h} à ${fiche?.b} px)`)

// ---------- un téléphone : rien ne change ------------------------------------
const t = await onglet(390, 844, false)
const gt = await boite(t, '.bento .grande')
dit(gt && gt.g === 16 && gt.d === 390 - 16, 'téléphone : la carte de la liste en pleine largeur')
dit(await t.locator('.tirette').isVisible(), 'téléphone : la tirette est là')
await t.locator('.bento button.partager').click()
await t.waitForSelector('.feuille-corps'); await t.waitForTimeout(600)
const ft = await boite(t, '.feuille-corps')
dit(ft && ft.b === 844 && ft.l === 390, 'téléphone : la feuille monte du bas, en pleine largeur')

dit(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
