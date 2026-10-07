/**
 * Un nom tapé est un nom enregistré, quelle que soit la façon de partir.
 *
 * Le 28/09, un nouveau nom de liste repartait en quittant les réglages par
 * le bouton retour du téléphone : il ne s'enregistrait qu'au blur, et le
 * retour démonte la page sans rendre le focus. Ce qu'on prouve :
 *  - une pause dans la frappe suffit (pas besoin de quitter le champ) ;
 *  - partir par le retour, ou passer l'app en arrière-plan, enregistre aussi ;
 *  - toucher un onglet enregistre toujours ;
 *  - même chose pour le nom de famille (liste débloquée) et le nom affiché ;
 *  - le serveur ne reçoit pas une requête par lettre.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
let envois = 0
page.on('request', r => { if (r.method() === 'PUT' && /\/nom$/.test(r.url())) envois++ })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })

const lire = (chemin) => page.evaluate(async c => (await fetch(c)).json(), chemin)
const nomListe = async gid => (await lire(`/api/groupes/${gid}`))?.groupe?.nom
const reglages = async gid => {
  await page.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'networkidle' })
  await page.locator('section[aria-label="Quitter ou supprimer cette liste"]').waitFor({ timeout: 20000 })
}
const champNom = () => page.getByRole('textbox', { name: 'Nom de la liste' })

// ---------- 1. une pause dans la frappe suffit ------------------------------
await reglages(2)
envois = 0
await champNom().click()
await champNom().fill('')
await champNom().pressSequentially('Pause', { delay: 60 })
await page.waitForTimeout(1500)
dit(await nomListe(2) === 'Pause', 'une pause dans la frappe enregistre, sans quitter le champ')
dit(envois === 1, `une seule requête pour un mot tapé d’affilée (${envois})`)

// ---------- 2. partir par le retour ------------------------------------------
await champNom().fill('Par le retour')
await page.goBack()
await page.waitForTimeout(1500)
dit(await nomListe(2) === 'Par le retour', 'partir par le bouton retour enregistre le nom')

// ---------- 3. l'app passe en arrière-plan -----------------------------------
await reglages(2)
await champNom().fill('En arrière-plan')
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
await page.waitForTimeout(1500)
dit(await nomListe(2) === 'En arrière-plan', 'une app passée en arrière-plan enregistre le nom')
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

// ---------- 4. toucher un onglet ----------------------------------------------
await reglages(2)
await champNom().fill('Par un onglet')
await page.locator('nav.onglets button').first().click()
await page.waitForTimeout(1500)
dit(await nomListe(2) === 'Par un onglet', 'toucher un onglet enregistre le nom')

// ---------- 5. le nom de famille (liste débloquée) -----------------------------
await reglages(1)
const famille = page.locator('#champ-nom-famille')
await famille.fill('Arnaud-Durand')
await page.goBack()
await page.waitForTimeout(1500)
dit((await lire('/api/groupes/1'))?.groupe?.nom_famille === 'Arnaud-Durand',
  'le nom de famille aussi, même en partant par le retour')

// ---------- 6. le nom affiché, dans la feuille du compte ------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await page.getByRole('button', { name: /^Mon compte :/ }).click()
await page.locator('#compte-nom').waitFor({ timeout: 8000 })
await page.locator('#compte-nom').fill('Paulo')
await page.keyboard.press('Escape')
await page.waitForTimeout(1500)
dit((await lire('/api/auth/moi'))?.utilisateur?.pseudo === 'Paulo',
  'le nom affiché aussi, feuille fermée sans quitter le champ')

dit(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
