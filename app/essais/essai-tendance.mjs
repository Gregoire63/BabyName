/**
 * Un chiffre n'est montré que s'il veut dire quelque chose.
 *
 * L'INSEE arrondit chaque effectif annuel à 5. Elïa passait de 5 à 15 bébés
 * par an : la carte annonçait « +14 % par an », sans courbe pour le montrer.
 * Ce qui se vérifie ici :
 *  - un petit prénom (moins de 60 bébés en trois ans) donne ses bébés par an,
 *    pas un pourcentage, et les montre en barres — carte, fiche, graphies ;
 *  - une courbe se juge à son sommet : Aurélie (11 310 naissances en 1986,
 *    une cinquantaine en trois ans aujourd'hui) a retrouvé la sienne, sans
 *    pourcentage pour autant ;
 *  - un prénom courant garde son pourcentage et sa courbe ;
 *  - aucun sens du catalogue ne porte de syntaxe du Wiktionnaire (Masha
 *    affichait « {{transliterator »), ni le mot source en guise de sens
 *    (Nicolas « Nicolaus »).
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

const { page } = await onglet(nav)
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
const devant = () => page.locator('.carte.fiche:not(.derriere)').first()
const plat = async loc => (await loc.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()

// =================== LE CATALOGUE ===========================================
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const cat = await page.evaluate(() => fetch('/data/catalogue.json').then(r => r.json()))
const c = cat.cols
const i = nom => c.l.indexOf(nom)
const syntaxe = /\{\{|\}\}|\[\[|\]\]|<[a-z/]|&[a-z]+;|\|/
const sales = ['m', 'me', 'obn'].flatMap(k => c[k].map((v, j) => [c.l[j], v]).filter(([, v]) => v && syntaxe.test(v)))
dit(sales.length === 0, `aucun sens ne porte de wikitexte (${sales.slice(0, 3).map(x => x.join(' : ')).join(', ') || 'aucun'})`)
dit(c.m[i('Masha')] === 'diminutif russe de Marie', `Masha : « ${c.m[i('Masha')]} »`)
dit(c.m[i('Philippe')] === 'qui aime les chevaux', `Philippe : « ${c.m[i('Philippe')]} »`)
dit(c.m[i('Nicolas')] && c.m[i('Nicolas')] !== 'Nicolaus', `Nicolas n’a plus « Nicolaus » pour sens : « ${c.m[i('Nicolas')]} »`)
dit(cat.seuil_tendance === 60 && Array.isArray(cat.barres_annees), `le seuil vient du catalogue (${cat.seuil_tendance}, barres ${cat.barres_annees})`)
const sansNiCourbeNiBarres = c.l.filter((l, j) => !c.q[j] && !c.sr[j] && !c.nb[j]).length
dit(sansNiCourbeNiBarres === 0, `chaque prénom de la pile a sa courbe ou ses barres (${sansNiCourbeNiBarres} sans)`)

// =================== LA CARTE D'UN PETIT PRÉNOM ==============================
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
const liste = page.locator('a.carte', { hasText: 'Notre liste' }).first()
await liste.waitFor({ timeout: 20000 })
await liste.click()
await devant().locator('.nom').waitFor({ timeout: 25000 })
const gid = page.url().split('/')[4]

async function epingler(slug, nom) {
  await page.goto(`${BASE}/?ref=seo&prenom=${slug}`, { waitUntil: 'networkidle' })
  await page.waitForURL(new RegExp(`/g/${gid}/swipe`), { timeout: 20000 })
  await devant().locator('.nom', { hasText: nom }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
}

await epingler('ilaria', 'Ilaria')
const resume = await plat(devant().locator('.resume'))
dit(/bébés par an ≈ 18/.test(resume) && !/%/.test(resume), `Ilaria (55 bébés en trois ans) : « ${resume} »`)
const barres = devant().locator('.graphe .barres')
dit(await barres.count() === 1, 'ses bébés année par année, en barres')
dit(/2011 à 2025, arrondies à 5/.test(await barres.getAttribute('aria-label') ?? ''),
  'et les barres se disent aux lecteurs d’écran')
const graphe = await plat(devant().locator('.graphe'))
const valeurs = await barres.locator('.val').allInnerTexts()
dit(/Naissances par an/.test(graphe) && /2011/.test(graphe) && /2025/.test(graphe) && valeurs.length >= 5
    && valeurs.every(v => /^\d+$/.test(v) && Number(v) % 5 === 0),
  `la carte dit ce qu’elles comptent : chaque barre porte son nombre, les années dessous (${valeurs.join(' ')})`)

await page.getByRole('button', { name: 'Infos sur Ilaria' }).click()
const fiche = page.locator('[role="dialog"]').last()
await fiche.waitFor({ timeout: 10000 })
await page.waitForTimeout(500)
const texteFiche = await plat(fiche)
dit(/environ 18 bébés par an, trop peu pour chiffrer une tendance/.test(texteFiche),
  'la fiche le dit en une phrase, sans pente inventée')
dit(/Tendance trop peu de bébés/i.test(texteFiche) && !/%\/an/.test(texteFiche), 'et sa tuile « Tendance » aussi')
dit(await fiche.locator('.barres').count() === 1, 'avec les mêmes barres')
await page.getByRole('button', { name: 'Fermer la fiche' }).click()
await page.waitForTimeout(600)

// =================== AURÉLIE : LA COURBE SE JUGE À SON SOMMET ===============
await epingler('aurelie', 'Aurélie')
const resumeA = await plat(devant().locator('.resume'))
dit(await devant().locator('.graphe svg.courbe').count() === 1, 'Aurélie a retrouvé sa courbe : elle raconte le prénom')
dit(/bébés par an ≈ 17/.test(resumeA) && !/%/.test(resumeA), `mais pas de pourcentage sur 50 bébés : « ${resumeA} »`)

// =================== UN PRÉNOM COURANT =======================================
await epingler('gabriel', 'Gabriel')
const resumeG = await plat(devant().locator('.resume'))
dit(/par an (\+|−)?\d+ %/.test(resumeG) && !/-0 %/.test(resumeG) && await devant().locator('.graphe svg.courbe').count() === 1,
  `Gabriel garde son pourcentage et sa courbe : « ${resumeG} »`)

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
