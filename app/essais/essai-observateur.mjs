/**
 * L'observateur : il donne son avis, il n'a pas de veto.
 *
 * C'est la fonction payante la plus facile a rater en silence. Si le non de
 * Mamie retirait Louise des accords, le role ne servirait a rien — et
 * l'argument de vente (« invitez vos parents sans risque ») serait un
 * mensonge que personne ne remarquerait avant d'avoir paye.
 */
import { lancer, entrerComme } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const faireOnglet = async () => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await ctx.addInitScript(() => {
    const c = () => { const s = document.createElement('style')
      s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
      document.head?.appendChild(s) }
    if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
  })
  return ctx.newPage()
}
const erreurs = []
const plat = async (p, sel) => (await p.locator(sel).first().innerText().catch(() => ''))
  .replace(/\s+/g, ' ').trim()

async function entrer(p, qui) {
  p.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await p.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(p, qui)
  await p.waitForSelector('.bento', { timeout: 20000 })
}

/** L'accueil charge ses listes apres le bento : on attend la bonne carte. */
async function ouvrirListe(p, nom) {
  const carte = p.locator('.carte', { hasText: nom }).first()
  await carte.waitFor({ state: 'visible', timeout: 25000 })
  await carte.click()
  // L'adresse d'abord (c'est d'elle qu'on tire le numéro de la liste) : sur
  // une machine chargée, deux secondes et demie n'y suffisaient pas toujours.
  await p.waitForURL(/\/g\/\d+\//, { timeout: 25000 })
  await p.waitForTimeout(2500)
}

// =================== CÔTÉ COUPLE =========================================
const paul = await faireOnglet()
await entrer(paul, 'Paul')
await ouvrirListe(paul, 'Notre liste')
const gid = paul.url().split('/')[4]

const communs = await paul.evaluate(g =>
  fetch(`/api/groupes/${g}/communs`).then(r => r.json()), gid)
const noms = (communs.communs ?? communs).map(c => c.prenom)
dit(noms.includes('Louise'),
    `Louise reste un accord malgré le non de Mamie (${noms.length} accords : ${noms.slice(0, 5).join(', ')}…)`)
dit(noms.includes('Anouk'), 'Anouk aussi — deux refus d’observateur, zéro accord perdu')

const etat = await paul.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)
const obs = etat.avancement.filter(m => m.role === 'observateur')
dit(obs.length === 1 && obs[0].pseudo === 'Mamie',
    `l’avancement distingue l’observatrice : ${obs.map(o => `${o.pseudo} (${o.votes} jugés)`).join(', ')}`)

await paul.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'networkidle' })
await paul.waitForTimeout(1500)
const reglages = await plat(paul, '.pile')
dit(/Mamie/.test(reglages) && /observe/.test(reglages),
    'l’écran des réglages dit qui observe')
dit(/ne compte pas dans vos accords|ne peut pas poser de veto/i.test(reglages),
    'et il dit exactement ce qu’un observateur ne peut pas faire')

// L'avertissement « troisième personne » ne doit PAS se déclencher pour elle.
const decideurs = etat.avancement.filter(m => m.role !== 'observateur').length
dit(decideurs === 2, `deux décideurs comptés, pas trois (${decideurs})`)
const texteAvert = await plat(paul, '.avert')
dit(/troisième personne/i.test(texteAvert),
    'l’avertissement parle encore d’une TROISIÈME personne — Mamie n’en est pas une')
dit(!/Mamie/.test(texteAvert), 'et il ne la compte pas dedans')

// =================== CÔTÉ OBSERVATRICE ===================================
const mamie = await faireOnglet()
await entrer(mamie, 'Mamie')
await ouvrirListe(mamie, 'Notre liste')
await mamie.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await mamie.waitForTimeout(800)

dit(await mamie.getByRole('button', { name: /^Veto/ }).count() === 0,
    'aucun bouton « Veto » ne lui est proposé')
dit(await mamie.getByRole('button', { name: /^Non aux/ }).count() === 0,
    'ni « Non aux… », qui est un refus collectif')

const refus = await mamie.evaluate(g => fetch(`/api/groupes/${g}/veto`,
  { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prenom: 'Basile' }) }).then(r => r.status), gid)
dit(refus === 403, `et le serveur refuse le veto forcé : HTTP ${refus}`)

