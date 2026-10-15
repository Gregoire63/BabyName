/**
 * Le sens d'un prénom : UN seul, dans la langue de l'app.
 *
 * Le catalogue en a deux : `m`, en français, relu (traduit en anglais par
 * public/data/sens/en.json), et `me`, une glose du Wiktionnaire anglais. Les
 * deux s'affichaient : sous Gabriel, « force de Dieu » puis « strong man »,
 * dans l'app en français. Ce qui se vérifie ici, sur la carte du tri comme
 * dans la fiche :
 *  - en français : Gabriel, « force de Dieu » et rien d'autre ;
 *  - un prénom qui n'a que la glose anglaise (Mya, « mussel ») : pas un mot
 *    d'anglais, et la fiche dit qu'il n'a pas d'étymologie fiable ;
 *  - en anglais : Gabriel une fois, traduit (pas deux sens) ; Mya, la glose,
 *    marquée « English source » ; et sur la carte d'un prénom d'ailleurs,
 *    les pays où on le donne, nommés en anglais.
 *
 *   sh essais/relance.sh essais/essai-sens.mjs
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []
const { page } = await onglet(nav)
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
const liste = (await page.evaluate(() => fetch('/api/groupes').then(r => r.json()))).find(l => l.nom === 'Notre liste')

const devant = () => page.locator('.carte.fiche:not(.derriere)')
/** Le prénom en première carte, par la loupe. */
async function enPremiere(nom) {
  await page.getByRole('button', { name: /^(Chercher un prénom|Search for a name)$/ }).click()
  await page.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
  await page.waitForTimeout(450)
  await page.locator('input.chercher').fill(nom.toLowerCase())
  await page.waitForTimeout(400)
  await page.locator('.trouve').filter({ has: page.locator(`.nom:text-is("${nom}")`) }).first().click()
  await page.waitForFunction(n => document.querySelector('.carte.fiche:not(.derriere) .nom')?.textContent.trim() === n, nom, { timeout: 8000 })
  await page.waitForTimeout(500)
}
/** Ce que disent du prénom sa carte et sa fiche. */
async function lire(nom) {
  await enPremiere(nom)
  const carte = await devant().locator('.sens').allInnerTexts()
  await devant().getByRole('button', { name: new RegExp(`^(Infos sur|About) ${nom}$`) }).click()
  await page.locator('.feuille .sens, .feuille .note').first().waitFor({ timeout: 8000 })
  await page.waitForTimeout(600)
  const fiche = await page.locator('.feuille .sens').allInnerTexts()
  const notes = await page.locator('.feuille .note').allInnerTexts()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  return { carte: carte.map(s => s.trim()), fiche: fiche.map(s => s.trim()), notes: notes.map(s => s.trim()) }
}
const ANGLAIS = /strong man|mussel|\(source anglaise\)|English source/

/** La langue du compte (et de cet appareil), comme la règle le sélecteur de « Mon compte ». */
const parler = langue => page.evaluate(async l => {
  await fetch('/api/moi/langue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choix: l, langue: l }) })
  localStorage.setItem('pr_langue', l)
}, langue)

// ------------------------------------------------------------ en français
await parler('fr')
await page.goto(`${BASE}/g/${liste.id}/swipe`, { waitUntil: 'networkidle' })
await devant().locator('.nom').waitFor({ timeout: 30000 })
const gabriel = await lire('Gabriel')
dit(gabriel.carte.join(' | ') === '« force de Dieu »' && gabriel.fiche.join(' | ') === '« force de Dieu »',
  `Gabriel, en français : « force de Dieu », seul, sur la carte et dans la fiche (${[...gabriel.carte, ...gabriel.fiche].join(' | ')})`)
const mya = await lire('Mya')
dit(mya.carte.length === 0 && mya.fiche.length === 0 && ![...mya.notes].some(n => ANGLAIS.test(n)),
  `Mya n’a qu’une glose anglaise (« mussel ») : en français, aucun sens affiché (${[...mya.carte, ...mya.fiche].join(' | ') || 'rien'})`)
dit(mya.notes.some(n => /Aucune étymologie fiable/.test(n)), 'et sa fiche dit qu’elle n’a pas d’étymologie fiable')
dit(!ANGLAIS.test(JSON.stringify([gabriel, mya])), 'pas un mot d’anglais')

// ------------------------------------------------------------- en anglais
await parler('en')
await page.goto(`${BASE}/g/${liste.id}/swipe`, { waitUntil: 'networkidle' })
await devant().locator('.nom').waitFor({ timeout: 30000 })
const traduit = await page.evaluate(() => fetch('/data/sens/en.json').then(r => r.json()).then(t => t['force de Dieu']))
const gabrielEn = await lire('Gabriel')
dit(!!traduit && gabrielEn.carte.join(' | ') === `“${traduit}”` && gabrielEn.fiche.join(' | ') === `“${traduit}”`,
  `Gabriel, en anglais : un sens, traduit (“${traduit}”), pas deux (${[...gabrielEn.carte, ...gabrielEn.fiche].join(' | ')})`)
const myaEn = await lire('Mya')
dit(myaEn.carte.join(' | ') === '“mussel”' && myaEn.fiche.length === 1 && myaEn.fiche[0] === '“mussel” (English source)',
  `Mya, en anglais : la glose, marquée comme venant d’une autre source (${[...myaEn.carte, ...myaEn.fiche].join(' | ')})`)
// Les pays de « Là où on le donne » (un prénom d'ailleurs) : nommés dans la
// langue de l'app aussi — ils restaient en français (« Belgique »).
await enPremiere('Lotte')
const ouEn = (await devant().locator('.ou .pays').allInnerTexts()).map(s => s.trim())
dit(ouEn.length >= 1 && ouEn.every(n => /^[A-Za-z ]+$/.test(n)) && ouEn.includes('Belgium') && !ouEn.includes('Belgique'),
  `Lotte, en anglais : « Là où on le donne » nomme les pays en anglais (${ouEn.join(', ')})`)

await parler('fr')
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
