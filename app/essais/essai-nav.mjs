import { lancer } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const lisible = t => t.trim().split('\n').pop().trim()

const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('   [err]', e.message))
page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|favicon|fonts/.test(m.text())) console.log('   [js]', m.text()) })

// ---------- connexion avec la vraie cle, contre la vraie base -------------
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVP-ARNA-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForURL(u => !u.pathname.includes('connexion'), { timeout: 15000 })
await page.waitForSelector('.bento', { timeout: 15000 })
dit(page.url().endsWith('/'), `apres connexion on est sur ${page.url().replace(BASE, '') || '/'}`)

// ---------- 1. pas de barre hors liste ------------------------------------
dit(await page.locator('.onglets').count() === 0, 'aucune barre du bas sur l’accueil')

// ---------- 2. les chiffres de l'annee ------------------------------------
// Les statistiques s'affichent APRES le chargement du catalogue : sans cette
// attente on lit un accueil encore vide et on croit que le titre a disparu.
await page.waitForSelector('.section', { timeout: 25000 })
await page.waitForTimeout(400)
// Depuis que l'accueil separe « Ma liste » et « Mes autres listes », la
// premiere section n'est plus celle des naissances : on la nomme.
const titres = (await page.locator('.section').allInnerTexts()).map(t => t.trim())
const titreAnnee = titres.find(t => /naissances/i.test(t)) ?? ''
dit(/naissances de 2025/i.test(titreAnnee), `titre : « ${titreAnnee} » (sections : ${titres.join(' | ')})`)
// L'ancienne note « pas de 12 mois glissants » a disparu avec l'ecran : la
// derniere annee du catalogue est complete, il n'y a plus rien a prevenir.
// Ce qui reste a verifier, c'est que le titre annonce CETTE annee-la et pas
// une autre — un titre « 2026 » sur des donnees 2025 serait un vrai mensonge.
const anneeCat = await page.evaluate(() => fetch('/data/catalogue.json')
  .then(r => r.json()).then(d => (d.serie_annees ?? [1986, 2025])[1]))
dit(new RegExp(`naissances de ${anneeCat}`, 'i').test(titreAnnee),
    `le titre annonce la derniere annee du catalogue (${anneeCat})`)
const filles = await page.locator('.carte:has-text("filles") .rang .q').allInnerTexts()
const garcons = await page.locator('.carte:has-text("garçons") .rang .q').allInnerTexts()
console.log('   top filles  :', filles.join(', '))
console.log('   top garçons :', garcons.join(', '))
dit(JSON.stringify(garcons) === JSON.stringify(['Gabriel', 'Noah', 'Léo']),
    'classement 2025 (et non sur 3 ans, qui mettrait Léo avant Noah)')

// ---------- 3. la feuille du compte ---------------------------------------
await page.locator('.qui').click()
await page.waitForSelector('.feuille-corps', { timeout: 5000 })
const tetes = await page.locator('.feuille-corps h2').first().innerText()
dit(tetes === 'Mon compte', `la feuille s’ouvre : « ${tetes} »`)
const nomEnTete = (await page.locator('.qui span').innerText()).trim()
dit(await page.locator('.feuille-corps input.champ').inputValue() === nomEnTete,
    `le nom actuel y est (« ${nomEnTete} »)`)
dit(await page.getByRole('button', { name: 'Se déconnecter' }).count() === 1,
    'la déconnexion est dans la feuille du compte')
await page.waitForTimeout(700); await page.screenshot({ path: '/tmp/f1-compte.png' })

// renommer pour de vrai, contre la base. Le nom change a chaque passage :
// la base est persistante, un nom en dur ne tiendrait qu'une fois.
const neuf = 'Paul ' + Math.floor(Math.random() * 1000)
await page.locator('.feuille-corps input.champ').fill(neuf)
dit(await page.getByRole('button', { name: 'Changer' }).count() === 0, 'pas de bouton pour enregistrer le nom')
await page.locator('.feuille-corps input.champ').press('Enter')      // Entrée quitte le champ : c'est enregistré
await page.getByRole('status').filter({ hasText: 'Enregistré' }).waitFor({ timeout: 5000 }).catch(() => null)
await page.waitForTimeout(400)
dit((await page.locator('.qui span').innerText()).trim() === neuf,
    `le nom s’enregistre en quittant le champ, passe en base et remonte dans l’en-tête (« ${neuf} »)`)
