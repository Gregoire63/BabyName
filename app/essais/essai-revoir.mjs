/**
 * « À revoir » : deux volets qui se replient (PanneauRevoir.vue).
 *
 * Ce qui se vérifie ici :
 *  - Paul dit non à trois prénoms qu'Alice aime : ses deux groupes existent,
 *    les siens d'abord, puis ceux d'Alice ;
 *  - chaque en-tête est un bouton dans un titre (motif « accordéon ») :
 *    titre, compte, chevron, aria-expanded, aria-controls ; tout est ouvert
 *    au départ ;
 *  - toucher l'en-tête replie son groupe : ses cartes quittent la page (ni
 *    vues ni tabulables), l'autre groupe reste ouvert, le compte reste lu ;
 *    retoucher le rouvre ; au clavier aussi, Entrée et Espace ;
 *  - ce qui est replié est retenu au rechargement ;
 *  - l'en-tête reste collé en haut quand on fait défiler son groupe ; replié
 *    de là, l'écran remonte au début du groupe au lieu de rester au milieu
 *    de l'autre ;
 *  - changer d'avis marche toujours dans un volet ouvert, et le compte suit ;
 *  - aucune violation WCAG A/AA, ouvert et replié, en clair et en sombre.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, compteur, BASE, entrerComme } from './navigateur.mjs'

const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const nav = await lancer()
// Un écran un peu court : les deux groupes ne tiennent pas, il faut défiler.
const ctx = await nav.newContext({ viewport: { width: 390, height: 640 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => {
    const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s)
  }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

async function auditer(nom) {
  await page.waitForTimeout(400)
  await page.evaluate(AXE)
  const r = await page.evaluate(async () => (await window.axe.run(document,
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }))
    .violations.map(v => `${v.id} (${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')})`))
  dit(r.length === 0, `${nom} : aucune violation WCAG A/AA${r.length ? ` — ${r.join(' ; ')}` : ''}`)
}

const sec = page.locator('.pager > section:nth-child(2)')
const entete = cle => sec.locator(`#revoir-${cle}`)
const liste = cle => sec.locator(`#liste-revoir-${cle}`)
const noms = async cle => (await liste(cle).locator('.desaccord .nom').allInnerTexts()).map(t => t.trim())
async function allerARevoir() {
  await page.waitForSelector('.onglets button', { timeout: 20000 })
  await page.locator('.onglets button', { hasText: 'Classement' }).click()
  await page.waitForTimeout(700)
  await sec.getByRole('tab', { name: /À revoir/ }).click()
  await sec.locator('.groupe-revoir').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
}

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
// Alice aime Adèle, Margot et Gaspard, que Paul n'a pas jugés : il dit non.
await page.waitForSelector('.onglets button', { timeout: 20000 })
const votes = await page.evaluate(async () => {
  const r = []
  for (const prenom of ['Adèle', 'Margot', 'Gaspard']) {
    const x = await fetch('/api/groupes/1/vote', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prenom, valeur: 0 }) })
    r.push(x.status)
  }
  return r
})
dit(votes.every(s => s === 200), `Paul dit non à Adèle, Margot et Gaspard (${votes.join(', ')})`)
await page.reload({ waitUntil: 'networkidle' })
await allerARevoir()

// ---------- 1. deux volets, ouverts ---------------------------------------
const titres = (await sec.locator('.titre-groupe').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())
dit(titres.length === 2 && /^Ceux que vous n’avez pas aimés 3/.test(titres[0]) && /^Ceux qu’Alice n’a pas aimés 2/.test(titres[1]),
  `deux groupes, les siens d’abord (${titres.join(' | ')})`)
const aria = await sec.locator('.titre-groupe').evaluateAll(hs => hs.map(h => {
  const b = h.querySelector('button')
  return { tag: h.tagName, bouton: !!b, ouvert: b?.getAttribute('aria-expanded'),
    controle: !!document.getElementById(b?.getAttribute('aria-controls') ?? '-'), nom: b?.textContent.replace(/\s+/g, ' ').trim() }
}))
dit(aria.every(a => a.tag === 'H3' && a.bouton && a.ouvert === 'true' && a.controle),
  'chaque en-tête est un bouton dans un titre, aria-expanded et aria-controls, ouvert au départ')
dit(/3 prénoms$/.test(aria[0].nom), `le compte se lit « 3 prénoms » (« ${aria[0].nom} »)`)
dit((await noms('moi')).sort().join() === 'Adèle,Gaspard,Margot' && (await noms('eux')).sort().join() === 'Hector,Marius',
  'Adèle, Gaspard, Margot chez lui ; Hector, Marius chez Alice')
await auditer('À revoir, ouvert')

// ---------- 2. replier, rouvrir -------------------------------------------
await entete('moi').click()
await page.waitForTimeout(500)
dit(await entete('moi').getAttribute('aria-expanded') === 'false' && await liste('moi').isHidden(),
  'toucher l’en-tête replie son groupe')
dit(await liste('eux').isVisible() && (await noms('eux')).length === 2, 'l’autre reste ouvert')
dit(/3/.test(await entete('moi').innerText()), 'replié, le compte reste lu')
const tabulables = await liste('moi').evaluate(l => [...l.querySelectorAll('button')].filter(b => b.offsetParent !== null).length)
dit(tabulables === 0, 'replié, ses boutons ne sont plus atteignables')
await auditer('À revoir, un volet replié')
await entete('moi').click()
await page.waitForTimeout(500)
dit(await entete('moi').getAttribute('aria-expanded') === 'true' && await liste('moi').isVisible()
    && (await noms('moi')).length === 3, 'retoucher le rouvre')

await entete('eux').focus()
await page.keyboard.press('Enter')
await page.waitForTimeout(450)
const parEntree = await entete('eux').getAttribute('aria-expanded')
await page.keyboard.press('Space')
await page.waitForTimeout(450)
dit(parEntree === 'false' && await entete('eux').getAttribute('aria-expanded') === 'true',
  'au clavier : Entrée replie, Espace rouvre')

// ---------- 3. retenu -----------------------------------------------------
await entete('eux').click()
await page.waitForTimeout(450)
await page.reload({ waitUntil: 'networkidle' })
await allerARevoir()
dit(await entete('eux').getAttribute('aria-expanded') === 'false' && await liste('eux').isHidden()
    && await entete('moi').getAttribute('aria-expanded') === 'true',
  'au rechargement, le groupe d’Alice est toujours replié, le sien ouvert')
await entete('eux').click()
await page.waitForTimeout(450)

// ---------- 4. l'en-tête suit le défilement ---------------------------------
// Un groupe d'Alice plus long (Paul dit oui à deux prénoms qu'elle refuse)
// et un écran plus court : replié, le premier groupe laisse le second
// dépasser l'écran — c'est là qu'il ne faut pas rester au milieu de lui.
const oui = await page.evaluate(async () => {
  const r = []
  for (const prenom of ['Ferdinand', 'Dylan']) {
    const x = await fetch('/api/groupes/1/vote', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prenom, valeur: 2 }) })
    r.push(x.status)
  }
  return r
})
await page.reload({ waitUntil: 'networkidle' })
await allerARevoir()
dit(oui.every(s => s === 200) && (await noms('eux')).sort().join() === 'Dylan,Ferdinand,Hector,Marius',
  `Paul dit oui à Ferdinand et Dylan, qu’Alice refuse : quatre dans son groupe (${(await noms('eux')).join(', ')})`)
await page.setViewportSize({ width: 390, height: 480 })
await page.waitForTimeout(300)
const colle = await sec.evaluate(s => {
  const groupe = s.querySelector('.groupe-revoir')
  const h = groupe.querySelector('.titre-groupe')
  s.scrollTop += groupe.getBoundingClientRect().top - s.getBoundingClientRect().top + 160
  return new Promise(r => requestAnimationFrame(() => r({
    sticky: getComputedStyle(h).position,
    marge: parseFloat(getComputedStyle(s).paddingTop),
    ecart: Math.round(h.getBoundingClientRect().top - s.getBoundingClientRect().top),
    groupeAuDessus: groupe.getBoundingClientRect().top < s.getBoundingClientRect().top
  })))
})
dit(colle.sticky === 'sticky' && colle.groupeAuDessus && Math.abs(colle.ecart - colle.marge) <= 1,
  `au milieu de son groupe, l’en-tête reste en haut, sous la marge de la page (${colle.ecart} px du bord, marge ${colle.marge} px)`)
await entete('moi').click()
await page.waitForTimeout(600)
const apres = await sec.evaluate(s => {
  const [g1, g2] = s.querySelectorAll('.groupe-revoir')
  const haut = s.getBoundingClientRect().top
  return { g1: Math.round(g1.getBoundingClientRect().top - haut), g2: Math.round(g2.getBoundingClientRect().top - haut),
    defile: s.scrollTop > 0 }
})
dit(apres.defile && apres.g1 >= -1 && apres.g1 <= 20 && apres.g2 > apres.g1 && apres.g2 - apres.g1 < 90,
  `replié de là, l’écran remonte au début du groupe, l’autre juste dessous (${apres.g1} px, ${apres.g2} px)`)
await entete('moi').click()
await page.waitForTimeout(500)
await page.setViewportSize({ width: 390, height: 640 })
await page.waitForTimeout(300)

// ---------- 5. changer d'avis dans un volet ouvert ---------------------------
const marius = liste('eux').locator('.desaccord').filter({ has: page.locator('.nom', { hasText: /^Marius$/ }) })
await marius.getByRole('button', { name: /^Non/ }).click()
await page.waitForTimeout(1200)
const restent = await noms('eux')
dit(restent.length === 3 && !restent.includes('Marius') && /^Ceux qu’Alice n’a pas aimés\s*3/.test((await entete('eux').innerText()).trim()),
  'Paul dit non à Marius : il quitte « À revoir », le compte passe à 3')

// ---------- 6. en sombre --------------------------------------------------
await page.emulateMedia({ colorScheme: 'dark' })
await auditer('À revoir, en sombre')
await entete('moi').click()
await page.waitForTimeout(450)
await auditer('À revoir, un volet replié, en sombre')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
