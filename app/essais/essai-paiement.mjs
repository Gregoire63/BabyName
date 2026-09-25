/**
 * Ce qui se vend, et ce qui se voit quand on n'a pas paye.
 *
 * Trois choses a prouver ici, et aucune n'est cosmetique :
 *  - l'ecran d'achat dit ce qu'il donne, et ce qu'il ne reprend pas ;
 *  - aucun numero de carte ne passe par l'application ;
 *  - le serveur refuse tout seul les fonctions payantes, meme si l'interface
 *    laissait passer un bouton.
 */
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
const net = []
page.on('request', r => net.push(r.url()))

const plat = async sel => (await page.locator(sel).first().innerText().catch(() => ''))
  .replace(/\s+/g, ' ').trim()

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })

// ======================= LA LISTE GRATUITE ===============================
await page.locator('.carte.large.passee', { hasText: 'Essai gratuit' }).click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(600)
const gidLibre = page.url().split('/')[4]

// --- la feuille d'achat ---------------------------------------------------
// On l'atteint par le mur du quota : c'est le chemin reel.
// 3 de depart puis 2 du jour : au 6e tour le mur remplace la pile pendant
// qu'on compte, et le bouton dont `count()` vient de dire 1 n'existe deja
// plus. On borne donc le clic au lieu d'attendre trente secondes un bouton parti.
for (let i = 0; i < 8; i++) {
  const b = page.getByRole('button', { name: 'Oui' })
  if (!await b.count()) break
  try { await b.first().click({ timeout: 4000 }) } catch { break }
  await page.waitForTimeout(700)
}
const versOffre = page.getByRole('button', { name: /Voir ce que ça ouvre|Débloquer/ })
dit(await versOffre.count() > 0, 'le mur du quota mène à l’offre')
await versOffre.first().click()
await page.waitForTimeout(700)

const feuille = await plat('.feuille-corps')
dit(/6\s?€|€/.test(feuille), `le prix est affiché : « ${feuille.slice(0, 40)} »`)
dit(/une fois|pas d’abonnement/i.test(feuille), 'il est dit que c’est un paiement unique')
dit(/la liste.*se débloque|tout le monde en profite|en profitera aussi/i.test(feuille),
    'il est dit que c’est la LISTE qui se débloque, pas le compte')
dit(/nom de famille/i.test(feuille) && /classe/i.test(feuille)
    && /observateur/i.test(feuille) && /sans limite/i.test(feuille),
    'les cinq fonctions payantes sont nommées')
dit(/reste gratuit/i.test(feuille), 'l’écran dit aussi ce qui reste gratuit')
dit(!/carte bancaire|numéro de carte|cvv|expiration/i.test(feuille),
    'aucun champ de carte bancaire dans l’application')
dit(await page.locator('.feuille-corps input[type="tel"], .feuille-corps input[name*="card"], .feuille-corps input[autocomplete*="cc-"]').count() === 0,
    'et aucun champ de saisie de paiement, même caché')

// --- l'accord avant paiement (art. L221-28 13°) ------------------------------
const payer = page.getByRole('button', { name: /Débloquer pour/ })
dit(await page.locator('.feuille-corps input[type="checkbox"]:checked').count() === 0,
    'la case d’accord n’est jamais pré-cochée')
dit(await payer.isDisabled(), 'sans elle, le bouton de paiement reste inactif')
dit(/accès immédiat/.test(feuille) && /rétractation/.test(feuille) && /L221-28/.test(feuille),
    'elle dit ce qu’on accepte : l’exécution immédiate, donc la fin du droit de rétractation')
dit(/conditions générales de vente/.test(feuille), 'avec un lien vers les conditions de vente')
dit(/TTC/.test(feuille) && /TVA/.test(feuille), 'le prix est annoncé TTC, avec sa mention de TVA')
await page.getByRole('checkbox', { name: /conditions générales de vente/ }).check()
dit(!await payer.isDisabled(), 'case cochée : le paiement peut partir')

