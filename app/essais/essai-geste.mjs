import { lancer, entrerComme, glisserDuDoigt } from './navigateur.mjs'
const BASE = 'http://127.0.0.1:3100'
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }
const nav = await lancer()
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
await ctx.addInitScript(() => {
  const c = () => { const s = document.createElement('style')
    s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
    document.head?.appendChild(s) }
  if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
})
const page = await ctx.newPage()
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })

// ---------- 1. la tirette du bord droit ----------------------------------
// la tirette n'existe qu'une fois les listes chargees
await page.waitForSelector('.bento .grande .titre', { timeout: 20000 })
const tirette = page.locator('.tirette')
await tirette.waitFor({ timeout: 10000 }).catch(() => {})
dit(await tirette.count() === 1, 'une tirette sur le bord droit de l’accueil')
const nomTirette = (await tirette.innerText()).trim()
const grande = (await page.locator('.bento .grande').first().innerText()).trim()
dit(grande.includes(nomTirette), `la tirette porte la liste mise en avant : « ${nomTirette} »`)
const bt = await tirette.boundingBox()
await page.mouse.move(bt.x + bt.width / 2, bt.y + bt.height / 2)
await page.mouse.down()
for (let i = 1; i <= 8; i++) { await page.mouse.move(bt.x + bt.width / 2 - i * 12, bt.y + bt.height / 2); await page.waitForTimeout(12) }
await page.mouse.up()
await page.waitForSelector('.onglets button', { timeout: 20000 })
dit(page.url().includes('/g/'), 'la tirée depuis le bord droit ouvre la liste en cours')

// ---------- 2. « Mes autres listes » exclut la liste en cours ------------
await page.locator('.sortie').first().click()
await page.waitForSelector('.bento', { timeout: 20000 })
const nomMis = (await page.locator('.bento .grande .titre').first().innerText()).trim()
const autresNoms = await page.locator('.carte.large.passee strong').allInnerTexts().catch(() => [])
const doublon = autresNoms.filter(t => t.trim() === nomMis).length
dit(doublon === 0, doublon === 0
  ? `« ${nomMis} » est mise en avant et ne réapparaît pas dans les autres (${autresNoms.length} autres)`
  : `« ${nomMis} » est à la fois en avant et dans les autres listes`)

