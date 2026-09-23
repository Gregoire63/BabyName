import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const cacher = () => {
    const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s)
  }
  if (document.head) cacher(); else document.addEventListener('DOMContentLoaded', cacher)
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|favicon|fonts|preload/.test(m.text())) { erreurs.push(m.text()); console.log('   [js]', m.text()) } })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.onglets button', { timeout: 20000 })
await page.locator('.onglets button', { hasText: 'Swipe' }).click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })

const devant = () => page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()
const derriere = () => page.locator('.carte.fiche.derriere .nom').first().innerText()

// Le 3e « oui » est le moment critique : ordonner() bascule du tri par
// frequence au tri par affinite, donc TOUTE la pile change d'ordre.
const votes = [2, 2, 2, 2, 0, 2, 1, 2, 2]
const trahisons = []
const arriere = []   // la carte du fond a-t-elle clignote entre deux noms ?
for (let i = 0; i < votes.length; i++) {
  const avantD = (await devant()).trim()
  const promis = (await derriere()).trim()
  const v = votes[i]
  await page.getByRole('button', { name: v === 2 ? 'Oui' : v === 0 ? 'Non' : 'Neutre' }).click()
  await page.waitForFunction(n => {
    const e = document.querySelector('.carte.fiche:not(.derriere) .nom')
    return e && e.textContent.trim() !== n
  }, avantD, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(250)
  const tenu = (await devant()).trim()
  arriere.push(`${promis}→${tenu}`)
  if (tenu !== promis) trahisons.push(`vote ${i + 1} (${v === 2 ? 'oui' : v === 0 ? 'non' : 'neutre'}) : promis ${promis}, recu ${tenu}`)
}
console.log('   [suite]', arriere.join('  '))
dit(trahisons.length === 0,
    trahisons.length === 0
      ? `la carte du fond est toujours celle qui arrive (${votes.length} votes, dont ${votes.filter(v => v === 2).length} oui)`
      : `${trahisons.length} promesses non tenues :\n     ` + trahisons.join('\n     '))

// Le compteur « possibles » doit rester coherent : la tete figee ne doit pas
// dupliquer ni perdre de prenom.
const ligne = await page.locator('.contexte, .sous-titre, header').first().innerText().catch(() => '')
console.log('   [ligne]', ligne.replace(/\n/g, ' · '))

// Un changement de filtre doit, lui, reprendre la main sur la tete.
await page.locator('button', { hasText: 'Filtres' }).first().click()
await page.waitForSelector('text=Sexe', { timeout: 10000 })
const avantFiltre = (await devant()).trim()
// On ne garde QUE le sexe oppose a la carte en tete : la tete figee doit
// lacher prise, sinon le verrou aurait rendu les filtres inoperants.
const sexeTete = await page.evaluate(async n => {
  const r = await fetch('/data/catalogue.json.gz')
  const b = new Uint8Array(await r.arrayBuffer())
  const gz = b[0] === 0x1f && b[1] === 0x8b
  const t = gz ? await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
               : new TextDecoder().decode(b)
  const d = JSON.parse(t); const i = d.cols.l.indexOf(n)
  return i >= 0 ? d.sexe[d.cols.s[i]] : null
}, avantFiltre)
const garder = sexeTete === 'f' ? 'garçon' : 'fille'
for (const j of ['fille', 'garçon', 'mixte']) {
  if (j !== garder) await page.locator('.jeton', { hasText: j }).first().click()
}
await page.locator('button.btn-1', { hasText: 'prénoms — voir' }).click()
await page.waitForTimeout(700)
const apresFiltre = (await devant()).trim()
dit(apresFiltre !== avantFiltre,
    `le filtre reprend la main sur la tête figée : ${avantFiltre} (${sexeTete}) → ${apresFiltre} (${garder} seulement)`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
