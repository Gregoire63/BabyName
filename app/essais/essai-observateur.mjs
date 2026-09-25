/**
 * L'observateur : il donne son avis, il ne bloque rien.
 *
 * C'est la fonction payante la plus facile a rater en silence. Si le non de
 * Mamie retirait Louise des accords, le role ne servirait a rien — et
 * l'argument de vente (« invitez vos parents sans risque ») serait un
 * mensonge que personne ne remarquerait avant d'avoir paye.
 */
import { lancer } from './navigateur.mjs'
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

async function entrer(p, cle) {
  p.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await p.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await p.locator('input.champ').fill(cle)
  await p.getByRole('button', { name: 'Entrer' }).click()
  await p.waitForSelector('.bento', { timeout: 20000 })
}

/** L'accueil charge ses listes apres le bento : on attend la bonne carte. */
async function ouvrirListe(p, nom) {
  const carte = p.locator('.carte', { hasText: nom }).first()
  await carte.waitFor({ state: 'visible', timeout: 25000 })
  await carte.click()
  await p.waitForTimeout(2500)
}

// =================== CÔTÉ COUPLE =========================================
const greg = await faireOnglet()
await entrer(greg, 'DEVG-REGX-2345')
await ouvrirListe(greg, 'Notre liste')
const gid = greg.url().split('/')[4]

const communs = await greg.evaluate(g =>
  fetch(`/api/groupes/${g}/communs`).then(r => r.json()), gid)
const noms = (communs.communs ?? communs).map(c => c.prenom)
dit(noms.includes('Louise'),
    `Louise reste un accord malgré le non de Mamie (${noms.length} accords : ${noms.slice(0, 5).join(', ')}…)`)
dit(noms.includes('Anouk'), 'Anouk aussi — deux refus d’observateur, zéro accord perdu')

const etat = await greg.evaluate(g => fetch(`/api/groupes/${g}`).then(r => r.json()), gid)
const obs = etat.avancement.filter(m => m.role === 'observateur')
dit(obs.length === 1 && obs[0].pseudo === 'Mamie',
    `l’avancement distingue l’observatrice : ${obs.map(o => `${o.pseudo} (${o.votes} jugés)`).join(', ')}`)

await greg.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'networkidle' })
await greg.waitForTimeout(1500)
const reglages = await plat(greg, '.pile')
dit(/Mamie/.test(reglages) && /observe/.test(reglages),
    'l’écran des réglages dit qui observe')
dit(/ne compte pas dans vos accords|ne peut pas poser de veto/i.test(reglages),
    'et il dit exactement ce qu’un observateur ne peut pas faire')

// L'avertissement « troisième personne » ne doit PAS se déclencher pour elle.
const decideurs = etat.avancement.filter(m => m.role !== 'observateur').length
dit(decideurs === 2, `deux décideurs comptés, pas trois (${decideurs})`)
const texteAvert = await plat(greg, '.avert')
dit(/troisième personne/i.test(texteAvert),
    'l’avertissement parle encore d’une TROISIÈME personne — Mamie n’en est pas une')
dit(!/Mamie/.test(texteAvert), 'et il ne la compte pas dedans')

// =================== CÔTÉ OBSERVATRICE ===================================
const mamie = await faireOnglet()
await entrer(mamie, 'DEVM-AMIE-2345')
await ouvrirListe(mamie, 'Notre liste')
await mamie.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await mamie.waitForTimeout(800)

dit(await mamie.getByRole('button', { name: /^Bloquer/ }).count() === 0,
    'aucun bouton « Bloquer » ne lui est proposé')
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

await mamie.goto(`${BASE}/g/${gid}/reglages`, { waitUntil: 'networkidle' })
await mamie.waitForTimeout(1500)
const sesReglages = await plat(mamie, '.pile')
dit(!/Code d’invitation|Partager le lien/.test(sesReglages),
    'elle ne peut pas réinviter : le lien d’invitation ne lui est pas montré')
dit(!/Les observateurs/.test(sesReglages),
    'ni créer d’autres observateurs')

// =================== LE LIEN LUI-MÊME ====================================
const inconnu = await faireOnglet()
inconnu.on('pageerror', e => erreurs.push(e.message))
await inconnu.goto(`${BASE}/?code=ob5e0bad`, { waitUntil: 'networkidle' })
await inconnu.waitForTimeout(1200)
const accueil = await plat(inconnu, 'body')
dit(/prénom|clé|liste/i.test(accueil), 'le lien d’observateur ouvre l’application sans erreur')

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
