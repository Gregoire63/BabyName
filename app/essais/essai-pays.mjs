/**
 * Les pays de référence d'une liste.
 *  - la création demande où grandira l'enfant, francophonie cochée d'office,
 *    et propose tous les pays dont les chiffres sont publics ;
 *  - avec plusieurs pays, la carte montre leur fréquence MOYENNE (commune) ;
 *  - la fiche montre le prénom « dans le monde », chaque chiffre avec son
 *    badge de source, puis tous les autres pays à la demande ;
 *  - les prénoms d'un pays choisi entrent dans la pile.
 */
import { lancer, onglet, compteur, inscrire, BASE } from './navigateur.mjs'

const { dit } = compteur()
const nav = await lancer()
const erreurs = []
const { page } = await onglet(nav)
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
const OUT = process.env.ESSAI_CAPTURES

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForURL(/\/connexion/, { timeout: 20000 })
await inscrire(page, 'Paul', 'paul.pays@exemple.test')
await page.locator('.bento').waitFor({ timeout: 20000 })
await page.getByRole('button', { name: /Créer ma liste/ }).click()
await page.getByRole('button', { name: 'Une fille' }).click()
await page.getByRole('heading', { name: /Où grandira votre enfant/ }).waitFor({ timeout: 20000 })
const presse = async nom => (await page.getByRole('button', { name: nom, exact: true }).getAttribute('aria-pressed')) === 'true'
dit(await presse('France') && !(await presse('Belgique')), 'la France est cochée d’office, et elle seule')
const tous = await page.locator('.groupe-pays .jeton').count()
dit(tous >= 15, `tous les pays sont proposés (${tous})`)
await page.getByRole('button', { name: 'Belgique', exact: true }).click()
await page.getByRole('button', { name: 'États-Unis', exact: true }).click()
dit(await presse('États-Unis') && await presse('Belgique'), 'on ajoute la Belgique et les États-Unis d’un geste')
await page.waitForTimeout(1500)
if (OUT) await page.screenshot({ path: `${OUT}/pays-choix.png` })
const compte = await page.locator('.compte strong').innerText()
await page.getByRole('button', { name: 'Continuer' }).click()
await page.getByRole('button', { name: /Peu importe|Connu sans être partout/ }).first().click()
await page.getByRole('button', { name: /Peu importe/ }).click()
dit(Number(compte.replace(/\D/g, '')) > 10000, `la pile compte les prénoms des pays choisis (${compte})`)
await page.getByRole('button', { name: 'Créer la liste' }).click()

const carte = page.locator('.carte.fiche:not(.derriere)').first()
await carte.waitFor({ timeout: 30000 })
await page.waitForTimeout(800)
const dt = await carte.locator('.resume dt').first().innerText()
dit(/moyenne de vos 3 pays/.test(dt), `la carte montre la moyenne des pays choisis (« ${dt} »)`)
if (OUT) await page.screenshot({ path: `${OUT}/pays-carte.png` })

const nom = (await carte.locator('.nom').first().innerText()).trim()
await carte.getByRole('button', { name: `Infos sur ${nom}` }).click()
const monde = page.locator('.monde')
await monde.waitFor({ timeout: 20000 })
const avant = await monde.locator('li.pays').count()
const badges = await monde.locator('a.badge').count()
dit(avant >= 2 && badges === avant, `${nom} dans le monde : ${avant} pays, chacun avec son badge de source`)
await monde.getByRole('button', { name: /Voir dans les \d+ autres pays/ }).click()
await page.waitForFunction(n => document.querySelectorAll('.monde li.pays').length > n, avant, { timeout: 30000 }).catch(() => null)
const apres = await monde.locator('li.pays').count()
dit(apres > avant, `les autres pays s’ajoutent à la demande (${avant} → ${apres})`)
if (OUT) { await monde.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/pays-fiche.png`, fullPage: false }) }

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
