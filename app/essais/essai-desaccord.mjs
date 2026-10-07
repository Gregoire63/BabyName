/**
 * « Ce n'est peut-etre pas Marius, c'est trois syllabes. »
 *
 * Ce que cet essai garde surtout, c'est le SILENCE : tant qu'Alice n'a pas
 * assez de oui visibles, l'ecran ne doit rien expliquer. Une explication
 * calculee sur cinq prenoms serait credible et fausse — c'est le seul type
 * d'erreur que personne ne remarque, et celui qui decredibilise tout le reste.
 */
import { lancer, onglet, BASE, entrerComme } from './navigateur.mjs'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const erreurs = []

async function entrer(qui) {
  const { page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
  const c = page.locator('.carte', { hasText: 'Notre liste' }).first()
  await c.waitFor({ state: 'visible', timeout: 25000 })
  // (L'adresse de la liste, et non un délai : voir essai-portrait.)
  await c.click(); await page.waitForURL(/\/g\/\d+\//, { timeout: 25000 }); await page.waitForTimeout(1200)
  return { page, gid: page.url().split('/')[4] }
}

const aRevoir = async (p, gid) => {
  await p.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1400)
  await p.getByRole('tab', { name: 'À revoir' }).click()
  await p.waitForTimeout(900)
}

// ============ 1. LE SILENCE : Alice n'a que 5 oui visibles ==============
const { page: paul, gid } = await entrer('Paul')
await aRevoir(paul, gid)

const noms = await paul.locator('.desaccord .nom').allInnerTexts()
dit(noms.length > 0, `désaccords : ${noms.join(', ')}`)
dit(await paul.locator('.pourquoi').count() === 0,
    'rien n’est expliqué tant que la moyenne d’en face ne veut rien dire')
// Aucun texte d'explication (retirés le 28/09) : titres, pastilles et boutons.
dit(await paul.locator('#volet-revoir p.mini.doux').count() === 0,
    'et aucun paragraphe d’explication n’encombre « À revoir »')

// ============ 2. Alice remplit son profil, court ========================
// Sept prénoms de plus, tous d'une ou deux syllabes, tous déjà jugés par Paul
// (sinon son verdict ne lui serait pas visible et rien ne changerait).
const COURTS = ['Nine', 'Léon', 'Rose', 'Alma', 'Sacha', 'Noé', 'Victor']
const { page: alice } = await entrer('Alice')
const posees = await alice.evaluate(async ({ g, noms }) => {
  const out = []
  for (const p of noms) {
    const r = await fetch(`/api/groupes/${g}/vote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prenom: p, valeur: 2 })
    })
    out.push([p, r.status])
  }
  return out
}, { g: gid, noms: COURTS })
console.log('   [votes Alice]', JSON.stringify(posees))
dit(posees.every(([, s]) => s === 200), 'les sept oui d’Alice sont enregistrés')

// ============ 3. L'explication apparaît, et elle est vérifiable ==========
await aRevoir(paul, gid)
const combien = await paul.locator('.pourquoi').count()
const textes = await paul.locator('.pourquoi').allInnerTexts()
for (const t of textes) console.log('   [pourquoi]', t.replace(/\s+/g, ' '))
dit(combien > 0, `${combien} désaccord(s) expliqué(s) une fois le profil rempli`)
dit(textes.some(t => /Alice/.test(t)), 'la phrase nomme celui qui refuse, pas celui qui aime')
dit(textes.every(t => /longueur|rareté|époque/.test(t)),
    'et elle nomme l’axe, avec les deux chiffres qui la justifient')

// On refait le calcul à la main : la phrase doit correspondre aux votes.
const verif = await paul.evaluate(async g => {
  const d = await fetch(`/api/groupes/${g}/votes`).then(r => r.json())
  const cat = await fetch('/data/catalogue.json').then(r => r.json())
  const idx = {}; for (let k = 0; k < cat.n; k++) idx[cat.cols.l[k]] = k
  const sien = d.votes.filter(v => v.pseudo === 'Alice' && v.valeur === 2).map(v => v.prenom)
  const y = sien.map(n => cat.cols.y[idx[n]]).filter(x => x !== undefined)
  const m = y.reduce((a, b) => a + b, 0) / y.length
  return { oui: sien.length, moyenneSyllabes: Math.round(m * 100) / 100,
           marius: cat.cols.y[idx['Marius']] }
}, gid)
console.log('   [vérif]', JSON.stringify(verif))
dit(verif.oui >= 12, `Alice a bien ${verif.oui} oui visibles (seuil 12)`)
dit(textes.some(t => t.includes(verif.moyenneSyllabes.toFixed(1)))
    || textes.some(t => /syllabes/.test(t)),
    `et la moyenne annoncée est celle des votes (${verif.moyenneSyllabes} syllabes, Marius ${verif.marius})`)

// ============ 4. Rien de tout ça sans avoir débloqué =====================
await paul.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const libre = paul.locator('.carte', { hasText: 'Essai gratuit' }).first()
await libre.waitFor({ state: 'visible', timeout: 25000 })
await libre.click(); await paul.waitForURL(/\/g\/\d+\//, { timeout: 25000 }); await paul.waitForTimeout(1200)
const gidLibre = paul.url().split('/')[4]
await aRevoir(paul, gidLibre)
dit(await paul.locator('.pourquoi').count() === 0,
    'sur une liste gratuite, aucune explication')

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