await page.locator('.feuille-x').click()
await page.waitForTimeout(600)
dit(await page.locator('.feuille-corps').count() === 0, 'la feuille se ferme (animation jouée)')

// ---------- 4. rejoindre ---------------------------------------------------
await page.getByRole('button', { name: /Rejoindre une liste/ }).click()
await page.waitForSelector('.feuille-corps', { timeout: 5000 })
dit((await page.locator('.feuille-corps h2').first().innerText()) === 'Rejoindre une liste',
    'la feuille « Rejoindre » s’ouvre')
await page.locator('input.code').fill('ilou -_!')
dit(await page.locator('input.code').inputValue() === '',
    'les caractères qui ne peuvent figurer dans aucun code (I, L, O, U, ponctuation) sont refusés à la saisie')
await page.locator('input.code').fill('deadbeef')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForTimeout(1200)
dit(/Code inconnu/.test(await page.locator('.feuille-corps').innerText()),
    'un code inexistant donne une erreur lisible')
await page.waitForTimeout(700); await page.screenshot({ path: '/tmp/f2-rejoindre.png' })
await page.locator('.feuille-x').click(); await page.waitForTimeout(600)

// ---------- 5. l'assistant de creation ------------------------------------
await page.getByRole('button', { name: /Une autre liste|Créer ma liste/ }).click()
await page.waitForSelector('.feuille-corps.plein', { timeout: 5000 })
dit(await page.locator('.feuille-corps.plein').count() === 1,
    'créer une liste s’ouvre dans une feuille pleine hauteur')
dit(await page.locator('.points i').count() === 4, 'les 4 étapes sont indiquées')
await page.waitForTimeout(700); await page.screenshot({ path: '/tmp/f3-creer.png' })
await page.locator('.feuille-x').click(); await page.waitForTimeout(600)
dit(await page.locator('.feuille-corps').count() === 0, 'l’assistant se referme')

// ---------- 6. dans une liste : la barre apparait --------------------------
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.onglets button', { timeout: 15000 })
const onglets = (await page.locator('.onglets button, .onglets a').allInnerTexts()).map(lisible)
dit(JSON.stringify(onglets) === JSON.stringify(['Accueil', 'Swipe', 'Classement', 'La liste']),
    `barre dans la liste : ${onglets.join(' · ')}`)

await page.locator('.onglets button', { hasText: 'La liste' }).click()
await page.waitForTimeout(800)
const sec = page.locator('.pager > section:nth-child(3)')
dit((await sec.locator('.tete p').first().innerText()).includes('Réglages de cette liste'),
    'l’écran dit « Réglages de cette liste »')
dit(await sec.getByRole('button', { name: /Se déconnecter|générer une nouvelle|Changer/i }).count() === 0
    && await sec.locator('.cle').count() === 0,
    'plus aucune commande de compte dans les réglages de la liste')
const texte = await sec.innerText()
dit(await sec.getByRole('button', { name: 'Passkeys, e-mail, mes données' }).count() === 1,
    'le compte y a son entrée, « Mon compte », qui ouvre la feuille du compte')
await page.waitForTimeout(700); await page.screenshot({ path: '/tmp/f4-laliste.png' })

// ---------- 7. la sortie ---------------------------------------------------
await page.locator('.onglets a.sortie').click()
await page.waitForSelector('.bento', { timeout: 15000 })
// La vue de liste joue encore sa sortie quand le bento apparait : on attend
// qu'elle soit reellement demontee, pas qu'elle soit invisible.
const partie = await page.locator('.onglets').waitFor({ state: 'detached', timeout: 6000 })
  .then(() => true).catch(() => false)
dit(partie, 'Accueil sort de la liste et la barre disparaît')

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
