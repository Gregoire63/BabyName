/**
 * Les liens qui arrivent de dehors : `?prenom=` (le bouton des fiches
 * publiques, scripts/seo.mjs) et `?code=` (l'invitation).
 *
 * Ce qui se vérifie ici :
 *  - un nouveau venu garde son prénom à travers la connexion et la création
 *    de la liste, et le trouve en première carte — même hors de ses filtres ;
 *  - la carte vue derrière le prénom épinglé est bien celle qui arrive ;
 *  - un habitué entre dans sa liste en cours, le prénom devant (slug à tirets
 *    compris), et l'épingle survit à un rechargement jusqu'au jugement ;
 *  - déjà en accord, déjà jugé, sous veto : on le dit, on ne le remet pas en
 *    jeu ; un slug inconnu ne casse rien ;
 *  - le bouton retour ne ramène pas dans la redirection ;
 *  - un invité sans compte garde son code à travers l'inscription — même
 *    par le lien de l'e-mail, qui s'ouvre sans lui — et arrive dans la
 *    liste partagée (il arrivait sur un accueil vide).
 */
import { lancer, onglet, compteur, inscrire, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []
const surveiller = p => p.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

const devant = p => p.locator('.carte.fiche:not(.derriere) .nom').first()
const derriere = p => p.locator('.carte.fiche.derriere .nom').first()
const nomDevant = async p => (await devant(p).innerText().catch(() => '')).trim()
const nomDerriere = async p => (await derriere(p).innerText().catch(() => '')).trim()
const message = p => p.locator('.retour[role="status"]')

// =================== 1. UN NOUVEAU VENU, DEPUIS LA FICHE DE LOUISE ==========
{
  const { page } = await onglet(nav)
  surveiller(page)
  await page.goto(`${BASE}/?ref=seo&prenom=louise`, { waitUntil: 'networkidle' })
  await page.waitForURL(/\/connexion/, { timeout: 20000 })
  const u = new URL(page.url())
  dit(u.searchParams.get('prenom') === 'louise',
    `sans compte, la connexion garde le prénom (${u.pathname}${u.search})`)
  const attend = page.locator('.attend', { hasText: 'Louise' })
  await attend.waitFor({ timeout: 20000 }).catch(() => null)
  dit(await attend.count() === 1, 'la connexion annonce « Votre liste commencera par Louise »')

  await inscrire(page, 'Léa', 'lea.louise@exemple.test')

  const note = page.locator('.premier', { hasText: 'Louise' })
  await note.waitFor({ timeout: 20000 }).catch(() => null)
  dit(await note.count() === 1,
    'sans liste, la création s’ouvre d’elle-même et redit que Louise ouvrira la liste')
  dit(!new URL(page.url()).search, `l’accueil a nettoyé son adresse (${page.url().replace(BASE, '')})`)

  // Un garçon, répandu, court : Louise est HORS des filtres.
  await page.getByRole('button', { name: 'Un garçon' }).click()
  await page.getByRole('button', { name: 'Continuer' }).click()     // les pays : la francophonie, cochée d'office
  await page.getByRole('button', { name: /Répandu, assumé/ }).click()
  await page.getByRole('button', { name: /^Court/ }).click()
  await page.getByRole('button', { name: 'Créer la liste' }).click()
  await devant(page).waitFor({ timeout: 25000 })
  await page.waitForTimeout(600)
  const gid = page.url().split('/')[4]?.split('?')[0]

  dit(await nomDevant(page) === 'Louise',
    `première carte : ${await nomDevant(page)} — même avec des filtres « garçon »`)
  dit(!page.url().includes('prenom='), 'l’adresse de la liste ne garde pas la demande')

  const vueDerriere = await nomDerriere(page)
  await page.getByRole('button', { name: 'Oui à Louise' }).click()
  await page.waitForTimeout(1100)
  const apres = await nomDevant(page)
  dit(apres && apres !== 'Louise' && apres === vueDerriere,
    `la carte vue derrière est celle qui arrive (${vueDerriere} → ${apres})`)

  const votes = await page.evaluate(g => fetch(`/api/groupes/${g}/votes`).then(r => r.json()), gid)
  dit((votes?.votes ?? []).some(v => v.prenom === 'Louise' && v.valeur === 2),
    'le oui à Louise est bien en base')
  const retenue = await page.evaluate(g => localStorage.getItem(`pr_epingle_${g}`), gid)
  dit(retenue === null, 'jugée, l’épingle est lâchée')

  await page.reload({ waitUntil: 'networkidle' })
  await devant(page).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  dit(await nomDevant(page) !== 'Louise', 'un rechargement ne la remet pas en jeu')
}

// =================== 2. UN HABITUE, DANS SA LISTE EN COURS =================
{
  const { page } = await onglet(nav)
  surveiller(page)
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, 'Paul')
  await page.waitForSelector('.bento', { timeout: 20000 })
  const liste = page.locator('a.carte', { hasText: 'Notre liste' }).first()
  await liste.waitFor({ timeout: 20000 })
  await liste.click()
  await devant(page).waitFor({ timeout: 25000 })
  const gid = page.url().split('/')[4]
  const premiere = await nomDevant(page)

  await page.goto(`${BASE}/?ref=seo&prenom=jean-baptiste`, { waitUntil: 'networkidle' })
  await page.waitForURL(new RegExp(`/g/${gid}/swipe`), { timeout: 20000 })
  await devant(page).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  dit(await nomDevant(page) === 'Jean-Baptiste',
    `connecté : la liste en cours s’ouvre sur ${await nomDevant(page)} (slug à tirets)`)
  dit(!page.url().includes('prenom='), 'et son adresse est propre')

  await page.reload({ waitUntil: 'networkidle' })
  await devant(page).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  dit(await nomDevant(page) === 'Jean-Baptiste', 'l’épingle survit à un rechargement, tant qu’il n’est pas jugé')
  dit(await message(page).count() === 0, 'sans rien redire')

  await page.getByRole('button', { name: 'Non à Jean-Baptiste' }).click()
  // La carte part à la fin de son geste (~0,7 à 1 s) : on l'attend, au lieu
  // d'un délai fixe qui tombait pile sur la limite.
  await page.waitForFunction(() => {
    const n = document.querySelector('.carte.fiche:not(.derriere) .nom')
    return n && n.textContent.trim() !== 'Jean-Baptiste'
  }, null, { timeout: 5000 }).catch(() => null)
  dit(await nomDevant(page) !== 'Jean-Baptiste', `jugé, il laisse la place (${await nomDevant(page)})`)
  dit(await page.evaluate(g => localStorage.getItem(`pr_epingle_${g}`), gid) === null,
    'et l’épingle est lâchée')

  // Avec une redirection EMPILEE, retour rejouait `/?prenom=jean-baptiste` :
  // retour dans la liste, et « vous avez déjà dit non à Jean-Baptiste ».
  await page.goBack({ waitUntil: 'networkidle' }).catch(() => null)
  await page.waitForTimeout(1500)
  dit(!page.url().includes('prenom=') && await message(page).count() === 0,
    `le bouton retour ne ramène pas dans la redirection (${page.url().replace(BASE, '')})`)

  const cas = [
    ['louise', 'Louise est déjà dans vos accords.'],
    ['camille', 'Vous avez déjà voté neutre pour Camille dans cette liste.'],
    ['Jayden', 'Jayden a reçu un veto dans cette liste.']
  ]
  for (const [slug, attendu] of cas) {
    await page.goto(`${BASE}/?prenom=${slug}`, { waitUntil: 'networkidle' })
    await page.waitForURL(new RegExp(`/g/${gid}/swipe`), { timeout: 20000 })
    const m = message(page).filter({ hasText: attendu })
    await m.waitFor({ timeout: 15000 }).catch(() => null)
    dit(await m.count() === 1, `« ${attendu} »`)
    const nom = await nomDevant(page)
    dit(nom && nom.toLowerCase() !== slug.toLowerCase(), `…et il n’est pas remis en jeu (devant : ${nom})`)
  }

  await page.goto(`${BASE}/?prenom=zzqxw`, { waitUntil: 'networkidle' })
  await page.waitForURL(new RegExp(`/g/${gid}/swipe`), { timeout: 20000 })
  await devant(page).waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  dit(await message(page).count() === 0 && !!(await nomDevant(page)),
    `un slug inconnu ne dit rien et ne casse rien (devant : ${await nomDevant(page)}, avant : ${premiere})`)
}

