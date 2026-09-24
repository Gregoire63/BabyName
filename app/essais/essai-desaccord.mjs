/**
 * « Ce n'est peut-etre pas Marius, c'est trois syllabes. »
 *
 * Ce que cet essai garde surtout, c'est le SILENCE : tant qu'Audrey n'a pas
 * assez de oui visibles, l'ecran ne doit rien expliquer. Une explication
 * calculee sur cinq prenoms serait credible et fausse — c'est le seul type
 * d'erreur que personne ne remarque, et celui qui decredibilise tout le reste.
 */
import { lancer, onglet, BASE } from './navigateur.mjs'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const erreurs = []

async function entrer(cle) {
  const { page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.locator('input.champ').fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
  const c = page.locator('.carte', { hasText: 'Notre liste' }).first()
  await c.waitFor({ state: 'visible', timeout: 25000 })
  await c.click(); await page.waitForTimeout(2500)
  return { page, gid: page.url().split('/')[4] }
}
const plat = async (p, sel) => (await p.locator(sel).first().innerText().catch(() => ''))
  .replace(/\s+/g, ' ').trim()

const aRevoir = async (p, gid) => {
  await p.goto(`${BASE}/g/${gid}/classement`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1400)
  await p.getByRole('tab', { name: 'À revoir' }).click()
  await p.waitForTimeout(900)
}

// ============ 1. LE SILENCE : Audrey n'a que 5 oui visibles ==============
const { page: greg, gid } = await entrer('DEVG-REGX-2345')
await aRevoir(greg, gid)

const noms = await greg.locator('.desaccord .nom').allInnerTexts()
dit(noms.length > 0, `désaccords : ${noms.join(', ')}`)
dit(await greg.locator('.pourquoi').count() === 0,
    'rien n’est expliqué tant que la moyenne d’en face ne veut rien dire')
const avant = await plat(greg, '.pile')
dit(/Audrey aura gardé 12/.test(avant),
    `et l’écran dit pourquoi il se tait : « ${(avant.match(/On pourra dire[^.]*\./) ?? [''])[0]} »`)

// ============ 2. Audrey remplit son profil, court ========================
// Sept prénoms de plus, tous d'une ou deux syllabes, tous déjà jugés par Greg
// (sinon son verdict ne lui serait pas visible et rien ne changerait).
const COURTS = ['Nine', 'Léon', 'Rose', 'Alma', 'Sacha', 'Noé', 'Victor']
const { page: audrey } = await entrer('DEVA-DREY-2345')
const posees = await audrey.evaluate(async ({ g, noms }) => {
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
console.log('   [votes Audrey]', JSON.stringify(posees))
dit(posees.every(([, s]) => s === 200), 'les sept oui d’Audrey sont enregistrés')

// ============ 3. L'explication apparaît, et elle est vérifiable ==========
await aRevoir(greg, gid)
const combien = await greg.locator('.pourquoi').count()
const textes = await greg.locator('.pourquoi').allInnerTexts()
for (const t of textes) console.log('   [pourquoi]', t.replace(/\s+/g, ' '))
dit(combien > 0, `${combien} désaccord(s) expliqué(s) une fois le profil rempli`)
dit(textes.some(t => /Audrey/.test(t)), 'la phrase nomme celui qui refuse, pas celui qui aime')
dit(textes.every(t => /longueur|rareté|époque/.test(t)),
    'et elle nomme l’axe, avec les deux chiffres qui la justifient')

// On refait le calcul à la main : la phrase doit correspondre aux votes.
const verif = await greg.evaluate(async g => {
  const d = await fetch(`/api/groupes/${g}/votes`).then(r => r.json())
  const cat = await fetch('/data/catalogue.json').then(r => r.json())
  const idx = {}; for (let k = 0; k < cat.n; k++) idx[cat.cols.l[k]] = k
  const sien = d.votes.filter(v => v.pseudo === 'Audrey' && v.valeur === 2).map(v => v.prenom)
  const y = sien.map(n => cat.cols.y[idx[n]]).filter(x => x !== undefined)
  const m = y.reduce((a, b) => a + b, 0) / y.length
  return { oui: sien.length, moyenneSyllabes: Math.round(m * 100) / 100,
           marius: cat.cols.y[idx['Marius']] }
}, gid)
console.log('   [vérif]', JSON.stringify(verif))
dit(verif.oui >= 12, `Audrey a bien ${verif.oui} oui visibles (seuil 12)`)
dit(textes.some(t => t.includes(verif.moyenneSyllabes.toFixed(1)))
    || textes.some(t => /syllabes/.test(t)),
    `et la moyenne annoncée est celle des votes (${verif.moyenneSyllabes} syllabes, Marius ${verif.marius})`)

// ============ 4. Rien de tout ça sans avoir débloqué =====================
await greg.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const libre = greg.locator('.carte', { hasText: 'Essai gratuit' }).first()
await libre.waitFor({ state: 'visible', timeout: 25000 })
await libre.click(); await greg.waitForTimeout(2500)
const gidLibre = greg.url().split('/')[4]
await aRevoir(greg, gidLibre)
dit(await greg.locator('.pourquoi').count() === 0,
    'sur une liste gratuite, aucune explication')

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
process.exit(ko.length ? 1 : 0)
