import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer } from './navigateur.mjs'
// axe-core, s'il est la (ESSAI_AXE ou node_modules) : l'ecran de l'accord est
// un dialogue que l'essai d'accessibilite n'ouvre pas.
const AXE = (() => {
  try { return readFileSync(process.env.ESSAI_AXE || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8') }
  catch { return null }
})()
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
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 45000 })
await page.waitForTimeout(600)

// Mettre un prénom précis en première carte, par la loupe : la semence dit
// qui a voté quoi, on n'a pas à swiper au hasard en espérant tomber dessus.
async function pileSur(nom) {
  await page.getByRole('button', { name: 'Chercher un prénom' }).click()
  await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
  await page.locator('input.chercher').fill(nom)
  await page.waitForTimeout(400)
  await page.locator('.trouve').filter({ has: page.locator(`.nom:text-is("${nom}")`) }).click()
  await page.waitForTimeout(800)
}

// ---------- 1. aucun refus n'est jamais annoncé -------------------------
// Audrey a dit NON a Marius dans la semence. L'ancien bandeau annoncait
// « Audrey : non » juste apres le oui de Greg.
await pileSur('Ferdinand')
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
await pileSur('Adèle')
await page.getByRole('button', { name: 'Oui' }).first().click()
await page.waitForSelector('.fete', { timeout: 12000 })
const fete = (await page.locator('.fete').innerText()).replace(/\s+/g, ' ')
console.log('   [match]', fete.slice(0, 90))
dit(/Adèle/.test(fete), 'le match se déclenche sur un prénom que les deux ont aimé')
const vib = await page.evaluate(() => window.__vibrations)
dit(vib.length > 0, `le match fait vibrer le téléphone (${JSON.stringify(vib[0])})`)
dit(await page.locator('.fete .actions .btn').count() === 2,
    'il propose deux suites : continuer à trier, ou voir les accords')
// La suite payante, au moment où l'envie est la plus forte. « Notre liste »
// est débloquée et n'a pas encore de nom de famille.
const plus = (await page.locator('.fete .plus').innerText().catch(() => '')).replace(/\s+/g, ' ')
dit(/Essayer Adèle avec votre nom de famille/.test(plus),
    `liste débloquée sans nom de famille : l’accord propose de l’essayer (« ${plus.slice(0, 60)} »)`)
const nSep = Number(plus.match(/(\d+) prénoms? vous s[ée]par/)?.[1] ?? 0)
dit(nSep >= 2, `et dit combien de prénoms séparent encore le couple (${nSep})`)
dit(!/liste débloquée/.test(plus), 'sans étiquette « liste débloquée » : elle l’est déjà')
if (AXE) {
  await page.waitForTimeout(700)
  await page.evaluate(AXE)
  const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('.fete'),
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(x => x.id))
  dit(v.length === 0, `l’écran de l’accord : aucune violation WCAG A/AA${v.length ? ` (${v.join(', ')})` : ''}`)
}
await page.waitForTimeout(3800)
dit(await page.locator('.fete').count() === 1,
    'il ne s’efface pas tout seul au bout de 3 s comme une notification')
await page.locator('.fete .btn', { hasText: 'Voir nos accords' }).click()
await page.waitForTimeout(1000)
dit(await page.locator('.fete').count() === 0 && await page.locator('.volets, .onglets').count() > 0,
    '« Voir nos accords » ferme la fête et emmène au classement')