// Elle peut juger : c'est tout l'interet.
const avantV = await mamie.evaluate(g =>
  fetch(`/api/groupes/${g}`).then(r => r.json()).then(e =>
    e.avancement.find(m => m.pseudo === 'Mamie').votes), gid)
await mamie.getByRole('button', { name: 'Oui' }).first().click()
await mamie.waitForTimeout(1200)
const apresV = await mamie.evaluate(g =>
  fetch(`/api/groupes/${g}`).then(r => r.json()).then(e =>
    e.avancement.find(m => m.pseudo === 'Mamie').votes), gid)
dit(apresV === avantV + 1, `elle juge normalement (${avantV} → ${apresV})`)

// (« load », puis la carte attendue : après un vote, la page relit ses accords
// en fond ; quittée à cet instant, cette requête restait « en vol » pour
// Playwright, et « networkidle » ne venait jamais.)
await mamie.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'load' })
await mamie.waitForSelector('.pile', { timeout: 25000 })
await mamie.waitForTimeout(1500)
const sesReglages = await plat(mamie, '.pile')
dit(!/Code d’invitation|Partager le lien/.test(sesReglages),
    'elle ne peut pas réinviter : le lien d’invitation ne lui est pas montré')
dit(!/Les observateurs/.test(sesReglages),
    'ni créer d’autres observateurs')

// =================== SES CŒURS SUR LES ACCORDS ===========================
// Jeu d'essai : Mamie a dit oui à Jeanne, Suzanne et Colette, non à Louise.
const communsDe = p => p.evaluate(g => fetch(`/api/groupes/${g}/communs`).then(r => r.json()), gid)
const coeursSur = (liste, nom) => (liste.find(c => c.prenom === nom)?.coeurs ?? []).map(x => x.pseudo)
let cG = await communsDe(paul)
dit(coeursSur(cG, 'Jeanne').join() === 'Mamie', 'son « oui » sur un accord devient un cœur : Jeanne, aimé par Mamie')
dit(cG.some(c => c.prenom === 'Louise') && !coeursSur(cG, 'Louise').length,
    'son « non » ne s’affiche pas sur la courte liste du couple : pas de veto par la bande')
await mamie.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
await mamie.waitForSelector('.segment button', { timeout: 20000 })
const retirerJeanne = mamie.getByRole('button', { name: 'Retirer mon cœur à Jeanne' })
await retirerJeanne.waitFor({ timeout: 10000 })
dit(await retirerJeanne.getAttribute('aria-pressed') === 'true', 'sur les accords, Mamie voit son cœur sur Jeanne')
await mamie.getByRole('button', { name: 'J’aime Louise' }).click()
await mamie.waitForTimeout(1200)
cG = await communsDe(paul)
dit(coeursSur(cG, 'Louise').join() === 'Mamie', 'un toucher, et Louise est aimée par Mamie — Paul le voit')
await retirerJeanne.click()
await mamie.waitForTimeout(1200)
cG = await communsDe(paul)
dit(!coeursSur(cG, 'Jeanne').length && cG.some(c => c.prenom === 'Jeanne'),
    'le cœur retiré disparaît ; Jeanne reste un accord')
const votesM = await mamie.evaluate(g => fetch(`/api/groupes/${g}/votes`).then(r => r.json()), gid)
const moiM = (await mamie.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)).moi.user_id
dit(votesM.votes.find(v => v.prenom === 'Jeanne' && v.user_id === moiM)?.valeur === 1,
    'retirer son cœur la repasse en « neutre » : Jeanne ne revient pas dans sa pile')
await paul.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
await paul.waitForSelector('.segment button', { timeout: 20000 })
await paul.waitForTimeout(800)
const carteLouise = paul.locator('article.carte').filter({ has: paul.locator('h2', { hasText: /^Louise$/ }) })
dit(/Aimé par Mamie/.test(await carteLouise.innerText()), 'la carte de Louise le dit aux parents : « Aimé par Mamie »')
dit(await paul.getByRole('button', { name: /^J’aime / }).count() === 0, 'les parents, eux, n’ont pas de bouton cœur')
dit(!/manquent à Mamie/.test(await paul.locator('.pager > section:nth-child(2)').innerText()),
    'et les accords ne se disent pas « incomplets » à cause d’elle : ils ne l’attendent pas')