// ---------- 2 bis. le glissé parti d'ailleurs que du bord ------------------
// Sur Android, un glissé parti du bord de l'écran est le « retour » du
// système : la tirette n'en reçoit rien. On entre donc aussi dans la liste
// par un glissé vers la gauche parti de n'importe où — sans que faire défiler
// l'accueil, ou y sélectionner du texte, ouvre jamais rien.
{
  const aLAccueil = async () => { await page.waitForTimeout(700); return new URL(page.url()).pathname === '/' }
  const haut = () => page.evaluate(() => document.querySelector('main').scrollTop)
  // (Plus de tirette : on n'est plus sur l'accueil — l'essai le dira, sans s'arrêter là.)
  const tiree = () => page.evaluate(() => {
    const t = document.querySelector('.tirette')
    if (!t) return { x: null, armee: false }
    return { x: Math.round(new DOMMatrix(getComputedStyle(t).transform).m41), armee: t.classList.contains('armee') }
  })

  // Faire défiler : le navigateur s'en charge, et rien ne s'ouvre.
  await glisserDuDoigt(page, { x: 200, y: 620 }, { x: 204, y: 320 })
  const defile = await haut()
  dit(defile > 100 && await aLAccueil(), `faire défiler l’accueil le fait défiler (${Math.round(defile)} px), sans rien ouvrir`)
  await page.evaluate(() => document.querySelector('main').scrollTo(0, 0))

  // En biais, plus debout que couché : un défilement, pas notre geste.
  await glisserDuDoigt(page, { x: 300, y: 620 }, { x: 180, y: 380 })
  dit(await aLAccueil(), 'un glissé en biais, plus vertical qu’horizontal, n’ouvre rien')
  await page.evaluate(() => document.querySelector('main').scrollTo(0, 0))

  // Entre les deux : un glissé penché (40° environ), plus couché que debout.
  // Le navigateur le laisse à la page — il ne défile que pour un geste
  // surtout vertical — et c'est à elle de dire, dès ses premiers pixels,
  // qu'un geste aussi penché n'est pas celui qui ouvre la liste. Assez long
  // pour ouvrir s'il était pris : 100 px vers la gauche, 80 vers le bas.
  await page.evaluate(() => { document.querySelector('main').style.overflowY = 'hidden' })
  {
    const cdp = await ctx.newCDPSession(page)
    const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(300, 300) })
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(300 - i * 10, 300 + i * 8) }); await page.waitForTimeout(18) }
    await page.waitForTimeout(350)
    const penche = await tiree()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    dit(penche.x === 0 && !penche.armee && await aLAccueil(),
      `un glissé penché, de quoi ouvrir s’il était pris : la tirette ne bouge pas (${penche.x} px), rien ne s’ouvre`)
  }
  // Parti couché, puis franchement descendu : le doigt a changé d'avis.
  await glisserDuDoigt(page, { x: 300, y: 300 }, { x: 205, y: 560 }, { par: [{ x: 262, y: 302 }] })
  dit(await aLAccueil() && (await tiree()).x === 0, 'parti à l’horizontale puis franchement descendu : rien ne s’ouvre')
  await page.evaluate(() => { document.querySelector('main').style.overflowY = '' })

  // Vers la droite : il n'y a rien à gauche de l'accueil.
  await glisserDuDoigt(page, { x: 120, y: 400 }, { x: 300, y: 404 })
  dit(await aLAccueil() && (await tiree()).x === 0, 'un glissé vers la droite n’ouvre rien')

  // Trop court.
  await glisserDuDoigt(page, { x: 300, y: 400 }, { x: 250, y: 402 })
  dit(await aLAccueil() && (await tiree()).x === 0, 'un glissé trop court n’ouvre rien, et la tirette revient à sa place')

  // Le doigt encore posé : la tirette suit, et dit quand lâcher ouvrira.
  const cdp = await ctx.newCDPSession(page)
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(300, 400) })
  for (let x = 290; x >= 262; x -= 7) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, 401) }); await page.waitForTimeout(20) }
  await page.waitForTimeout(350)
  const peu = await tiree()
  for (let x = 250; x >= 180; x -= 10) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, 402) }); await page.waitForTimeout(20) }
  await page.waitForTimeout(350)
  const loin = await tiree()
  dit(peu.x < -20 && !peu.armee && loin.x <= -50 && loin.armee,
    `le doigt posé, la tirette suit (${peu.x} px puis ${loin.x} px) et dit quand lâcher ouvrira`)
  // … il se ravise, revient d'où il vient, et lâche : rien.
  for (let x = 200; x <= 290; x += 10) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x, 402) }); await page.waitForTimeout(20) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  const pasParti = await aLAccueil()
  const ravise = await tiree()
  dit(pasParti && ravise.x === 0 && !ravise.armee, 'il se ravise et revient avant de lâcher : rien ne s’ouvre')

  // Le système prend le geste pour lui (le « retour » d'Android) : annulé, rien.
  await glisserDuDoigt(page, { x: 300, y: 400 }, { x: 150, y: 404 }, { fin: 'annuler' })
  const resteLa = await aLAccueil()      // … le temps que la tirette revienne
  const annule = await tiree()
  dit(resteLa && annule.x === 0 && !annule.armee,
    `un geste que le système annule en route n’ouvre rien (tirette à ${annule.x} px${annule.armee ? ', encore armée' : ''}, ${new URL(page.url()).pathname})`)

  // À la souris, on sélectionne du texte en glissant : ce n'est pas le geste.
  await page.mouse.move(300, 400); await page.mouse.down()
  for (let i = 1; i <= 8; i++) { await page.mouse.move(300 - i * 20, 402); await page.waitForTimeout(12) }
  await page.mouse.up()
  dit(await aLAccueil(), 'glisser à la souris sur l’accueil n’ouvre rien')

  // Une feuille ouverte par-dessus : le geste est pour elle, pas pour l'accueil.
  await page.getByRole('button', { name: /^Mon compte/ }).click()
  await page.waitForSelector('.feuille-corps', { timeout: 8000 })
  await page.waitForTimeout(500)
  const corps = await page.locator('.feuille-corps').boundingBox()
  await glisserDuDoigt(page, { x: 300, y: corps.y + 60 }, { x: 150, y: corps.y + 64 })
  dit(await aLAccueil() && await page.locator('.feuille-corps').count() === 1,
    'glisser dans une feuille ouverte n’ouvre pas la liste derrière elle')
  await page.keyboard.press('Escape')
  await page.locator('.feuille-corps').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})

  // Et le geste lui-même, parti du milieu de l'écran — loin du bord que le système garde.
  await glisserDuDoigt(page, { x: 300, y: 400 }, { x: 160, y: 410 })
  await page.waitForSelector('.onglets button', { timeout: 20000 }).catch(() => {})
  dit(/\/g\/\d+\/swipe/.test(page.url()), 'un glissé vers la gauche, parti du milieu de l’écran, ouvre la liste en cours')
  await page.locator('.sortie').first().click()
  await page.waitForSelector('.bento', { timeout: 20000 })
}

