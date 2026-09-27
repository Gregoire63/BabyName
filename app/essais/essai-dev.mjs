/**
 * Les outils de la base locale (développement seulement).
 *
 * Ce qui se vérifie ici :
 *  - la connexion propose d'entrer d'un geste avec un compte du jeu d'essai ;
 *  - « Mon compte » montre l'âge du jeu d'essai, les listes et les clés ;
 *  - « Nouvelle journée » rend le filet du jour, « Quotas à zéro » le départ ;
 *  - « Débloquer » / « Rebloquer » passent une liste en payée et retour, sans
 *    Stripe — et la feuille d'achat a son raccourci ;
 *  - « Base neuve » vide et ressème, sans arrêter le serveur, et renvoie à la
 *    connexion (l'ancienne session désigne un compte qui n'existe plus) ;
 *  - une action inconnue est refusée.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

const api = (u, corps) => page.evaluate(async ([u, corps]) => {
  const r = await fetch(u, corps === undefined ? {} : { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) })
  let json = null; try { json = await r.json() } catch { /* vide */ }
  return { statut: r.status, json }
}, [u, corps])
const quota = async gid => (await api(`/api/groupes/${gid}`)).json?.quota

// =================== 1. ENTRER D'UN GESTE ================================
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const bloc = page.locator('section.dev', { hasText: 'Base locale' })
await bloc.waitFor({ timeout: 10000 }).catch(() => null)
dit(await bloc.count() === 1, 'la connexion propose les comptes du jeu d’essai')
await bloc.getByRole('button', { name: 'Paul' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
dit((await page.locator('.qui').innerText()).includes('Paul'), 'un geste, et on est Paul')

// =================== 2. L'ETAT DE LA BASE ================================
await page.getByRole('button', { name: /Mon compte/ }).click()
const outils = page.locator('.outils-dev')
await outils.waitFor({ timeout: 8000 })
await page.waitForTimeout(600)
const texte = (await outils.innerText()).replace(/\s+/g, ' ')
dit(/Jeu d’essai v\d+, semé le/.test(texte) && !/Périmé/.test(texte),
  `l’âge du jeu d’essai est affiché (« ${texte.match(/Jeu d’essai[^.]*/)?.[0]} »)`)
dit(/Notre liste/.test(texte) && /Essai gratuit/.test(texte), 'les listes y sont')
dit(/DEVP-ARNA-2345/.test(texte), 'et les clés')

// =================== 3. LES QUOTAS =======================================
await page.evaluate(async () => {
  for (const p of ['Iris', 'Jeanne', 'Adèle', 'Margot', 'Rose', 'Zoé']) {
    const r = await fetch('/api/groupes/2/vote', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prenom: p, valeur: 2 }) })
    if (r.status === 402) break
  }
})
const q0 = await quota(2)
dit(q0?.reste === 0, `« Essai gratuit » est au bout de son quota (${JSON.stringify({ reste: q0?.reste })})`)
await outils.getByRole('button', { name: 'Nouvelle journée' }).click()
await page.waitForTimeout(800)
const q1 = await quota(2)
dit(q1?.reste_jour === 2 && q1?.depart?.reste === 0,
  `Nouvelle journée : le filet revient, le départ reste consommé (jour ${q1?.reste_jour}, départ ${q1?.depart?.reste})`)
await outils.getByRole('button', { name: 'Quotas à zéro' }).click()
await page.waitForTimeout(800)
const q2 = await quota(2)
dit(q2?.depart?.reste === 3 && q2?.reste_jour === 2, `Quotas à zéro : départ et jour reviennent (${q2?.reste})`)

// =================== 4. DEBLOQUER / REBLOQUER ============================
await outils.getByRole('button', { name: 'Débloquer Essai gratuit' }).click()
await page.waitForTimeout(900)
dit((await api('/api/groupes/2')).json?.groupe?.paye === true, 'Débloquer : la liste passe payée')
dit(/offerte/.test(await outils.innerText()), 'et le panneau la dit « offerte »')
await outils.getByRole('button', { name: 'Rebloquer Essai gratuit' }).click()
await page.waitForTimeout(900)
dit((await api('/api/groupes/2')).json?.groupe?.paye === false, 'Rebloquer : elle redevient gratuite')

dit((await api('/api/dev/base', { action: 'effacer-tout-sans-rien-dire' })).statut === 400,
  'une action inconnue est refusée (400)')

// La feuille d'achat a son raccourci.
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
await page.goto(`${BASE}/g/3/swipe`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.goto(`${BASE}/g/3/reglages`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Voir ce que ça ouvre' }).first().click()
await page.getByRole('button', { name: 'Débloquer sans payer (base locale)' }).click()
await page.waitForTimeout(1200)
dit((await api('/api/groupes/3')).json?.groupe?.paye === true,
  'la feuille d’achat débloque en local, sans Stripe')

// =================== 5. BASE NEUVE =======================================
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.getByRole('button', { name: /Mon compte/ }).click()
await page.locator('.outils-dev').waitFor({ timeout: 8000 })
await page.waitForTimeout(500)
await page.locator('.outils-dev').getByRole('button', { name: 'Base neuve' }).click()
await page.locator('.outils-dev').getByRole('button', { name: 'Tout effacer et resemer' }).click()
await page.waitForURL(/\/connexion/, { timeout: 20000 }).catch(() => null)
dit(/\/connexion/.test(page.url()), 'Base neuve : retour à la connexion')
await page.locator('section.dev').getByRole('button', { name: 'Paul' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
const q3 = await quota(2)
const g3 = (await api('/api/groupes/3')).json?.groupe
dit(q3?.depart?.fait === 0 && g3?.paye === false,
  `la base est comme au premier jour : quotas neufs, listes d’essai gratuites (départ fait ${q3?.depart?.fait}, « Autre essai » payée : ${g3?.paye})`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
