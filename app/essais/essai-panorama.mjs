import { lancer, entrerComme } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const nav = await lancer()

const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const cacher = () => {
    const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s)
  }
  if (document.head) cacher(); else document.addEventListener('DOMContentLoaded', cacher)
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|favicon|fonts|preload/.test(m.text())) { erreurs.push(m.text()); console.log('   [js]', m.text()) } })

// poids reseau reel du catalogue
let poidsGz = 0, repli = false
page.on('response', async r => {
  if (!r.url().includes('catalogue.json')) return
  const nom = r.url().split('/').pop().split('?')[0]
  if (nom === 'catalogue.json') repli = true
  const enc = (await r.allHeaders())['content-encoding'] ?? '-'
  const taille = parseInt((await r.allHeaders())['content-length'] ?? '0', 10)
  if (nom === 'catalogue.json.gz' && taille > poidsGz) poidsGz = taille
  console.log('   [net]', nom, taille, 'octets, content-encoding:', enc)
})

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.onglets button', { timeout: 20000 })

// ---------- 1. le catalogue charge en entier -------------------------------
const n = await page.evaluate(async () => {
  const r = await fetch('/data/catalogue.json.gz')
  const brut = new Uint8Array(await r.arrayBuffer())
  const gz = brut[0] === 0x1f && brut[1] === 0x8b
  const t = gz
    ? await new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(brut)
  const d = JSON.parse(t)
  const sens = d.cols.m.filter(Boolean).length
  const haute = d.cols.cf.filter(x => x === 2).length
  const sansConf = d.cols.m.filter((m, i) => m && d.cols.cf[i] === null).length
  return { n: d.n, rares: d.cols.q.reduce((a, b) => a + b, 0), champ: d.champs.q,
           caelis: d.cols.l.includes('Caëlis'), gz, octets: brut.length,
           sens, haute, sansConf }
})
dit(n.n === 19608, `catalogue complet : ${n.n} prénoms`)
dit(n.rares === 11941, `dont ${n.rares} marqués rares`)
dit(n.champ === 'rare', 'le champ q est documenté dans champs')
dit(n.sens > 6000 && n.haute > 0 && n.sansConf === 0,
    n.sansConf === 0
      ? `${n.sens} prénoms ont un sens, dont ${n.haute} en confiance haute — aucun sens sans confiance`
      : `${n.sansConf} sens affichés sans confiance associée`)
dit(n.caelis, 'Caëlis est dans le catalogue')
dit(!repli, repli ? 'REPLI sur catalogue.json : la détection gzip a raté'
                  : `un seul fichier chargé : catalogue.json.gz (${(poidsGz/1024).toFixed(0)} Ko sur le fil)`)

// ---------- 2. la pile ignore les rares par defaut -------------------------
await page.locator('.onglets button', { hasText: 'La liste' }).click()
await page.waitForSelector('text=Aucun filtre', { timeout: 10000 })
const resume = await page.locator('section.carte', { hasText: 'Aucun filtre' }).last().innerText()
dit(/Aucun filtre\.?\s*$/.test(resume.replace(/Modifier/, '').trim()) || /Aucun filtre/.test(resume),
    'le bloc Filtres le dit en deux mots : « Aucun filtre »')

await page.locator('button', { hasText: 'Modifier' }).last().click()
await page.waitForSelector('text=Inclure les prénoms très rares', { timeout: 10000 })
const pied = () => page.locator('button.btn-1', { hasText: /Voir les .* prénoms/ }).innerText()
const nb = async () => parseInt((await pied()).replace(/[^\d]/g, ''), 10)
const avant = await nb()
const annonce = parseInt(
  ((await page.locator('label', { hasText: 'Inclure les prénoms très rares' }).innerText())
    .match(/\+\s*([\d\s\u202f]+)/)?.[1] ?? '').replace(/[^\d]/g, ''), 10)
dit(avant > 7000 && avant < 7700, `pile par défaut : ${avant} prénoms, les rares restent dehors`)
dit(annonce > 11000, `la case annonce + ${annonce}`)

// ---------- 3. la bascule ouvre exactement ce qu'elle annonce --------------
await page.locator('label', { hasText: 'Inclure les prénoms très rares' })
          .locator('input[type=checkbox]').check()
await page.waitForTimeout(250)
const apres = await nb()
dit(apres === avant + annonce, `cochée : ${apres} prénoms = ${avant} + ${annonce}`)
await page.locator('label', { hasText: 'Inclure les prénoms très rares' })
          .locator('input[type=checkbox]').uncheck()
await page.waitForTimeout(250)
dit(await nb() === avant, 'décochée : on retrouve la pile d’avant')
await page.locator('button.btn-1', { hasText: /Voir les .* prénoms/ }).click()
await page.waitForTimeout(400)