// ---------- 3. le seuil : ce qui s'affiche est ce qui se fait ------------
await page.locator('.bento .grande').first().click()
await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
await page.waitForTimeout(500)

// On lit la carte VISIBLE, pas la premiere du DOM : pendant qu'elle s'envole,
// la carte votee reste un moment dans l'arbre, hors de l'ecran et a opacite 0.
// La lire donnait « rien n'a change » alors que le vote etait bien parti.
const devantVisible = () => page.evaluate(() => {
  const e = [...document.querySelectorAll('.carte.fiche:not(.derriere)')].find(el => {
    const st = getComputedStyle(el); const r = el.getBoundingClientRect()
    return +st.opacity > 0.5 && r.left > -40 && r.left < innerWidth / 2
  })
  return e?.querySelector('.nom')?.textContent?.trim() ?? null
})

async function glisser(px, pas = 14, attente = 14, sonder = true) {
  const nom = await devantVisible()
  const b = await page.locator('.carte.fiche:not(.derriere)').first().boundingBox()
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2
  await page.mouse.move(cx, cy); await page.mouse.down()
  let verdictA = null
  for (let x = pas; x <= px; x += pas) {
    await page.mouse.move(cx + x, cy)
    if (attente) await page.waitForTimeout(attente)
    // Sonder coute un aller-retour. Dans un flick, ce delai ferait passer le
    // geste pour un doigt a l'arret : on ne sonde pas les gestes vifs.
    if (sonder && !verdictA && await page.locator('.verdict').count()) verdictA = x
  }
  const avantUp = sonder ? await page.evaluate(() => {
    const e = document.querySelector('.carte.fiche:not(.derriere)')
    const tr = e ? getComputedStyle(e).transform : 'none'
    return { x: tr !== 'none' ? Math.round(+tr.split(',')[4]) : 0,
             verdict: document.querySelector('.verdict')?.textContent?.trim() ?? null }
  }) : { x: null, verdict: null }
  await page.mouse.up()
  await page.waitForTimeout(900)
  // on attend que la pile se soit immobilisee : deux lectures identiques
  let apres = await devantVisible()
  for (let k = 0; k < 12; k++) {
    await page.waitForTimeout(120)
    const n = await devantVisible()
    if (n && n === apres) break
    apres = n
  }
  return { nom, apres, change: nom !== apres, verdictA, avantUp }
}

