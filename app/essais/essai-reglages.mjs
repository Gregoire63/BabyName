/**
 * Les réglages : la carte « Débloquer cette liste » (réglages de la liste),
 * et le thème (« Mon compte », sur l'accueil : ce n'est pas un réglage de liste).
 *
 *  - liste gratuite : la carte dit le prix et sa PORTÉE — cette liste
 *    seulement, pour tous ses membres, pas toute l'application ;
 *  - liste débloquée : la carte le dit, et que les autres restent gratuites ;
 *  - thème Clair / Système / Sombre : appliqué tout de suite, retenu, posé
 *    AVANT le démarrage de l'app au rechargement (pas de flash), gardé à la
 *    déconnexion (c'est un réglage de l'appareil) ;
 *  - aucune violation WCAG A/AA en sombre forcé, sur « Mon compte » comme sur
 *    les réglages d'une liste.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const nav = await lancer()
const { ctx, page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
// Le thème tel qu'il est quand l'analyse du HTML se termine : seul le petit
// script de <head> a tourné, pas encore l'app.
await ctx.addInitScript(() => {
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive') window.__themeAvantApp = document.documentElement.dataset.theme ?? null
  })
})

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })

const listes = await page.evaluate(() => fetch('/api/groupes').then(r => r.json()))
const payee = listes.find(l => l.nom === 'Notre liste')
const gratuite = listes.find(l => l.nom === 'Essai gratuit')

async function reglages(gid) {
  await page.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.achat', { timeout: 20000 })
  await page.waitForTimeout(500)
}

// ---------- 1. la carte d'achat -------------------------------------------
await reglages(gratuite.id)
const carte = (await page.locator('.achat').innerText()).replace(/\s+/g, ' ')
dit(/Débloquer cette liste/.test(carte) && /6\s?€/.test(carte), `liste gratuite : la carte d’achat et son prix`)
dit(/débloque cette liste pour la vie/i.test(carte) && /tous ses membres/.test(carte) && !/abonnement/i.test(carte),
  'elle dit la portée en une phrase : cette liste, pour la vie, pour tous ses membres')
await page.locator('.achat').getByRole('button', { name: /Voir le détail/ }).click()
await page.waitForSelector('.feuille-corps', { timeout: 8000 })
await page.waitForTimeout(400)
dit(/chaque liste se débloque à part/.test(await page.locator('.feuille-corps').innerText()),
  'la feuille d’achat le redit')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

await reglages(payee.id)
const carte2 = (await page.locator('.achat').innerText()).replace(/\s+/g, ' ')
dit(/Liste débloquée/.test(carte2) && /tous ses membres/.test(carte2)
    && await page.locator('.achat button', { hasText: /Débloquer|Voir le détail/ }).count() === 0,
  `liste débloquée : la carte le dit, sans rien à acheter (« ${carte2.slice(0, 70)}… »)`)

// ---------- 1 bis. « Qui en est » suit les gestes ----------------------------
// Il restait sur le chiffre du chargement : « 0 jugé » juste après avoir jugé.
const juges = async () => parseInt((await page.locator('section', { hasText: 'Qui en est' })
  .locator('.ligne', { hasText: 'Paul' }).innerText()).replace(/[^\d]/g, ''), 10)
const avantSwipe = await juges()
await page.locator('.onglets button', { hasText: 'Swipe' }).click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Oui' }).first().click()
await page.waitForTimeout(1500)
await page.locator('.onglets button', { hasText: 'La liste' }).click()
await page.waitForTimeout(700)
const apresSwipe = await juges()
dit(apresSwipe === avantSwipe + 1, `un swipe, et « Qui en est » compte un prénom de plus, sans recharger (${avantSwipe} → ${apresSwipe})`)

// ---------- 2. le thème : dans « Mon compte », plus dans les réglages d'une liste
// Ni l'apparence, ni le compte, ni les passkeys ne sont des réglages de CETTE
// liste : on les y prenait pour tels. Ils se règlent sur l'accueil.
dit(await page.getByRole('radio').count() === 0
    && await page.getByRole('heading', { name: /Apparence|Mon compte|Notifications/ }).count() === 0
    && await page.getByRole('button', { name: /passkey|mes données/i }).count() === 0,
  'les réglages d’une liste ne proposent ni thème, ni compte, ni passkey')

const fond = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? null)
const feuille = page.locator('.feuille-corps')
async function compte() {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.bento', { timeout: 20000 })
  await page.getByRole('button', { name: /^Mon compte/ }).click()
  await feuille.waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
}
const violations = () => page.evaluate(async () => (await window.axe.run(document,
  { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }))
  .violations.map(x => `${x.id} (${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')})`))

await compte()
dit(await feuille.getByRole('radio', { name: /Système/ }).isChecked(), 'par défaut : comme le téléphone')
// Les notifications sont celles d'un téléphone, dans l'app des stores : un
// navigateur n'a rien à en régler (essai-coquille les joue dans l'app).
dit(await feuille.getByRole('heading', { name: 'Notifications' }).count() === 0
    && await feuille.getByRole('button', { name: /prévenir/i }).count() === 0,
  'dans un navigateur, « Mon compte » ne parle pas de notifications')

await feuille.getByRole('radio', { name: /Sombre/ }).check()
await page.waitForTimeout(200)
dit(await theme() === 'dark' && await fond() === 'rgb(16, 19, 33)', `« Sombre » : appliqué tout de suite (${await fond()})`)
await page.evaluate(AXE)
let v = await violations()
dit(v.length === 0, `« Mon compte » en sombre forcé : aucune violation WCAG A/AA${v.length ? ` — ${v.join(' ; ')}` : ''}`)

await reglages(payee.id)
await page.evaluate(AXE)
v = await violations()
dit(v.length === 0, `réglages en sombre forcé : aucune violation WCAG A/AA${v.length ? ` — ${v.join(' ; ')}` : ''}`)

await page.reload({ waitUntil: 'networkidle' })
dit(await page.evaluate(() => window.__themeAvantApp) === 'dark',
  'au rechargement, le sombre est posé avant que l’app démarre (pas de flash clair)')
await compte()
dit(await feuille.getByRole('radio', { name: /Sombre/ }).isChecked(), 'et le choix est retenu')

await page.emulateMedia({ colorScheme: 'dark' })
await feuille.getByRole('radio', { name: /Clair/ }).check()
await page.waitForTimeout(200)
dit(await theme() === 'light' && await fond() === 'rgb(251, 250, 249)',
  '« Clair » l’emporte sur un téléphone réglé en sombre')
await feuille.getByRole('radio', { name: /Système/ }).check()
await page.waitForTimeout(200)
dit(await theme() === null && await fond() === 'rgb(16, 19, 33)', '« Système » suit le téléphone (ici, sombre)')
await page.emulateMedia({ colorScheme: 'light' })

// Le choix vit dans l'appareil : la déconnexion ne l'efface pas.
await feuille.getByRole('radio', { name: /Sombre/ }).check()
await page.getByRole('button', { name: 'Se déconnecter' }).click()
await page.waitForURL(/\/connexion/, { timeout: 15000 })
dit(await page.evaluate(() => localStorage.getItem('pr_theme')) === 'sombre' && await theme() === 'dark',
  'à la déconnexion, le reste du stockage est vidé mais le thème reste')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