// =================== SES MOTS SUR LES ACCORDS ============================
// Un cœur ne dit pas pourquoi. Mamie laisse un mot sous Louise ; la carte
// repliée des parents le signale — sinon il dort sous un prénom que personne
// ne pense à déplier.
const nbMots = (liste, nom) => liste.find(c => c.prenom === nom)?.nb_commentaires ?? -1
// Le jeu d'essai en porte déjà un (Alice : « Un peu partout en ce moment, non ? »).
const avantMots = nbMots(await communsDe(paul), 'Louise')
const motsAttendus = new RegExp(`${avantMots + 1} commentaires?`)
await mamie.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
await mamie.waitForSelector('.segment button', { timeout: 20000 })
await mamie.locator('button.deplier', { hasText: /^Louise$/ }).click()
const champMot = mamie.getByRole('textbox', { name: 'Votre avis sur Louise' })
await champMot.waitFor({ timeout: 10000 })
await champMot.fill('Comme mon arrière-grand-mère, elle serait ravie.')
await mamie.getByRole('button', { name: 'Dire' }).click()
await mamie.waitForTimeout(1200)
const carteLouiseM = mamie.locator('article.carte').filter({ has: mamie.locator('h2', { hasText: /^Louise$/ }) })
dit(/Mamie : Comme mon arrière-grand-mère/.test(await carteLouiseM.innerText()),
    'Mamie peut laisser un mot sur un accord : il s’affiche signé')
dit(motsAttendus.test(await carteLouiseM.innerText()), 'et le compte de sa carte suit tout de suite')
cG = await communsDe(paul)
dit(nbMots(cG, 'Louise') === avantMots + 1,
    `les parents voient un mot de plus sur Louise (${avantMots} → ${nbMots(cG, 'Louise')})`)
await paul.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
await paul.waitForSelector('.segment button', { timeout: 20000 })
await paul.waitForTimeout(800)
const louiseG = paul.locator('article.carte').filter({ has: paul.locator('h2', { hasText: /^Louise$/ }) })
dit(motsAttendus.test(await louiseG.innerText()) && !/arrière-grand-mère/.test(await louiseG.innerText()),
    `sur la carte repliée : « ${avantMots + 1} commentaires », sans le texte`)
await paul.locator('button.deplier', { hasText: /^Louise$/ }).click()
await paul.waitForTimeout(1200)
dit(/Mamie : Comme mon arrière-grand-mère/.test(await louiseG.innerText()), 'déplié, Paul lit le mot de Mamie')

// Vote à l'aveugle : un autre observateur ne voit les cœurs qu'après son propre avis.
const papi = await faireOnglet()
await papi.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
const pApi = (chemin, corps, m = 'POST') => papi.evaluate(async ([c, b, m]) => {
  const r = await fetch(c, { method: m, headers: { 'content-type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined })
  return r.json().catch(() => null)
}, [chemin, corps, m])
const eP = await pApi('/api/auth/entrer', { pseudo: 'Papi' })
const rP = await pApi('/api/groupes/rejoindre', { code: 'ab5e0bad' })
let cP = await communsDe(papi)
dit(eP?.utilisateur && rP?.role === 'observateur', 'Papi entre par le lien des observateurs, comme observateur')
dit(!coeursSur(cP, 'Louise').length, 'Papi, observateur arrivé après, ne voit pas le cœur de Mamie avant d’avoir jugé Louise')
dit(nbMots(cP, 'Louise') === 0, 'ni qu’elle a laissé un mot : même règle')
await pApi(`/api/groupes/${gid}/vote`, { prenom: 'Louise', valeur: 1 })
cP = await communsDe(papi)
dit(coeursSur(cP, 'Louise').join() === 'Mamie', 'son avis donné, il le voit')
dit(nbMots(cP, 'Louise') === avantMots + 1, 'et les mots aussi')

// =================== LE LIEN LUI-MÊME ====================================
const inconnu = await faireOnglet()
inconnu.on('pageerror', e => erreurs.push(e.message))
await inconnu.goto(`${BASE}/?code=ab5e0bad`, { waitUntil: 'networkidle' })
await inconnu.waitForTimeout(1200)
const accueil = await plat(inconnu, 'body')
dit(/prénom|clé|liste/i.test(accueil), 'le lien d’observateur ouvre l’application sans erreur')

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