const court = await glisser(30, 10, 60)
dit(!court.change, `30 px posés ne valident pas (${court.nom} reste)`)
const juste = await glisser(70, 10, 60)
dit(juste.change, `70 px valide : ${juste.nom} → ${juste.apres}, bandeau dès ${juste.verdictA} px, au relâché x=${juste.avantUp.x}`)
dit(juste.verdictA !== null && juste.verdictA <= 70,
    `le bandeau apparaît avant le seuil de validation (${juste.verdictA} px)`)
// Un vrai flick va a ~2 px/ms. page.mouse.move fait un aller-retour de 20-40 ms
// par pas : impossible d'aller aussi vite depuis l'exterieur. On emet donc les
// evenements depuis la page, avec la cadence d'un doigt reel (8 ms/trame).
const avantFlick = await devantVisible()
const mesure = await page.evaluate(async () => {
  const el = document.querySelector('.carte.fiche:not(.derriere)')
  const r = el.getBoundingClientRect()
  const x0 = r.x + r.width / 2, y = r.y + r.height / 2
  const env = (type, x) => el.dispatchEvent(new PointerEvent(type, {
    pointerId: 1, isPrimary: true, bubbles: true, cancelable: true,
    clientX: x, clientY: y, pointerType: 'touch' }))
  el.setPointerCapture = () => {}
  env('pointerdown', x0)
  const t0 = performance.now()
  let dx = 0
  // 40 px seulement : SOUS le seuil de 52. Si la carte part, c'est la vitesse
  // qui l'a validee, pas la distance — c'est tout l'objet de cet essai.
  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 0))
    dx = i * 8
    env('pointermove', x0 + dx)
  }
  const dt = performance.now() - t0
  env('pointerup', x0 + dx)
  return { dx, dt: Math.round(dt), v: +(dx / dt).toFixed(2) }
})
console.log(`   [flick] ${mesure.dx} px en ${mesure.dt} ms = ${mesure.v} px/ms`)
await page.waitForTimeout(1400)
const apresFlick = await devantVisible()
dit(apresFlick !== avantFlick,
    apresFlick !== avantFlick
      ? `un flick de ${mesure.dx} px (sous le seuil) à ${mesure.v} px/ms suffit : ${avantFlick} → ${apresFlick}`
      : `le flick de ${mesure.dx} px à ${mesure.v} px/ms n'a rien validé (${avantFlick})`)

// ---------- 4. jamais de trou derrière la carte --------------------------
const suivi = page.evaluate(() => new Promise(res => {
  const t0 = performance.now(); const f = []
  const tic = () => {
    const vus = [...document.querySelectorAll('.carte.fiche')].filter(e => {
      const st = getComputedStyle(e); const r = e.getBoundingClientRect()
      return +st.opacity > 0.04 && r.right > 8 && r.left < innerWidth - 8
    })
    f.push({ t: Math.round(performance.now() - t0),
             devant: vus.filter(e => !e.classList.contains('derriere')).length,
             fond: vus.filter(e => e.classList.contains('derriere')).length })
    if (performance.now() - t0 < 1500) requestAnimationFrame(tic); else res(f)
  }
  requestAnimationFrame(tic)
}))
await glisser(90, 14, 40)
const frames = await suivi
const trous = frames.filter(f => f.devant >= 1 && f.fond === 0)
dit(trous.length === 0, trous.length === 0
  ? `aucune trame sans carte derrière (${frames.length} trames)`
  : `${trous.length} trames avec une carte devant et rien derrière (${trous[0].t}–${trous[trous.length-1].t} ms)`)

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
console.log(`\n${ok.length} OK, ${ko.length} échecs`)
if (ko.length) { console.log('\nÉCHECS :'); ko.forEach(m => console.log(' - ' + m)) }
await nav.close()
process.exit(ko.length ? 1 : 0)
