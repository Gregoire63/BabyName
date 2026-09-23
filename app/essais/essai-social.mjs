import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s) }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
  // on note les vibrations : un match doit se sentir
  window.__vibrations = []
  navigator.vibrate = (p) => { window.__vibrations.push(p); return true }
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

const entrer = async (cle) => {
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.locator('input.champ').fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
}
await entrer('DEVG-REGX-2345')
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(600)

// Filtrer la pile sur un prénom précis rend l'essai deterministe : la
// semence dit qui a vote quoi, on n'a pas a swiper au hasard en esperant
// tomber dessus.
async function pileSur(motif) {
  await page.locator('button', { hasText: 'Filtres' }).first().click()
  await page.waitForSelector('.feuille-voile input.champ', { timeout: 10000 })
  const champ = page.locator('.feuille-voile input.champ').first()
  await champ.fill(''); await champ.fill(motif)
  await page.waitForTimeout(300)
  await page.locator('button.btn-1', { hasText: 'prénoms — voir' }).click()
  await page.waitForTimeout(700)
}

// ---------- 1. aucun refus n'est jamais annoncé -------------------------
// Audrey a dit NON a Marius dans la semence. L'ancien bandeau annoncait
// « Audrey : non » juste apres le oui de Greg.
await pileSur('ferdinand')
const nom1 = await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText().catch(() => '')
await page.getByRole('button', { name: 'Oui' }).first().click()
await page.waitForTimeout(1600)
const bandeau = await page.locator('.retour').innerText().catch(() => '')
console.log(`   [${nom1.trim()}] bandeau : ${bandeau.replace(/\s+/g, ' ').trim() || '(aucun)'}`)
dit(!/\bnon\b/i.test(bandeau), bandeau
  ? `le bandeau n'annonce pas le refus : « ${bandeau.replace(/\s+/g, ' ').trim()} »`
  : 'aucun bandeau après un oui que l’autre a refusé — le refus ne se dit pas')
dit(bandeau.trim() === '', 'et rien du tout ne s’affiche, pas même un neutre')

// ---------- 2. le match est un moment -----------------------------------
// Audrey a dit OUI a Adele, Greg ne l'a pas encore jugee.
await pileSur('adele')
await page.getByRole('button', { name: 'Oui' }).first().click()
await page.waitForSelector('.fete', { timeout: 12000 })
const fete = (await page.locator('.fete').innerText()).replace(/\s+/g, ' ')
console.log('   [match]', fete.slice(0, 90))
dit(/Adèle/.test(fete), 'le match se déclenche sur un prénom que les deux ont aimé')
const vib = await page.evaluate(() => window.__vibrations)
dit(vib.length > 0, `le match fait vibrer le téléphone (${JSON.stringify(vib[0])})`)
dit(await page.locator('.fete .actions .btn').count() === 2,
    'il propose deux suites : continuer à trier, ou voir les accords')
await page.waitForTimeout(3800)
dit(await page.locator('.fete').count() === 1,
    'il ne s’efface pas tout seul au bout de 3 s comme une notification')
await page.locator('.fete .btn', { hasText: 'Voir nos accords' }).click()
await page.waitForTimeout(1000)
dit(await page.locator('.fete').count() === 0 && await page.locator('.volets, .onglets').count() > 0,
    '« Voir nos accords » ferme la fête et emmène au classement')

// ---------- 3. inviter une 3e personne est expliqué ---------------------
await page.locator('.onglets button', { hasText: 'La liste' }).click()
await page.waitForSelector('text=Qui en est', { timeout: 10000 })
const avert = await page.locator('section.avert').innerText().catch(() => '')
dit(/tout le monde/i.test(avert) && /personne/i.test(avert),
    `la règle est dite avant d’inviter : « ${avert.replace(/\s+/g, ' ').slice(0, 100)} »`)
dit(/veto/i.test(avert), 'et le droit de veto de fait est nommé')
dit(/accord/i.test(avert), 'et le nombre d’accords mis en attente est chiffré')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
