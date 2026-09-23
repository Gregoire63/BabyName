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
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })

// ---------- la liste gratuite, quota 3/jour et 8/mois --------------------
await page.locator('.carte.large.passee', { hasText: 'Essai gratuit' }).click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(500)

const ligne = async () => (await page.locator('.contexte, .tete-liste, header').first()
  .innerText().catch(() => '')).replace(/\s+/g, ' ')
const texte = async () => (await page.locator('.zone, .vide').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
const gid = page.url().split('/')[4]

const avant = await page.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)
dit(avant.quota && avant.quota.paye === false && avant.quota.limite_jour === 3,
    `l’état du groupe porte le quota : ${JSON.stringify(avant.quota)}`)

let swipes = 0, bloque = false
for (let i = 0; i < 6; i++) {
  const bouton = page.getByRole('button', { name: 'Oui' })
  if (!await bouton.count()) { bloque = true; break }
  await bouton.first().click()
  swipes++
  await page.waitForTimeout(800)
}
const ecran = await texte()
dit(swipes === 3, `le mur tombe après ${swipes} swipes (quota 3/jour)`)
dit(/aujourd/i.test(ecran), `l’écran dit pourquoi : « ${ecran.slice(0, 90)} »`)
dit(/débloquer la liste|tout le monde dedans/i.test(ecran),
    'l’écran dit que débloquer profite aux deux')

// ---------- créer une autre liste ne rend pas des swipes ----------------
// Le quota est celui de la PERSONNE : trois swipes dans « Essai gratuit »
// doivent aussi avoir vidé « Autre essai ».
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('.carte.large.passee', { hasText: 'Autre essai' }).first().click()
await page.waitForTimeout(2500)
const gid2 = page.url().split('/')[4]
const autre = await page.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid2)
dit(autre.quota?.fait_jour === 3 && autre.quota?.reste === 0,
    `une autre liste gratuite part déjà à zéro : ${JSON.stringify(autre.quota)}`)
const force2 = await page.evaluate(async (g) => {
  const r = await fetch(`/api/groupes/${g}/vote`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prenom: 'Jade', valeur: 2 })
  })
  return r.status
}, gid2)
dit(force2 === 402, `et le serveur y refuse aussi le vote : HTTP ${force2}`)
await page.goto(`${BASE}/g/${gid}/swipe`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// ---------- le serveur refuse, pas seulement l'écran --------------------
const forcee = await page.evaluate(async (g) => {
  const r = await fetch(`/api/groupes/${g}/vote`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prenom: 'Zoé', valeur: 2 })
  })
  return { statut: r.status, corps: await r.text() }
}, gid)
dit(forcee.statut === 402, `un vote forcé hors de l’écran est refusé : HTTP ${forcee.statut}`)
dit(/quota_atteint/.test(forcee.corps), 'le refus porte le motif quota_atteint')

// ---------- vider le cache ne rend pas les swipes -----------------------
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const apresVidage = await texte()
dit(/aujourd/i.test(apresVidage),
    'vider le localStorage ne rend pas les swipes — le compteur est en base')

// ---------- la liste payée, elle, n'est pas bloquée ---------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
// « Essai gratuit » est devenue la liste en cours : la grande carte, c'est
// elle. On ouvre explicitement la liste payee.
const payee = page.locator('.carte.large.passee', { hasText: 'Notre liste' })
if (await payee.count()) await payee.first().click()
else await page.locator('.bento .grande').first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(600)
const q2 = await page.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()),
  page.url().split('/')[4])
dit(q2.quota?.paye === true, 'la liste payée est illimitée côté serveur')
let n = 0
for (let i = 0; i < 5; i++) {
  const b = page.getByRole('button', { name: 'Oui' })
  if (!await b.count()) break
  await b.first().click(); n++; await page.waitForTimeout(700)
}
dit(n === 5, `5 swipes d’affilée passent sur la liste payée (${n})`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