// =================== 3. UN INVITE SANS COMPTE ==============================
{
  const { page } = await onglet(nav)
  surveiller(page)
  await page.goto(`${BASE}/?code=dec0de01`, { waitUntil: 'networkidle' })
  await page.waitForURL(/\/connexion/, { timeout: 20000 })
  dit(new URL(page.url()).searchParams.get('code') === 'dec0de01',
    'le lien d’invitation garde son code jusqu’à la connexion')
  dit(await page.locator('.attend', { hasText: 'partagée' }).count() === 1,
    'et la connexion dit qu’une liste attend')
  // Le lien de l'e-mail s'ouvre dans un autre onglet, sans le code dans
  // l'adresse : l'appareil l'a gardé (utils/entreeEnAttente).
  await inscrire(page, 'Paul', 'paul.invite@exemple.test', { parLien: true })
  await page.waitForURL(/\/g\/[^/]+\/swipe/, { timeout: 20000 }).catch(() => null)
  const listes = await page.evaluate(() => fetch('/api/groupes').then(r => r.json()))
  dit(/\/g\/[^/]+\/swipe/.test(page.url()) && listes.some(l => l.nom === 'Essai gratuit'),
    `nouveau compte, par le lien de l’e-mail : il entre directement dans la liste partagée (${page.url().replace(BASE, '')})`)
}

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
