/**
 * L'accessibilite, verifiee et non declaree.
 *
 * La page /accessibilite affirme des choses : contrastes AA, clavier partout,
 * dialogues qui gardent le focus, tri aux fleches, annonces pour les lecteurs
 * d'ecran. Cet essai les rejoue — sinon la declaration devient fausse au
 * premier changement de couleur, sans que personne ne le voie.
 *
 * Deux moitiés :
 *  1. axe-core (regles WCAG 2.0/2.1, niveaux A et AA) sur CHAQUE ecran et
 *     chaque dialogue, en theme clair puis sombre ;
 *  2. ce qu'aucun outil automatique ne voit : l'ordre du focus, le piege des
 *     dialogues, Echap, le retour du focus, les fleches du tri et des onglets.
 *
 * axe-core n'est pas une dependance de l'app : on le cherche via ESSAI_AXE
 * (chemin de axe.min.js), sinon dans node_modules (npm i -D axe-core).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

function cheminAxe() {
  if (process.env.ESSAI_AXE) return process.env.ESSAI_AXE
  try { return createRequire(import.meta.url).resolve('axe-core/axe.min.js') } catch {
    throw new Error('axe-core introuvable : npm i -D axe-core, ou ESSAI_AXE=/chemin/axe.min.js')
  }
}
const AXE = readFileSync(cheminAxe(), 'utf8')

const { ok, ko, dit } = compteur()
const nav = await lancer()
const { ctx, page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
const requetes = []
page.on('request', r => requetes.push(r.url()))

async function auditer(nom, { exclure = [] } = {}) {
  await page.waitForTimeout(450)          // fin des animations d'entree
  await page.evaluate(AXE)
  const r = await page.evaluate(async (exclure) => {
    const res = await window.axe.run(
      { include: [document], exclude: exclure.map(s => [s]) },
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        resultTypes: ['violations'] })
    return res.violations.map(v => ({
      id: v.id, impact: v.impact,
      noeuds: v.nodes.slice(0, 4).map(n => `${n.target.join(' ')} — ${(n.failureSummary || '').split('\n').slice(1, 2).join(' ').trim()}`)
    }))
  }, exclure)
  dit(r.length === 0, `${nom} : aucune violation WCAG A/AA${r.length ? ` (${r.map(v => v.id).join(', ')})` : ''}`)
  for (const v of r) {
    console.log(`         ${v.impact} ${v.id}`)
    for (const n of v.noeuds) console.log(`           · ${n}`)
  }
}

const dansDialogue = () => page.evaluate(() => {
  const d = document.querySelector('[aria-modal="true"]')
  return !!d && d.contains(document.activeElement)
})

// ============================================================ hors compte
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await auditer('Connexion')

// Le lien d'evitement est le premier arret de tabulation, et il mene au contenu.
await page.keyboard.press('Tab')
const premier = await page.evaluate(() => document.activeElement?.textContent?.trim())
dit(premier === 'Aller au contenu', `premier Tab : le lien d’évitement (« ${premier} »)`)
await page.keyboard.press('Enter')
const surContenu = await page.evaluate(() => document.activeElement?.id)
dit(surContenu === 'contenu', 'Entrée sur le lien d’évitement : le focus passe au contenu principal')

// Arrivée depuis une fiche publique et un lien d'invitation : deux encadrés de plus.
await page.goto(`${BASE}/connexion?prenom=louise&code=dec0de01`, { waitUntil: 'networkidle' })
await page.locator('.attend', { hasText: 'Louise' }).waitFor({ timeout: 20000 }).catch(() => null)
await auditer('Connexion depuis une fiche et une invitation')

for (const [chemin, nom] of [['/confidentialite', 'Confidentialité'], ['/conditions', 'Conditions'],
                             ['/mentions-legales', 'Mentions légales'], ['/accessibilite', 'Accessibilité']]) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: 'networkidle' })
  await auditer(`Page ${nom}`)
  const titre = await page.title()
  dit(titre.includes(nom) || titre.toLowerCase().includes(nom.toLowerCase().slice(0, 8)),
      `${nom} : titre de page propre (« ${titre} »)`)
}

// ============================================================ connecte
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.getByRole('textbox', { name: /clé d’accès/i }).fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })
await auditer('Accueil')
dit(/Accueil/.test(await page.title()), `l’accueil a son titre (« ${await page.title()} »)`)

// --- le compte : un dialogue qui en est un --------------------------------
const boutonCompte = page.getByRole('button', { name: /Mon compte/ })
await boutonCompte.focus()
await page.keyboard.press('Enter')
await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
await page.waitForTimeout(400)
dit(await dansDialogue(), 'ouvrir « Mon compte » met le focus dans le dialogue')
const nomDialogue = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  const id = d?.getAttribute('aria-labelledby')
  return id ? document.getElementById(id)?.textContent?.trim() : d?.getAttribute('aria-label')
})
dit(nomDialogue === 'Mon compte', `le dialogue porte son titre (« ${nomDialogue} »)`)
dit(await page.evaluate(() => !!document.querySelector('main#contenu')?.closest('[inert]')),
    'derrière le dialogue, la page est inerte')
let echappe = false
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab')
  if (!await dansDialogue()) { echappe = true; break }
}
dit(!echappe, '40 tabulations : le focus ne quitte jamais le dialogue')
await page.getByRole('button', { name: 'Supprimer mon compte' }).click()
await auditer('Mon compte (suppression dépliée)')
const supprimer = page.getByRole('button', { name: 'Supprimer définitivement' })
dit(await supprimer.isDisabled(), 'la suppression reste bloquée tant que SUPPRIMER n’est pas tapé')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
dit(await page.locator('[role="dialog"]').count() === 0, 'Échap ferme le dialogue')
const rendu = await page.evaluate(() => document.activeElement?.textContent?.includes('Greg'))
dit(!!rendu, 'à la fermeture, le focus revient sur le bouton qui l’avait ouvert')

// --- rejoindre une liste -----------------------------------------------------
await page.getByRole('button', { name: /Rejoindre une liste/ }).click()
await page.waitForSelector('[role="dialog"]')
await auditer('Rejoindre une liste')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)

// --- creation de liste ------------------------------------------------------
await page.getByRole('button', { name: /Une autre liste|Créer ma liste/ }).click()
await page.waitForSelector('[role="dialog"]')
await auditer('Assistant de création')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)

// --- fiche d'un prenom depuis l'accueil -------------------------------------
await page.locator('.rang').first().click()
await page.waitForSelector('[role="dialog"]')
await auditer('Fiche d’un prénom')
const courbe = await page.locator('[role="dialog"] svg[role="img"]').first().getAttribute('aria-label').catch(() => null)
dit(!!courbe && /au plus haut en \d{4}/.test(courbe), `la courbe a sa description (« ${courbe} »)`)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ============================================================ dans une liste
await page.locator('a', { hasText: 'Notre liste' }).first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(700)
await auditer('Tri (swipe)')
dit(/Swipe — Notre liste/.test(await page.title()), `le titre suit l’onglet (« ${await page.title()} »)`)
dit(await page.evaluate(() => [...document.querySelectorAll('main#contenu > section')]
  .filter(s => s.inert).length === 2), 'les deux volets qu’on ne regarde pas sont inertes')

// Le tri au clavier : fleche droite = oui, et le prenom suivant est annonce.
const avant = (await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()).trim()
await page.locator('main#contenu').focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(1300)
const apres = (await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()).trim()
dit(avant !== apres, `→ vote oui au clavier (${avant} → ${apres})`)
const annonce = (await page.locator('.sr-only[aria-live]').first().innerText().catch(() => '')).trim()
dit(annonce.startsWith(apres), `le prénom suivant est annoncé (« ${annonce} »)`)
const libelle = await page.locator('.boutons .rond.oui').getAttribute('aria-label')
dit(libelle === `Oui à ${apres}`, `le bouton dit ce qu’il fait (« ${libelle} »)`)

// --- dialogues du tri ---------------------------------------------------------
await page.getByRole('button', { name: /^Filtres/ }).first().click()
await page.waitForSelector('[role="dialog"]')
await auditer('Filtres')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)

// La recherche, sous la loupe : résultats, et un veto déplié.
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('[role="dialog"] input.chercher')
await page.waitForTimeout(450)
dit(await dansDialogue(), 'la recherche prend le focus (dans son champ)')
await page.locator('input.chercher').fill('mar')
await page.waitForTimeout(400)
const vetoRecherche = page.locator('.trouve button.veto').first()
if (await vetoRecherche.count()) await vetoRecherche.click()
await page.waitForTimeout(300)
await auditer('Recherche (résultats, veto déplié)')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
dit(await page.locator('[role="dialog"]').count() === 0, 'Échap referme la recherche')

const veto = page.locator('.carte.fiche:not(.derriere)').getByRole('button', { name: /^Bloquer / })
if (await veto.count()) {
  await veto.first().click()
  await page.waitForSelector('[role="dialog"]')
  await auditer('Bloquer un prénom')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
}
const famille = page.locator('.carte.fiche:not(.derriere)').getByRole('button', { name: /^Non aux / })
if (await famille.count()) {
  await famille.first().click()
  await page.waitForTimeout(400)
  if (await page.locator('[role="alertdialog"]').count()) {
    dit(await dansDialogue(), 'la confirmation « Non aux… » prend le focus')
    await auditer('Non à tous les prénoms d’un même début')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    dit(await page.locator('[role="alertdialog"]').count() === 0, 'Échap l’annule')
  }
}

// --- classement : les volets sont de vrais onglets --------------------------
await page.getByRole('button', { name: /^Classement/ }).click()
await page.waitForTimeout(900)
await auditer('Classement · Communs')
await page.getByRole('tab', { name: /Communs/ }).focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(500)
const choisi = await page.getByRole('tab', { selected: true }).innerText()
dit(/revoir/i.test(choisi), `→ sur les onglets passe au volet suivant (« ${choisi.trim()} »)`)
const focusOnglet = await page.evaluate(() => document.activeElement?.getAttribute('role'))
dit(focusOnglet === 'tab', 'et le focus suit l’onglet choisi')
await auditer('Classement · À revoir')
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500)
await auditer('Classement · Mes choix')
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700)
await auditer('Classement · Portrait')

// --- reglages de la liste, et l'offre ----------------------------------------
await page.getByRole('button', { name: /La liste/ }).click()
await page.waitForTimeout(900)
await auditer('La liste (réglages)')

// L'offre s'audite sur une liste gratuite, par le chemin reel : le mur du
// quota (3 de depart puis 2 par jour sur « Essai gratuit »), trie au clavier.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.locator('a', { hasText: 'Essai gratuit' }).first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
// Pendant le glissement, l'accueil et la liste sont tous deux dans la page :
// on attend qu'il ne reste que la liste.
await page.waitForFunction(() => document.querySelectorAll('main#contenu').length === 1, null, { timeout: 5000 })
await page.locator('main#contenu').focus()
const mur = page.getByRole('button', { name: 'Voir ce que ça ouvre' })
for (let i = 0; i < 9 && !(await mur.count()); i++) {
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(900)
}
dit(await mur.count() > 0, 'le mur du quota s’atteint entièrement au clavier')
await auditer('Mur du quota')
if (await mur.count()) {
  await mur.first().click()
  await page.waitForSelector('[role="dialog"]')
  await auditer('Achat (débloquer)')
  const payer = page.getByRole('button', { name: /Débloquer cette liste —/ })
  dit(await payer.isDisabled(), 'sans la case d’accord, le paiement ne peut pas partir')
  await page.getByRole('checkbox', { name: /conditions générales de vente/ }).check()
  dit(!await payer.isDisabled(), 'la case cochée, le bouton s’active')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

// ============================================================ theme sombre
await page.emulateMedia({ colorScheme: 'dark' })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
await auditer('Accueil, thème sombre')
await page.locator('a', { hasText: 'Notre liste' }).first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await auditer('Tri, thème sombre')
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('[role="dialog"] input.chercher')
await page.locator('input.chercher').fill('lou')
await page.waitForTimeout(500)
const vetoSombre = page.locator('.trouve button.veto').first()
if (await vetoSombre.count()) await vetoSombre.click()
await page.waitForTimeout(300)
await auditer('Recherche, thème sombre')
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
await page.getByRole('button', { name: /^Classement/ }).click()
await page.waitForTimeout(900)
await auditer('Classement, thème sombre')
await page.goto(`${BASE}/confidentialite`, { waitUntil: 'networkidle' })
await auditer('Confidentialité, thème sombre')

// ============================================================ mouvement reduit
await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForSelector('.bento', { timeout: 20000 })
const duree = await page.evaluate(() => getComputedStyle(document.querySelector('.carte')).transitionDuration)
dit(parseFloat(duree) < 0.01, `mouvement réduit : les transitions tombent à zéro (${duree})`)

// ============================================================ tiers
dit(!requetes.some(u => /fonts\.(googleapis|gstatic)\.com/.test(u)),
    'aucune requête vers Google Fonts : la police est servie par l’app')
dit(!requetes.some(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')),
    `aucune requête vers un tiers pendant tout le parcours${requetes.filter(u => !u.startsWith(BASE) && !/^(data|blob):/.test(u)).slice(0, 3).map(u => ' · ' + u).join('')}`)

dit(erreurs.length === 0, `aucune erreur JavaScript (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
