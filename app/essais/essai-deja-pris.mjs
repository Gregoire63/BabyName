/**
 * Retirer un prénom du jeu : « déjà pris » (partagé) ou en secret (compté),
 * graphies comprises.
 *
 *  1. La liste › Déjà pris : Mathilde, posée par Alice, s'affiche avec sa
 *     note et son auteur ; on ajoute Louise par l'autocomplétion, avec une
 *     note : elle quitte les accords, et la recherche la dit « Déjà pris ».
 *  2. Remettre en jeu le sien : un geste ; celui d'un autre : une
 *     confirmation d'abord.
 *  3. La carte : « Bloquer » ouvre une feuille où RIEN n'est coché ; « Déjà
 *     pris » avec une note, la carte part, ses graphies ne prennent pas sa
 *     place, et la liste la montre.
 *  4. En secret : Chloé (six autres graphies) coûte UN blocage, aucune
 *     graphie ne revient en carte, Mes choix la montre avec ses graphies.
 *  5. Au bout des blocages secrets, la feuille le dit et propose « déjà
 *     pris » ; le serveur refuse le suivant.
 *  6. Mamie, observatrice : voit la liste, sans champ ni bouton ; le serveur
 *     refuse ses ajouts.
 *  7. Alice efface son compte : Mathilde reste, sans auteur ni note.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()

async function entrer(cle) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => console.log('   [err]', e.message))
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.locator('input.champ').fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 30000 })
  return { ctx, page }
}
const api = (page, chemin, methode = 'GET', corps) => page.evaluate(async ([c, m, b]) => {
  const r = await fetch(c, { method: m, headers: { 'content-type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined })
  let json = null; try { json = await r.json() } catch {}
  return { status: r.status, json }
}, [chemin, methode, corps])

const { page } = await entrer('DEVP-ARNA-2345')
const alice = await entrer('DEVP-ARNB-2345')
// Un « déjà pris » d'Alice de plus, pour la confirmation (étape 2).
await api(alice.page, '/api/groupes/1/deja-pris', 'POST',
  { prenom: 'Timothée', motif: 'le neveu', variantes: ['Timothé', 'Timoté'] })

// ============ 1. La liste › Déjà pris ======================================
await page.goto(`${BASE}/g/1/reglages`, { waitUntil: 'networkidle' })
const carte = page.locator('section[aria-labelledby="titre-deja-pris"]')
await carte.waitFor({ timeout: 30000 })
const texte0 = (await carte.innerText()).replace(/\s+/g, ' ')
dit(/Mathilde/.test(texte0) && /ma sœur · Alice/.test(texte0),
  'la carte « Déjà pris » montre Mathilde, la note et qui l’a ajoutée')
dit(/\+ 2 graphies/.test(texte0), 'avec ses graphies comptées (Matilde, Mathylde)')

await carte.locator('#champ-deja-pris').fill('louis')
await page.waitForTimeout(300)
const sugg = carte.locator('.suggestions .suggestion')
const noms = (await sugg.locator('.nom').allInnerTexts()).map(t => t.trim())
dit(noms.includes('Louise') && noms.length <= 6, `l’autocomplétion propose Louise (${noms.join(', ')})`)
await sugg.filter({ has: page.locator('.nom:text-is("Louise")') }).click()
const note = carte.getByPlaceholder('Qui le porte ? (facultatif)')
dit(await note.isVisible(), 'choisir un prénom ouvre la note')
dit(await note.evaluate(el => el === document.activeElement), 'et le curseur y est')
await note.fill('la cousine')
await carte.getByRole('button', { name: 'Ajouter' }).click()
await page.waitForFunction(() => /ne passeront plus/.test(
  document.querySelector('section[aria-labelledby="titre-deja-pris"] [role="status"]')?.textContent ?? ''), null, { timeout: 8000 })
const texte1 = (await carte.innerText()).replace(/\s+/g, ' ')
dit(/la cousine · vous/.test(texte1), 'Louise est dans la liste : « la cousine · vous »')
dit(/Louise et ses 3 graphies ne passeront plus/.test(texte1), 'et l’écran le confirme, graphies comprises')
dit(await carte.locator('#champ-deja-pris').inputValue() === '', 'le champ est vidé, prêt pour le suivant')
const communs1 = (await api(page, '/api/groupes/1/communs')).json.map(c => c.prenom)
dit(!communs1.includes('Louise'), 'Louise quitte les accords')

// La recherche la dit « Déjà pris », sans rien à toucher.
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 30000 })
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
const rech = page.locator('.feuille-corps')
await rech.locator('input.chercher').fill('louiz')
await page.waitForTimeout(400)
const ligne = rech.locator('.trouve').filter({ has: page.locator('.nom:text-is("Louize")') })
dit(await ligne.count() === 1 && (await ligne.locator('.puce').innerText()).trim() === 'Déjà pris',
  'la recherche dit « Déjà pris » — pour la graphie aussi (Louize)')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

// ============ 2. Remettre en jeu ===========================================
await page.goto(`${BASE}/g/1/reglages`, { waitUntil: 'networkidle' })
await carte.waitFor({ timeout: 30000 })
await carte.getByRole('button', { name: 'Remettre Timothée en jeu' }).click()
await page.waitForTimeout(400)
const confirmer = carte.getByRole('button', { name: 'Confirmer : remettre Timothée en jeu' })
dit(await confirmer.count() === 1, 'celui d’Alice demande une confirmation')
dit((await api(page, '/api/groupes/1')).json.deja_pris.some(d => d.prenom === 'Timothée'),
  'et reste en place tant qu’on n’a pas confirmé')
await confirmer.click()
await page.waitForTimeout(1200)
dit(!(await api(page, '/api/groupes/1')).json.deja_pris.some(d => d.prenom === 'Timothée'),
  'confirmé : Timothée revient en jeu')
await carte.getByRole('button', { name: 'Remettre Louise en jeu' }).click()
await page.waitForTimeout(1200)
dit(!(await api(page, '/api/groupes/1')).json.deja_pris.some(d => d.prenom === 'Louise'),
  'le sien part d’un geste')
dit((await api(page, '/api/groupes/1/communs')).json.some(c => c.prenom === 'Louise'),
  'et Louise retrouve sa place dans les accords : les votes n’avaient pas bougé')

// ============ 3. La carte : « Déjà pris » ==================================
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
const devant = page.locator('.carte.fiche:not(.derriere) .nom').first()
await devant.waitFor({ timeout: 30000 })
const cible = (await devant.innerText()).trim()
await page.locator('.carte.fiche:not(.derriere) .bas .rouge').click()
const feuille = page.locator('.feuille-corps')
await feuille.waitFor({ timeout: 6000 })
dit((await feuille.locator('h2').first().innerText()).trim() === 'Bloquer ce prénom',
  `la carte de ${cible} ouvre « Bloquer ce prénom »`)
const radios = feuille.locator('input[type="radio"]')
await page.waitForTimeout(500)
dit(await radios.count() === 2 && !(await radios.nth(0).isChecked()) && !(await radios.nth(1).isChecked()),
  'deux raisons, aucune cochée d’avance')
const valider = feuille.locator('.feuille-pied .btn-1')
dit(await valider.isDisabled(), 'le bouton attend qu’on choisisse')
dit(await feuille.locator('.feuille-dedans input.champ').count() === 0, 'la note n’apparaît qu’une fois la raison choisie')
await page.screenshot({ path: '/tmp/dp1-feuille.png' })
await feuille.getByText('Déjà pris', { exact: true }).click()
const noteCarte = feuille.getByPlaceholder('Qui le porte ? La cousine, le fils de Paul…')
dit(await noteCarte.isVisible(), '« Déjà pris » ouvre une note visible de toute la liste')
dit(new RegExp(`Ajouter ${cible} aux déjà pris`).test(await valider.innerText()), `le bouton dit « Ajouter ${cible} aux déjà pris »`)
await noteCarte.fill('le fils de Paul')
await page.screenshot({ path: '/tmp/dp2-deja-pris.png' })
await valider.click()
await page.waitForTimeout(1600)
dit(await page.locator('.feuille-corps').count() === 0, 'la feuille se referme')
const etat3 = (await api(page, '/api/groupes/1')).json
const entree = etat3.deja_pris.find(d => d.prenom === cible)
dit(!!entree && entree.motif === 'le fils de Paul' && entree.mien,
  `${cible} est « déjà pris », avec la note (${JSON.stringify(entree)})`)
const suivant = (await devant.innerText()).trim()
dit(suivant !== cible && !(entree?.variantes ?? []).includes(suivant),
  `la carte suivante (${suivant}) n’est ni ${cible} ni une de ses graphies`)

// ============ 4. En secret, graphies comprises =============================
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await rech.locator('input.chercher').fill('chloé')
await page.waitForTimeout(400)
await rech.locator('.trouve').filter({ has: page.locator('.nom:text-is("Chloé")') }).click()
await page.waitForTimeout(900)
dit((await devant.innerText()).trim() === 'Chloé', 'la recherche met Chloé en première carte')
const avant = (await api(page, '/api/groupes/1')).json.mes_vetos.length
await page.locator('.carte.fiche:not(.derriere) .bas .rouge').click()
await feuille.waitFor({ timeout: 6000 })
const graphiesTxt = (await feuille.innerText()).replace(/\s+/g, ' ')
dit(/Avec ses graphies : Cloé, Chloe, Khloé et 3 autres/.test(graphiesTxt),
  'la feuille annonce les graphies emportées')
await feuille.getByText('En secret', { exact: true }).click()
dit(new RegExp(`Il vous en reste ${5 - avant} sur 5`).test((await feuille.innerText()).replace(/\s+/g, ' ')),
  `le compteur des blocages secrets : ${5 - avant} sur 5`)
dit(await feuille.locator('.feuille-pied .rouge-plein').count() === 1, 'le bouton passe au rouge du blocage')
await feuille.getByPlaceholder('Pourquoi ? (pour vous seul, facultatif)').fill('mon ex')
await page.screenshot({ path: '/tmp/dp3-secret.png' })
await feuille.locator('.feuille-pied .rouge-plein').click()
await page.waitForTimeout(1600)
const etat4 = (await api(page, '/api/groupes/1')).json
const chloe = etat4.mes_vetos.find(v => v.prenom === 'Chloé')
dit(!!chloe && chloe.variantes.length === 6 && chloe.motif === 'mon ex',
  `Chloé et ses 6 graphies : ${JSON.stringify(chloe)}`)
dit(etat4.mes_vetos.length === avant + 1, 'et UN seul blocage de plus')
const GROUPE_CHLOE = ['Chloé', 'Cloé', 'Chloe', 'Khloé', 'Chloë', 'Kloé', 'Cloée']
const apres = (await devant.innerText()).trim()
dit(!GROUPE_CHLOE.includes(apres), `aucune graphie ne prend la place (carte suivante : ${apres})`)
// Et la recherche le confirme : Cloé est bloquée, pas remise en jeu.
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await rech.locator('input.chercher').fill('cloé')
await page.waitForTimeout(400)
const cloe = rech.locator('.trouve').filter({ has: page.locator('.nom:text-is("Cloé")') })
dit(await cloe.count() === 1 && (await cloe.locator('.puce').innerText()).trim() === 'Bloqué',
  'Cloé est bloquée avec Chloé')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

// Mes choix : la ligne montre les graphies ; un « oui » devenu « déjà pris »
// (Alice y met Jeanne) le dit, au lieu de disparaître des accords sans un mot.
await api(alice.page, '/api/groupes/1/deja-pris', 'POST', { prenom: 'Jeanne', motif: 'la marraine' })
await page.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
await page.waitForSelector('.segment button', { timeout: 30000 })
const cl = page.locator('.pager > section:nth-child(2)')
await cl.locator('.segment button', { hasText: 'Mes choix' }).click()
await page.waitForTimeout(700)
const jeanne = cl.locator('.groupe .rangee').filter({ has: page.locator('.nom', { hasText: /^\s*Jeanne\s*$/ }) })
dit(await jeanne.count() === 1 && await jeanne.locator('.puce.pris').innerText() === 'déjà pris',
  'Mes choix › Oui : Jeanne porte « déjà pris »')
await api(alice.page, '/api/groupes/1/deja-pris?prenom=Jeanne', 'DELETE')
await cl.locator('.groupe .entete', { hasText: 'Prénoms bloqués' }).click()
await page.waitForTimeout(400)
const bloc = cl.locator('.groupe').filter({ hasText: 'Prénoms bloqués' })
const txtBloc = (await bloc.innerText()).replace(/\s+/g, ' ')
dit(/Chloé \+ 6 graphies mon ex/.test(txtBloc), 'Mes choix : « Chloé + 6 graphies », avec le motif')
dit(await bloc.getByRole('button', { name: /Déjà pris dans la liste/ }).count() === 1,
  'et un chemin vers les « déjà pris »')

// ============ 5. Au bout des blocages secrets ==============================
for (const p of ['Emma', 'Jade', 'Rose', 'Anna', 'Lina']) {
  if ((await api(page, '/api/groupes/1')).json.mes_vetos.length >= 5) break
  await api(page, '/api/groupes/1/veto', 'POST', { prenom: p })
}
const refus = await api(page, '/api/groupes/1/veto', 'POST', { prenom: 'Mila' })
dit(refus.status === 409 && refus.json?.statusMessage === 'quota_veto_atteint',
  'le serveur refuse un sixième blocage secret')
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await devant.waitFor({ timeout: 30000 })
await page.locator('.carte.fiche:not(.derriere) .bas .rouge').click()
await feuille.waitFor({ timeout: 6000 })
await feuille.getByText('En secret', { exact: true }).click()
const txt5 = (await feuille.innerText()).replace(/\s+/g, ' ')
dit(/Vos 5 blocages secrets sont utilisés/.test(txt5) && /« déjà pris »/.test(txt5),
  'au bout, la feuille le dit et propose « déjà pris »')
dit(await feuille.locator('.feuille-pied .rouge-plein').isDisabled(), 'et le blocage secret n’est plus possible')
await feuille.getByText('Déjà pris', { exact: true }).click()
dit(!(await valider.isDisabled()), '« déjà pris », lui, reste ouvert')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

// ============ 6. Mamie, observatrice =======================================
const mamie = await entrer('DEVM-AMIE-2345')
await mamie.page.goto(`${BASE}/g/1/reglages`, { waitUntil: 'networkidle' })
const carteM = mamie.page.locator('section[aria-labelledby="titre-deja-pris"]')
await carteM.waitFor({ timeout: 30000 })
dit(/Mathilde/.test(await carteM.innerText()), 'Mamie voit les prénoms déjà pris')
dit(await carteM.locator('#champ-deja-pris').count() === 0
  && await carteM.getByRole('button', { name: /Remettre/ }).count() === 0,
  'sans champ pour en ajouter ni bouton pour en retirer')
const refusM = await api(mamie.page, '/api/groupes/1/deja-pris', 'POST', { prenom: 'Gaspard' })
const refusM2 = await api(mamie.page, '/api/groupes/1/deja-pris?prenom=Mathilde', 'DELETE')
dit(refusM.status === 403 && refusM2.status === 403, `le serveur refuse ses ajouts et retraits (${refusM.status}, ${refusM2.status})`)

// ============ 7. Un compte effacé ==========================================
const eff = await api(alice.page, '/api/moi/supprimer', 'POST', { confirmation: 'SUPPRIMER' })
dit(eff.status === 200, 'Alice efface son compte')
const mathilde = (await api(page, '/api/groupes/1')).json.deja_pris.find(d => d.prenom === 'Mathilde')
dit(!!mathilde && mathilde.auteur === null && mathilde.motif === null && mathilde.variantes.length === 2,
  `Mathilde reste à la liste, sans auteur ni note (${JSON.stringify(mathilde)})`)
await page.goto(`${BASE}/g/1/reglages`, { waitUntil: 'networkidle' })
await carte.waitFor({ timeout: 30000 })
dit(/Mathilde.*un ancien membre/s.test(await carte.innerText()), 'l’écran dit « un ancien membre »')

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
