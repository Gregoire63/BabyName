/**
 * Les autres graphies d'un prénom : une ligne courte sur la carte, et leurs
 * chiffres dans une feuille à onglets.
 *
 *  - la carte ne dit plus « le vote vaut pour 7 graphies » ; elle nomme
 *    quelques graphies et propose « Voir plus » ;
 *  - toucher la ligne ouvre la feuille (pas la fiche) : un onglet par
 *    graphie, sa part des naissances dans l'étiquette ;
 *  - changer d'onglet change les chiffres ; les flèches du clavier aussi ;
 *  - « Toute la fiche de X » ouvre la fiche de cette graphie-là ;
 *  - aucune violation WCAG A/AA, en clair comme en sombre.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

async function auditer(nom) {
  await page.waitForTimeout(450)
  await page.evaluate(AXE)
  const r = await page.evaluate(async () => (await window.axe.run(document,
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }))
    .violations.map(v => `${v.id} (${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')})`))
  dit(r.length === 0, `${nom} : aucune violation WCAG A/AA${r.length ? ` — ${r.join(' ; ')}` : ''}`)
}

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
const devant = () => page.locator('.carte.fiche:not(.derriere)')
await devant().locator('.nom').first().waitFor({ timeout: 25000 })
await page.waitForTimeout(500)

// Elio en première carte, par la loupe : ses graphies sont nombreuses.
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher')
await page.waitForTimeout(350)
await page.locator('input.chercher').fill('elio')
await page.waitForTimeout(400)
await page.locator('.trouve').filter({ has: page.locator('.nom:text-is("Elio")') }).click()
await page.waitForTimeout(900)

const ligne = devant().locator('.graphies')
const texteLigne = (await ligne.innerText().catch(() => '')).replace(/\s+/g, ' ')
dit(await ligne.count() === 1 && /aussi écrit/.test(texteLigne) && /Voir plus/.test(texteLigne),
  `la carte nomme les graphies et propose « Voir plus » (« ${texteLigne} »)`)
dit(!/vaut pour/.test(await devant().innerText()), 'plus de « le vote vaut pour N graphies » sur la carte')

await ligne.click()
await page.waitForSelector('.feuille-corps [role="tablist"]', { timeout: 8000 })
await page.waitForTimeout(400)
dit(await page.locator('.voile .feuille').count() === 0, 'toucher la ligne ouvre la feuille des graphies, pas la fiche')
const titre = await page.locator('.feuille-corps h2').first().innerText()
const onglets = page.locator('.feuille-corps [role="tab"]')
const n = await onglets.count()
dit(new RegExp(`Les ${n} façons d’écrire Elio`).test(titre), `titre : « ${titre} » (${n} onglets)`)
dit(n >= 3, 'un onglet par graphie')
dit(/votre vote vaut pour les \d+/.test(await page.locator('.feuille-corps').innerText()),
  'la feuille dit, elle, que le vote vaut pour toutes')
const etiquettes = await onglets.allInnerTexts()
dit(etiquettes.every(t => /%/.test(t)) && /^Elio/.test(etiquettes[0]),
  `chaque onglet porte la part de sa graphie (${etiquettes.map(t => t.replace(/\s+/g, ' ')).join(' · ')})`)
dit(await onglets.first().getAttribute('aria-selected') === 'true', 'le premier onglet (la carte) est ouvert')

const panneau = page.locator('.feuille-corps [role="tabpanel"]')
const nom2 = (await onglets.nth(1).locator('.n').innerText()).trim()
await onglets.nth(1).click()
await page.waitForTimeout(300)
dit((await panneau.locator('h3').innerText()).trim() === nom2
    && await onglets.nth(1).getAttribute('aria-selected') === 'true',
  `toucher un onglet affiche ses chiffres (${nom2})`)
dit(/naissances? en trois ans/.test(await panneau.innerText()), 'le panneau donne les naissances et la part')

await onglets.nth(1).focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(250)
dit(await onglets.nth(2).getAttribute('aria-selected') === 'true'
    && await page.evaluate(() => document.activeElement?.getAttribute('role')) === 'tab',
  'au clavier, les flèches passent d’un onglet à l’autre')

await auditer('feuille des graphies (clair)')
await page.emulateMedia({ colorScheme: 'dark' })
await auditer('feuille des graphies (sombre)')
await page.emulateMedia({ colorScheme: 'light' })

const nom3 = (await onglets.nth(2).locator('.n').innerText()).trim()
await page.getByRole('button', { name: `Toute la fiche de ${nom3}` }).click()
await page.waitForSelector('.voile .feuille', { timeout: 8000 })
await page.waitForTimeout(450)
dit((await page.locator('.voile .feuille .nom').first().innerText()).trim() === nom3,
  `« Toute la fiche » ouvre celle de ${nom3}`)
await page.getByRole('button', { name: 'Fermer la fiche' }).click()
await page.waitForTimeout(500)
dit((await devant().locator('.nom').innerText()).trim() === 'Elio', 'la carte d’Elio attend toujours')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