// ---------- 3 bis. le doute est dit, pas caché -----------------------------
// La recherche vit sous la loupe du tri.
await page.locator('.onglets button', { hasText: 'Swipe' }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
await page.locator('input.chercher').fill('arthur')
await page.waitForTimeout(400)
const douteux = page.locator('.trouve', { hasText: 'Arthur' }).first()
dit(await douteux.count() > 0, 'la recherche trouve Arthur (sens « ours », confiance moyenne)')
// Toucher la ligne met Arthur en première carte ; sa fiche s'ouvre de là.
await douteux.click()
await page.waitForTimeout(800)
await page.locator('.carte.fiche:not(.derriere)').getByRole('button', { name: 'Infos sur Arthur' }).click()
await page.waitForSelector('.voile', { timeout: 10000 })
const fiche = await page.locator('.voile').first().innerText()
dit(/probable|débattue|douteuse/i.test(fiche),
    /probable|débattue|douteuse/i.test(fiche)
      ? 'la fiche d\'un sens non certain porte la mise en garde'
      : `pas de mise en garde sur la fiche : ${fiche.slice(0, 160).replace(/\n/g, ' · ')}`)
await page.getByRole('button', { name: 'Fermer la fiche' }).click()
await page.waitForSelector('.voile', { state: 'detached', timeout: 10000 })

// ---------- 4. la recherche trouve un rare et permet de le juger ----------
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
await page.locator('input.chercher').fill('caelis')
await page.waitForTimeout(400)
const ligne = page.locator('.trouve', { hasText: 'Caëlis' }).first()
dit(await ligne.count() > 0, 'la recherche trouve Caëlis')
dit(await ligne.locator('.puce.rare').count() === 1, 'Caëlis porte la pastille « rare »')
const bulle = await ligne.locator('.puce.rare').getAttribute('title')
dit(/15 naissances/.test(bulle ?? ''), `la pastille dit le volume : « ${bulle} »`)

// Un rare, hors de la pile, passe quand même en première carte, et se juge.
await ligne.click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Oui à Caëlis' }).click()
await page.waitForTimeout(1100)
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 10000 })
await page.locator('input.chercher').fill('caelis')
await page.waitForTimeout(500)
const apresVote = page.locator('.trouve', { hasText: 'Caëlis' }).first()
const puces = await apresVote.locator('.puce').allInnerTexts()
dit(puces.some(t => /oui/i.test(t)), `le vote sur un rare est enregistré : ${JSON.stringify(puces)}`)
await page.keyboard.press('Escape')          // on referme la recherche
await page.waitForTimeout(500)

// ---------- 5. cout reel du chargement du catalogue -----------------------
const cout = await page.evaluate(async () => {
  const t0 = performance.now()
  const r = await fetch('/data/catalogue.json.gz', { cache: 'reload' })
  const brut = new Uint8Array(await r.arrayBuffer())
  const t1 = performance.now()
  const gz = brut[0] === 0x1f && brut[1] === 0x8b
  const txt = gz
    ? await new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(brut)
  const t2 = performance.now()
  const d = JSON.parse(txt)
  const t3 = performance.now()
  const sansAccent = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const c = d.cols, liste = new Array(d.n)
  for (let k = 0; k < d.n; k++) liste[k] = { l: c.l[k], slug: sansAccent(c.l[k]).replace(/[^a-z]/g, ''),
    sexe: d.sexe[c.s[k]], n: c.n[k], q: !!(c.q && c.q[k]), g: c.g[k].map(x => d.origines[x]) }
  const t4 = performance.now()
  return { reseau: t1 - t0, gunzip: t2 - t1, parse: t3 - t2, construction: t4 - t3, total: t4 - t0 }
})
console.log('   [coût]', Object.entries(cout).map(([k, v]) => `${k} ${v.toFixed(0)} ms`).join(' · '))
dit(cout.total < 600, `catalogue prêt en ${cout.total.toFixed(0)} ms dans le navigateur`)

await page.locator('.onglets button', { hasText: 'Swipe' }).click()
await page.waitForSelector('.carte.fiche', { timeout: 15000 })
const nomsVus = []
for (let i = 0; i < 6; i++) {
  nomsVus.push((await page.locator('.carte.fiche').first().locator('.nom').innerText()).trim())
  await page.getByRole('button', { name: 'Oui' }).first().click().catch(() => {})
  await page.waitForTimeout(450)
}
console.log('   [pile]', nomsVus.join(' · '))
const rares = await page.evaluate(async noms => {
  const r = await fetch('/data/catalogue.json.gz')
  const b = new Uint8Array(await r.arrayBuffer())
  const gz = b[0] === 0x1f && b[1] === 0x8b
  const t = gz ? await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
               : new TextDecoder().decode(b)
  const d = JSON.parse(t)
  return noms.filter(n => { const i = d.cols.l.indexOf(n); return i >= 0 && d.cols.q[i] })
}, nomsVus)
dit(rares.length === 0, `aucun prénom rare n'entre dans la pile (${nomsVus.length} cartes vues)`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
