/**
 * La langue : un navigateur en anglais voit l'app en anglais, sans un mot de
 * français (hors prénoms et significations) ; le choix dans le compte
 * l'emporte et revient après rechargement.
 *
 *   sh essais/relance.sh essais/essai-langue.mjs
 */
import { lancer, aller, entrerComme, BASE } from './navigateur.mjs'

const CAPS = process.env.ESSAI_CAPS || ''
const MOTS_FR = /\b(vous|votre|vos|les|des|une|pour|avec|dans|sur|pas|plus|liste|prénoms?|accords?|réglages|connexion|créer|rejoindre|ajouter|choisir|fermer|retour)\b/i
let fautes = 0
const ok = (c, m) => { console.log(`${c ? 'OK ' : 'NON'} ${m}`); if (!c) fautes++ }

async function francais(page, ou) {
  // Sans le bloc des outils de développement (section.dev), absent en production.
  const txt = await page.evaluate(() => {
    const b = document.body.cloneNode(true)
    b.querySelectorAll('section.dev').forEach(x => x.remove())
    document.documentElement.appendChild(b); const t = b.innerText; b.remove(); return t
  })
  // « Notre liste » : le nom de la liste du jeu d'essai, une donnée.
  const lignes = txt.split('\n').map(l => l.trim().replace(/Notre liste/g, '')).filter(l => l && MOTS_FR.test(l))
  ok(lignes.length === 0, `${ou} : aucun texte français${lignes.length ? ' — ' + lignes.slice(0, 8).join(' | ') : ''}`)
}
async function capture(page, nom) { if (CAPS) await page.screenshot({ path: `${CAPS}/${nom}.png` }) }

const nav = await lancer()
const ctx = await nav.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style'); s.textContent = '#nuxt-devtools-container{display:none!important}'; document.head?.appendChild(s) }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
const erreurs = []
page.on('console', m => { if (/texte introuvable/.test(m.text())) erreurs.push(m.text()) })

await aller(page, `${BASE}/connexion`)
await page.waitForTimeout(800)
ok(await page.evaluate(() => document.documentElement.lang) === 'en', 'html lang = en')
await capture(page, 'en-01-connexion')
await francais(page, 'connexion')

await entrerComme(page, 'Paul')
await page.waitForURL(u => !u.pathname.startsWith('/connexion'), { timeout: 15000 })
await page.waitForTimeout(1500)
await capture(page, 'en-02-accueil')
await francais(page, 'accueil')

// Le compte, et son choix de langue.
await page.getByRole('button', { name: /Paul/ }).first().click()
await page.waitForTimeout(900)
await page.locator('#compte-langue').scrollIntoViewIfNeeded()
await capture(page, 'en-06-compte')
await francais(page, 'compte')
ok(await page.locator('select option[value=auto]').count() === 1, 'compte : choix « Automatique »')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// Les écrans d'une liste
for (const [chemin, nom] of [['swipe', 'en-03-swipe'], ['classement', 'en-04-classement'], ['reglages', 'en-05-reglages']]) {
  const id = await page.evaluate(() => (location.pathname.match(/\/g\/(\d+)/) || [])[1])
    ?? await page.evaluate(async () => (await (await fetch('/api/groupes')).json())?.[0]?.id ?? (await (await fetch('/api/groupes')).json())?.groupes?.[0]?.id)
  await aller(page, `${BASE}/g/${id}/${chemin}`)
  await page.waitForTimeout(1500)
  await capture(page, nom)
  await francais(page, chemin)
}

// Choisir le français dans le compte : il l'emporte, et revient au rechargement.
await page.evaluate(async () => { await fetch('/api/moi/langue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choix: 'fr', langue: 'fr' }) }) })
await page.evaluate(() => localStorage.setItem('pr_langue', 'fr'))
await aller(page, `${BASE}/`)
await page.waitForTimeout(1200)
ok(await page.evaluate(() => document.documentElement.lang) === 'fr', 'choix français : html lang = fr')
ok(/Créer|liste/i.test(await page.evaluate(() => document.body.innerText)), 'choix français : textes en français')
await capture(page, 'fr-02-accueil')

// Un autre appareil du même compte, en anglais : le choix du compte suit.
const ctx2 = await nav.newContext({ locale: 'en-US', storageState: await ctx.storageState() })
const p2 = await ctx2.newPage()
await p2.evaluate(() => {}).catch(() => {})
await aller(p2, `${BASE}/`)
await p2.evaluate(() => localStorage.removeItem('pr_langue'))
await aller(p2, `${BASE}/`)
await p2.waitForTimeout(1500)
ok(await p2.evaluate(() => document.documentElement.lang) === 'fr', 'autre appareil : le choix du compte suit (fr)')

// Retour en automatique ; une langue non prise en charge donne l'anglais.
await p2.evaluate(async () => { await fetch('/api/moi/langue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choix: null, langue: 'en' }) }); localStorage.removeItem('pr_langue') })
const ctx3 = await nav.newContext({ locale: 'es-ES', storageState: await ctx2.storageState() })
const p3 = await ctx3.newPage()
await aller(p3, `${BASE}/`)
await p3.waitForTimeout(1500)
ok(await p3.evaluate(() => document.documentElement.lang) === 'en', 'espagnol : anglais par défaut')

ok(erreurs.length === 0, `aucun texte introuvable${erreurs.length ? ' — ' + [...new Set(erreurs)].slice(0, 10).join(' | ') : ''}`)
await nav.close()
console.log(fautes ? `${fautes} échec(s)` : 'tout est bon')
process.exit(fautes ? 1 : 0)
