import { lancer, entrerComme } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const nav = await lancer()
const cacher = ctx => ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s) }
  document.head ? c() : document.addEventListener('DOMContentLoaded', c) })

async function entrer(qui) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await cacher(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', e => console.log('   [err]', e.message))
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
  return { ctx, page }
}

const { page } = await entrer('Paul')

// ---------- 1. le veto n'est plus public ----------------------------------
const etat = await page.evaluate(() =>
  fetch('/api/groupes/1').then(r => r.json()))
dit(Array.isArray(etat.vetos) && etat.vetos.every(v => typeof v === 'string'),
    `/api/groupes/1 ne renvoie que des prénoms vetos : ${JSON.stringify(etat.vetos)}`)
dit(JSON.stringify(etat).indexOf('mon ex') === -1,
    'le motif du veto d’Alice ne sort pas du serveur')
dit(etat.mes_vetos.length === 1 && etat.mes_vetos[0].prenom === 'Brandon',
    `mes_vetos ne contient que les miens : ${JSON.stringify(etat.mes_vetos)}`)

// ---------- 2. « La liste » : plus de gardés ni de vetos publics ---------
await page.goto(`${BASE}/g/1/reglages`, { waitUntil: 'networkidle' })
await page.waitForSelector('.pager > section:nth-child(3) h2', { timeout: 20000 })
const reglages = page.locator('.pager > section:nth-child(3)')
const titres = await reglages.locator('h2').allInnerTexts()
console.log('   cartes de « La liste » :', titres.join(' · '))
dit(!titres.includes('Mes gardés'), '« Mes gardés » a disparu des réglages')
dit(!titres.includes('Vetos'), '« Vetos » a disparu des réglages')
dit(!titres.includes('Chercher un prénom'), 'la recherche a quitté les réglages')

// ---------- 3. la recherche, sous la loupe du tri --------------------------
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 6000 })
const sec = page.locator('.feuille-corps')
dit(true, 'la loupe du tri ouvre la recherche')
await sec.locator('input.chercher').fill('bran')
await page.waitForTimeout(400)
const lignes = await sec.locator('.trouve').count()
dit(lignes > 0, `« bran » trouve ${lignes} prénom(s)`)
const brandon = sec.locator('.trouve').filter({ has: page.locator('.nom:text-is("Brandon")') })
dit(await brandon.count() === 1, 'Brandon est dans les résultats')
dit((await brandon.locator('.puce').innerText()).trim() === 'Veto',
    `son état est affiché : ${(await brandon.locator('.puce').innerText()).trim()}`)
await sec.locator('input.chercher').fill('jeanne')
await page.waitForTimeout(400)
const jeanne = sec.locator('.trouve').filter({ has: page.locator('.nom:text-is("Jeanne")') })
dit((await jeanne.locator('.puce').innerText()).trim() === 'Oui', 'Jeanne est marquée « Oui »')
await page.screenshot({ path: '/tmp/v1-recherche.png' })
// La toucher la remet en première carte : on la rejuge d'un geste.
await jeanne.click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Non à Jeanne' }).click()
await page.waitForTimeout(1100)
await page.getByRole('button', { name: 'Chercher un prénom' }).click()
await page.waitForSelector('.feuille-corps input.chercher', { timeout: 6000 })
await sec.locator('input.chercher').fill('jeanne')
await page.waitForTimeout(400)
dit((await jeanne.locator('.puce').innerText()).trim() === 'Non',
    'on peut changer son choix : la recherche la ramène, la carte la rejuge')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

// ---------- 4. Mes choix : favoris et vetos --------------------------------
await page.goto(`${BASE}/g/1/classement`, { waitUntil: 'networkidle' })
await page.waitForSelector('.segment button', { timeout: 20000 })
const cl = page.locator('.pager > section:nth-child(2)')
await cl.locator('.segment button', { hasText: 'Mes choix' }).click()
await page.waitForTimeout(800)
const blocs = (await cl.locator('.groupe .entete').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())
console.log('   blocs de Mes choix :', blocs.join(' | '))
dit(blocs.some(b => b.startsWith('Favoris')) && !blocs.some(b => /Gardés/.test(b)),
  'le bloc « Favoris » porte le nom du bouton de la carte (plus de « Gardés »)')
dit(blocs.some(b => /^Veto \d/.test(b)) && !blocs.some(b => /secret/i.test(b)),
  'le bloc s’appelle « Veto », sans « secret »')
const blocVeto = cl.locator('.groupe').filter({ has: page.locator('.entete strong', { hasText: /^Veto$/ }) })
await blocVeto.locator('.entete').click()
await page.waitForTimeout(400)
const txtVetos = await blocVeto.innerText()
dit(/Brandon/.test(txtVetos) && /non/.test(txtVetos), 'mon veto et son motif y sont')
dit(!/Jayden/.test(txtVetos), 'celui d’Alice n’y est pas')
await page.screenshot({ path: '/tmp/v2-meschoix.png' })

// ---------- 5. le veto depuis la carte de tri -----------------------------
await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
const cible = await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()
// la carte du fond a elle aussi ses boutons (inertes) : on vise celle de devant
const bVeto = page.locator('.carte.fiche:not(.derriere) .bas .rouge')
dit(await bVeto.count() === 1 && (await bVeto.innerText()).trim() === 'Veto',
    'le bouton « Veto » est sur la carte, avec son icône')
// Rouge = la couleur « non » de la charte, quelle que soit sa valeur exacte
// (elle a fonce pour passer le contraste AA : un essai qui figeait 196,86,79
// aurait interdit de corriger l'accessibilite).
const [couleur, rouge] = await bVeto.evaluate(el => {
  const t = document.createElement('span')
  t.style.color = 'var(--non)'; document.body.appendChild(t)
  const r = getComputedStyle(t).color; t.remove()
  return [getComputedStyle(el).color, r]
})
const [cr, cg, cb] = couleur.match(/\d+/g).map(Number)
dit(couleur === rouge && cr > cg + 60 && cr > cb + 60, `il est rouge, la couleur « non » de la charte (${couleur})`)
await bVeto.click()
await page.waitForSelector('.feuille-corps', { timeout: 6000 })
dit((await page.locator('.feuille-corps h2').first().innerText()) === 'Mettre un veto',
    'la confirmation s’ouvre : « Mettre un veto »')
// Deux raisons (déjà pris, autre raison) : ici, l'autre raison.
await page.locator('.feuille-corps').getByText('Autre raison', { exact: true }).click()
dit(await page.locator('.feuille-corps input.champ').count() === 1, 'avec un champ commentaire')
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/v3-veto.png' })
await page.locator('.feuille-corps input.champ').fill('trop connoté')
await page.locator('.rouge-plein').click()
await page.waitForTimeout(1600)
dit(await page.locator('.feuille-corps').count() === 0, 'la feuille se referme')
dit((await page.locator('.carte.fiche:not(.derriere) .nom').first().innerText()) !== cible,
    `${cible} a quitté la pile`)
const apres = await page.evaluate(() => fetch('/api/groupes/1').then(r => r.json()))
const pose = apres.mes_vetos.find(v => v.prenom === cible)
dit(!!pose && pose.motif === 'trop connoté', `le veto est en base avec son motif (${JSON.stringify(pose)})`)

await nav.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
