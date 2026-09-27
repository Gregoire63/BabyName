/**
 * Le quota de la version gratuite : un départ large, puis un filet.
 *
 * Ce qui se vérifie ici, avec les petits chiffres de la semence (« Essai
 * gratuit » : 3 de départ par personne, 4 pour la liste, puis 2 par jour) :
 *  - le départ se juge d'une traite, puis le filet du jour, puis le mur —
 *    qui dit que demain ça repart ;
 *  - le quota suit la PERSONNE : une autre liste gratuite ne rend ni départ
 *    ni filet ;
 *  - le serveur refuse, pas seulement l'écran, et vider son cache ne rend
 *    rien ;
 *  - un compte jetable invité dans la liste ne rapporte pas un départ entier
 *    (plafond de liste) ;
 *  - une liste payée ne compte rien.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })

const etat = gid => page.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)
const forcer = (gid, prenom) => page.evaluate(async ([g, p]) => {
  const r = await fetch(`/api/groupes/${g}/vote`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prenom: p, valeur: 2 })
  })
  return { statut: r.status, corps: await r.text() }
}, [gid, prenom])
const texte = async () => (await page.locator('.zone, .vide').first().innerText().catch(() => ''))
  .replace(/\s+/g, ' ')

// ---------- « Essai gratuit » : 3 de départ, puis 2 par jour -------------
await page.locator('.carte.large.passee', { hasText: 'Essai gratuit' }).click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(500)
const gid = page.url().split('/')[4]

const avant = (await etat(gid)).quota
dit(avant?.paye === false && avant?.phase === 'depart' && avant?.depart?.limite === 3
    && avant?.limite_jour === 2 && avant?.reste === 5,
    `au départ : 3 de départ + 2 du jour = 5 (${JSON.stringify(avant)})`)

let swipes = 0, phases = []
for (let i = 0; i < 9; i++) {
  const bouton = page.getByRole('button', { name: 'Oui' })
  if (!await bouton.count()) break
  await bouton.first().click()
  swipes++
  await page.waitForTimeout(800)
  phases.push((await etat(gid)).quota?.phase)
}
dit(swipes === 5, `le mur tombe après ${swipes} swipes (3 de départ, 2 du jour)`)
dit(phases[1] === 'depart' && phases[2] === 'jour',
    `le départ s’épuise d’abord, le filet prend le relais (${phases.join(' → ')})`)
const ecran = await texte()
dit(/aujourd/i.test(ecran) && /départ/i.test(ecran),
    `l’écran dit pourquoi : « ${ecran.slice(0, 110)} »`)
dit(/demain/i.test(ecran) && /jamais/i.test(ecran), 'et que ça repart demain : pas d’impasse')
dit(/tous ses membres/i.test(ecran), 'et que débloquer profite à tous les membres')

// ---------- une autre liste gratuite ne rend rien ------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('.carte.large.passee', { hasText: 'Autre essai' }).first().click()
await page.waitForTimeout(2500)
const gid2 = page.url().split('/')[4]
const autre = (await etat(gid2)).quota
dit(autre?.depart?.reste === 0 && autre?.reste_jour === 0 && autre?.reste === 0,
    `une autre liste gratuite ne rend ni départ ni filet : ${JSON.stringify(autre)}`)
dit((await forcer(gid2, 'Jade')).statut === 402, 'et le serveur y refuse le vote (402)')

// ---------- le serveur refuse, pas seulement l'écran ----------------------
const forcee = await forcer(gid, 'Zoé')
dit(forcee.statut === 402 && /quota_atteint/.test(forcee.corps),
    `un vote forcé hors de l’écran est refusé : HTTP ${forcee.statut}, quota_atteint`)

// ---------- vider le cache ne rend rien -----------------------------------
await page.goto(`${BASE}/g/${gid}/swipe`, { waitUntil: 'networkidle' })
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
dit(/aujourd/i.test(await texte()), 'vider le localStorage ne rend rien — les compteurs sont en base')

// ---------- un compte jetable ne rapporte pas un départ entier -----------
// Le départ de la LISTE est de 4 et Greg en a pris 3 : le nouveau venu n'en
// trouve qu'un, puis passe au filet (2) — 3 votes, pas 3 + 2.
const { page: p2 } = await onglet(nav)
await p2.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const statuts = await p2.evaluate(async () => {
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(b) })
  await post('/api/auth/entrer', { pseudo: 'Jetable' })
  const g = await (await post('/api/groupes/rejoindre', { code: 'dec0de01' })).json()
  const s = []
  for (const p of ['Iris', 'Jeanne', 'Adèle', 'Margot', 'Rose']) {
    s.push((await post(`/api/groupes/${g.id}/vote`, { prenom: p, valeur: 2 })).status)
  }
  const q = (await (await fetch(`/api/groupes/${g.id}`)).json()).quota
  return { s, q }
})
dit(JSON.stringify(statuts.s) === '[200,200,200,402,402]',
    `nouveau membre : 1 de départ (reste de la liste) + 2 du jour, puis 402 (${statuts.s.join(', ')})`)
dit(statuts.q?.depart?.fait === 1 && statuts.q?.depart?.liste_fait === 4,
    'son départ personnel est presque intact, mais celui de la liste est épuisé')

// ---------- la liste payée ne compte rien ---------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
const payee = page.locator('.carte.large.passee', { hasText: 'Notre liste' })
if (await payee.count()) await payee.first().click()
else await page.locator('.bento .grande').first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(600)
const gidP = page.url().split('/')[4]
dit((await etat(gidP)).quota?.phase === 'illimite', 'la liste payée est illimitée côté serveur')
let n = 0
for (let i = 0; i < 5; i++) {
  const b = page.getByRole('button', { name: 'Oui' })
  if (!await b.count()) break
  await b.first().click(); n++; await page.waitForTimeout(700)
}
dit(n === 5, `5 swipes d’affilée passent sur la liste payée (${n})`)
const apresPayee = (await etat(gid)).quota
dit(apresPayee?.depart?.fait === 3 && apresPayee?.fait_jour === 2,
    'et ils ne mangent ni le départ ni le filet des listes gratuites')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