// --- le paiement n'est pas configuré ici : on doit le DIRE, pas planter ---
await payer.click()
await page.waitForTimeout(1200)
const apres = await plat('.feuille-corps')
const phrase = (apres.match(/Le paiement n[’']est pas encore ouvert[^.]*\.|Le paiement est momentanément indisponible[^.]*\./i) ?? [''])[0]
dit(!!phrase, `sans clé Stripe, l’écran l’annonce au lieu de planter : « ${phrase} »`)
dit(!net.some(u => /stripe\.com/.test(u)),
    'le navigateur n’a contacté aucun tiers de paiement (la session se crée côté serveur)')

// --- le serveur refuse les fonctions payantes -----------------------------
const refusNom = await page.evaluate(g => fetch(`/api/groupes/${g}/nom-famille`,
  { method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nom: 'Durand' }) }).then(r => r.status), gidLibre)
dit(refusNom === 402, `le nom de famille est refusé sur une liste gratuite : HTTP ${refusNom}`)

const refusObs = await page.evaluate(g => fetch(`/api/groupes/${g}/observateurs`,
  { method: 'POST' }).then(r => r.status), gidLibre)
dit(refusObs === 402, `le lien d’observateur aussi : HTTP ${refusObs}`)

// --- la projection de classe : visible, mais partielle --------------------
await page.goto(`${BASE}/g/${gidLibre}/swipe`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
await page.locator('input.champ.chercher').fill('Elio')
await page.waitForTimeout(700)
// Au mur du quota, toucher un résultat montre sa fiche (il attend son tour).
await page.locator('.trouve').first().click()
await page.waitForTimeout(1100)
const ficheLibre = await plat('.feuille .dedans')
dit(/dans une classe de 25/i.test(ficheLibre), 'la fiche gratuite montre déjà un chiffre de classe')
dit(/palmarès|une seule graphie|année dernière/i.test(ficheLibre),
    'et elle dit en quoi ce chiffre est incomplet, au lieu de le cacher')
dit(/écriront autrement|s'écrit aussi autrement|s’écrit aussi autrement|entend pareil/i.test(ficheLibre),
    'elle nomme précisément ce qui manque : les autres graphies')
dit(/Voir le vrai chiffre/.test(ficheLibre), 'et elle propose de voir le chiffre complet')
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)

// ======================= LA LISTE PAYÉE ==================================
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('.carte.large', { hasText: 'Notre liste' }).first().click()
await page.waitForTimeout(2500)
const gid = page.url().split('/')[4]

const etat = await page.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)
dit(etat.groupe.paye === true, 'la liste de démo est débloquée')
dit(typeof etat.groupe.code_observateur === 'string',
    `et elle porte un code d’observateur : ${etat.groupe.code_observateur}`)

// --- le nom de famille, et l'essai qui en sort ---------------------------
await page.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const bloc = page.locator('.carte', { hasText: 'Avec votre nom de famille' })
dit(await bloc.count() > 0, 'la carte « avec votre nom de famille » est là')
await bloc.locator('input.champ').fill('Arnaud')
await bloc.getByRole('button', { name: /Enregistrer|Fait/ }).click()
await page.waitForTimeout(1800)
dit(await page.locator('.essai').count() === 0,
    'les réglages ne listent plus de verdicts : on n’y saisit que le nom')

const relu = await page.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)
dit(relu.groupe.nom_famille === 'Arnaud', 'le nom est bien enregistré pour la liste, pas pour la personne')

// La réponse est sur chaque carte du tri.
await page.goto(`${BASE}/g/${gid}/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .essai-nom', { timeout: 15000 }).catch(() => {})
const essaiCarte = (await page.locator('.carte.fiche:not(.derriere) .essai-nom').first().innerText().catch(() => ''))
  .replace(/\s+/g, ' ')
const prenomCarte = (await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()).trim()
dit(essaiCarte.includes(`${prenomCarte} Arnaud`) && /[A-Z]\.A\./.test(essaiCarte),
    `la carte montre le prénom avec le nom, et ce qui s’entend : « ${essaiCarte} »`)

// --- la projection complète ----------------------------------------------
await page.goto(`${BASE}/g/${gid}/swipe`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
await page.locator('input.champ.chercher').fill('Louise')
await page.waitForTimeout(600)
await page.locator('.trouve').first().click()
await page.waitForTimeout(900)
await page.locator('.carte.fiche:not(.derriere)').getByRole('button', { name: 'Infos sur Louise' }).click()
await page.waitForTimeout(900)
const fichePayee = await plat('.feuille .dedans')
dit(/dans une classe de 25/i.test(fichePayee), 'la fiche payée porte la projection')
dit(/année de sa naissance/i.test(fichePayee),
    'et elle dit qu’elle est calculée à l’année de naissance')
dit(!/Voir le vrai chiffre/.test(fichePayee), 'plus d’appel à l’achat une fois payé')
await page.keyboard.press('Escape').catch(() => {})

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (erreurs.length) console.log('   [err]', erreurs.slice(0, 3).join(' | '))
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