// ---------- 2 bis. la suite de l'accord mène là où elle promet -------------
// Audrey dit oui à trois prénoms que Greg n'a pas encore jugés : autant
// d'accords à venir. Elle vote depuis son propre navigateur.
const ctxA = await nav.newContext({ viewport: { width: 390, height: 844 } })
const pageA = await ctxA.newPage()
await pageA.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await pageA.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await pageA.locator('input.champ').fill('DEVA-DREY-2345')
await pageA.getByRole('button', { name: 'Entrer' }).click()
await pageA.waitForSelector('.bento', { timeout: 20000 })
for (const p of ['Capucine', 'Apolline', 'Clémence']) {
  await pageA.evaluate(async (p) => fetch('/api/groupes/1/vote', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prenom: p, valeur: 2 }) }), p)
}
await ctxA.close()
const ongletTri = async () => {
  await page.locator('.onglets button', { hasText: 'Swipe' }).click()
  await page.waitForTimeout(700)
}
const accordSur = async (nom) => {
  await ongletTri()
  await pileSur(nom)
  await page.getByRole('button', { name: 'Oui' }).first().click()
  await page.waitForSelector('.fete', { timeout: 12000 })
  await page.waitForTimeout(700)
}

await accordSur('Margot')
await page.locator('.fete .offre', { hasText: 'voir pourquoi' }).click()
await page.waitForTimeout(1200)
dit(await page.locator('.fete').count() === 0
    && await page.locator('#onglet-revoir[aria-selected="true"]').count() === 1,
    '« voir pourquoi » ferme la fête et ouvre À revoir, où le pourquoi est écrit')

await accordSur('Gaspard')
await page.locator('.fete .offre', { hasText: 'avec votre nom de famille' }).click()
await page.waitForTimeout(1400)
const focusNom = await page.evaluate(() => document.activeElement?.id)
dit(focusNom === 'champ-nom-famille', `« essayer avec votre nom » mène au champ du nom, prêt à écrire (${focusNom})`)
await page.locator('#champ-nom-famille').fill('Raturat')
await page.locator('#champ-nom-famille').press('Enter')
await page.waitForTimeout(1200)

await accordSur('Capucine')
const essaiNom = (await page.locator('.fete .essai-nom').innerText().catch(() => '')).replace(/\s+/g, ' ')
dit(/Capucine Raturat/.test(essaiNom),
    `avec le nom enregistré, l’accord donne tout de suite le prénom en entier (« ${essaiNom.slice(0, 70)} »)`)
await page.locator('.fete .btn', { hasText: 'Continuer à trier' }).click()
await page.waitForTimeout(600)

// ---------- 3. inviter une 3e personne est expliqué ---------------------
await page.locator('.onglets button', { hasText: 'La liste' }).click()
await page.waitForSelector('text=Qui en est', { timeout: 10000 })
const avert = await page.locator('.avert').first().innerText().catch(() => '')
dit(/tout le monde/i.test(avert) && /personne/i.test(avert),
    `la règle est dite avant d’inviter : « ${avert.replace(/\s+/g, ' ').slice(0, 100)} »`)
dit(/bloquer/i.test(avert), 'et le pouvoir de bloquer chaque prénom est nommé')
dit(/accord/i.test(avert), 'et le nombre d’accords mis en attente est chiffré')

// ---------- 4. sur une liste gratuite, l'accord montre ce que l'achat ouvre --
// (outil de développement : la liste redevient gratuite, sans Stripe)
await page.evaluate(async () => fetch('/api/dev/base', { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'rebloquer', groupe: 1 }) }))
await page.reload({ waitUntil: 'networkidle' })
// On était sur « La liste » : la page s'y rouvre. accordSur repasse au tri.
await page.waitForSelector('.onglets', { timeout: 25000 })
await accordSur('Apolline')
const plusG = (await page.locator('.fete .plus').innerText().catch(() => '')).replace(/\s+/g, ' ')
dit(/Apolline avec votre nom de famille : comment ça sonne \?/.test(plusG),
    'liste gratuite : l’accord propose d’entendre le prénom avec le nom de famille')
dit((plusG.match(/liste débloquée/g) ?? []).length === 2,
    'et chaque proposition dit qu’elle vient avec la liste débloquée — rien n’est caché')
await page.locator('.fete .offre', { hasText: 'voir pourquoi' }).click()
await page.waitForTimeout(1200)
dit(await page.locator('.fete').count() === 0
    && await page.getByRole('heading', { name: 'Débloquer cette liste' }).count() >= 1,
    '« voir pourquoi » ouvre alors la feuille « Débloquer », qui le décrit')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
