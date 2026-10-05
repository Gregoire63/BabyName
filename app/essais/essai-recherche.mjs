/**
 * La recherche sous la loupe du tri, et les feuilles.
 *
 * Ce qui se vérifie ici :
 *  - la loupe du tri ouvre la recherche, curseur déjà dans le champ ;
 *  - la feuille est haute dès l'ouverture, le champ épinglé en haut : il ne
 *    bouge ni quand les résultats arrivent, ni quand on les fait défiler ;
 *  - un résultat n'a qu'une action : le toucher le met EN PREMIÈRE CARTE et
 *    referme la feuille — plus de votes ni de veto ligne par ligne ;
 *  - le prénom tapé en entier est le premier résultat, un prénom composé se
 *    tape avec son tiret ;
 *  - Entrée ne choisit rien : elle range le clavier et passe aux résultats
 *    (au clavier, une seconde Entrée choisit celui qui a le focus) ;
 *  - un prénom déjà jugé revient aussi, la carte dit ce qu'on en avait dit,
 *    et le rejuger remplace l'ancien vote ; un prénom sous veto ne se propose
 *    pas ;
 *  - au bout du quota, le prénom choisi attend son tour (retenu) ;
 *  - le bouton Filtres est une icône, et la feuille Filtres n'a plus de
 *    champ de recherche ;
 *  - les résultats suivent chaque lettre, même quand le clavier (Android)
 *    compose encore le mot — c'est ce qui les « cachait sous le clavier » ;
 *  - quand le clavier sort, champ et résultats restent au-dessus : qu'il se
 *    pose sur la page (iPhone), que le navigateur le dise autrement, ou qu'il
 *    ne dise rien du tout ; faire défiler les résultats le range ;
 *  - la feuille et la fiche se referment en glissant, pas d'un coup.
 */
import { lancer, onglet, compteur, BASE, entrerComme, composer, glisser } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function entrer(qui, initialisation) {
  const { ctx, page } = await onglet(nav)
  if (initialisation) await ctx.addInitScript(initialisation)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
  return page
}
const posee = p => p.waitForFunction(() =>
  document.querySelectorAll('.carte.fiche:not(.derriere)').length === 1, null, { timeout: 5000 }).catch(() => {})
const devant = p => p.locator('.carte.fiche:not(.derriere)')
const nomDevant = async p => { await posee(p); return (await devant(p).locator('.nom').innerText()).trim() }
const ouvrirRecherche = async p => {
  await p.getByRole('button', { name: 'Chercher un prénom' }).click()
  await p.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
  await p.waitForTimeout(400)
}
const ligne = (p, nom) => p.locator('.trouve').filter({ has: p.locator(`.nom:text-is("${nom}")`) })
const mesVotes = p => p.evaluate(() => fetch('/api/groupes/1/votes').then(r => r.json()))

/** Suit une fermeture image par image : en mouvement juste après le geste, partie ensuite. */
async function suivreFermeture(p, sel, declencher) {
  const releves = p.evaluate((s) => new Promise(ok => {
    const t0 = performance.now(), out = []
    const tic = () => {
      const el = document.querySelector(s)
      const m = el ? new DOMMatrix(getComputedStyle(el).transform) : null
      out.push({ t: Math.round(performance.now() - t0), la: !!el, y: m ? Math.round(m.m42) : null })
      if (performance.now() - t0 < 700) requestAnimationFrame(tic); else ok(out)
    }
    requestAnimationFrame(tic)
  }), sel)
  await declencher()
  const r = await releves
  return { r, glisse: r.filter(x => x.la && x.y > 20).length >= 3, partie: !r[r.length - 1].la }
}

// =================== 1. LA LOUPE, LES FILTRES ==============================
const page = await entrer('Paul')
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
await devant(page).locator('.nom').first().waitFor({ timeout: 25000 })
await page.waitForTimeout(500)

const loupe = page.getByRole('button', { name: 'Chercher un prénom' })
const boite = await loupe.boundingBox()
dit(!!boite && boite.x + boite.width > 390 - 40 && boite.y < 90,
  `la loupe est dans le coin haut droit (x=${Math.round(boite?.x)}, y=${Math.round(boite?.y)})`)
const filtres = page.getByRole('button', { name: /^Filtres/ })
dit(await filtres.locator('svg').count() === 1 && (await filtres.innerText()).trim() === '',
  'le bouton Filtres est une icône')
await filtres.click()
await page.waitForSelector('.feuille-corps', { timeout: 6000 })
dit(await page.locator('.feuille-corps input[type="search"], .feuille-corps input[placeholder*="prénom"]').count() === 0,
  'la feuille Filtres n’a plus de champ « Chercher un prénom »')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

await ouvrirRecherche(page)
dit(await page.evaluate(() => document.activeElement?.classList.contains('chercher')),
  'la recherche s’ouvre curseur dans le champ')
const yChamp = p => p.evaluate(() => Math.round(document.querySelector('input.chercher').getBoundingClientRect().top))
const aLOuverture = await yChamp(page)
dit(aLOuverture < 844 / 4,
  `la feuille est haute dès l’ouverture : le champ est en haut de l’écran (y=${aLOuverture})`)
dit(await page.locator('#recherche-aide').isVisible(), 'vide, elle dit où elle cherche')

// =================== 2. TOUCHER = PREMIÈRE CARTE ============================
await page.locator('input.chercher').fill('anatole')
await page.waitForTimeout(400)
dit(await yChamp(page) === aLOuverture && !await page.locator('#recherche-aide').isVisible(),
  `les résultats arrivent sous le champ, qui ne bouge pas (y=${await yChamp(page)})`)
const anatole = ligne(page, 'Anatole')
dit(await anatole.count() === 1 && await anatole.locator('.trio, button.veto').count() === 0,
  'un résultat n’a plus ni votes ni veto : une seule ligne à toucher')
await anatole.click()
await page.waitForTimeout(700)
dit(await page.locator('.feuille-corps').count() === 0, 'le toucher referme la feuille')
dit(await nomDevant(page) === 'Anatole', `et Anatole passe en première carte (${await nomDevant(page)})`)
await page.getByRole('button', { name: 'Oui à Anatole' }).click()
await page.waitForTimeout(900)
dit((await mesVotes(page)).votes.some(v => v.prenom === 'Anatole' && v.valeur === 2),
  'on le juge d’un geste, comme une autre carte')

// =================== 2 bis. LE PRÉNOM TAPÉ, ET ENTRÉE ======================
const premiers = async (p, n = 3) => (await p.locator('.resultats li .nom').allInnerTexts()).slice(0, n).map(x => x.trim())
await ouvrirRecherche(page)
await page.locator('input.chercher').fill('jean-b')
await page.waitForTimeout(400)
dit(await ligne(page, 'Jean-Baptiste').count() === 1, 'un prénom composé se tape avec son tiret (« jean-b »)')
await page.locator('input.chercher').fill('mari')
await page.waitForTimeout(400)
dit((await premiers(page, 1))[0] === 'Mari',
  `un prénom rare tapé en entier est trouvé, en tête (« mari » : ${(await premiers(page)).join(', ')})`)
await page.locator('input.chercher').fill('lou')
await page.waitForTimeout(400)
dit((await premiers(page, 1))[0] === 'Lou',
  `le prénom tapé en entier passe avant les plus donnés (« lou » : ${(await premiers(page)).join(', ')})`)

const avantEntree = await nomDevant(page)
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
dit(await page.locator('.feuille-corps').count() === 1 && await nomDevant(page) === avantEntree,
  `Entrée ne choisit rien : la feuille reste, la première carte aussi (${avantEntree})`)
const focus = await page.evaluate(() => {
  const a = document.activeElement
  return { resultat: !!a?.classList.contains('trouve'), nom: a?.querySelector('.nom')?.textContent.trim() ?? null }
})
dit(focus.resultat && focus.nom === 'Lou',
  `elle range le clavier et passe au premier résultat (focus : ${focus.nom})`)
await page.keyboard.press('Enter')
await page.waitForTimeout(700)
dit(await page.locator('.feuille-corps').count() === 0 && await nomDevant(page) === 'Lou',
  'au clavier, une seconde Entrée choisit le résultat qui a le focus')

// =================== 3. DÉJÀ JUGÉ : ON LE REJUGE ===========================
await ouvrirRecherche(page)
await page.locator('input.chercher').fill('colette')
await page.waitForTimeout(400)
dit((await ligne(page, 'Colette').locator('.puce').allInnerTexts()).includes('Oui'),
  'la ligne dit ce qu’on en a déjà dit (Colette : Oui)')
await ligne(page, 'Colette').click()
await page.waitForTimeout(800)
dit(await nomDevant(page) === 'Colette', 'un prénom déjà jugé revient quand même en première carte')
dit(/Vous aviez dit oui/.test(await devant(page).locator('.deja').innerText().catch(() => '')),
  'et la carte rappelle ce qu’on en avait dit')
await page.getByRole('button', { name: 'Neutre pour Colette' }).click()
await page.waitForTimeout(1100)
const moi = (await page.evaluate(() => fetch('/api/groupes/1').then(r => r.json()))).moi.user_id
const colette = (await mesVotes(page)).votes.find(v => v.prenom === 'Colette' && v.user_id === moi)
dit(colette?.valeur === 1, `le nouveau vote remplace l’ancien (Colette : ${colette?.valeur})`)
dit(await nomDevant(page) !== 'Colette', 'et la carte passe')

await ouvrirRecherche(page)
await page.locator('input.chercher').fill('brandon')
await page.waitForTimeout(400)
const brandon = ligne(page, 'Brandon')
dit(await brandon.count() === 1 && await brandon.evaluate(el => el.tagName) !== 'BUTTON'
    && (await brandon.locator('.puce').innerText()).trim() === 'Veto',
  'un prénom sous veto est affiché comme tel, sans rien à toucher')

// =================== 4. LA FERMETURE GLISSE ================================
const f1 = await suivreFermeture(page, '.feuille-corps',
  () => page.getByRole('button', { name: 'Fermer', exact: true }).click())
dit(f1.glisse && f1.partie,
  `la feuille descend avant de disparaître (${f1.r.filter(x => x.la).map(x => x.y).join(' → ')} px)`)
await page.waitForTimeout(300)
await devant(page).getByRole('button', { name: /^Infos sur / }).click()
await page.waitForSelector('.voile .feuille', { timeout: 6000 })
await page.waitForTimeout(450)
const f2 = await suivreFermeture(page, '.voile .feuille',
  () => page.getByRole('button', { name: 'Fermer la fiche' }).click())
dit(f2.glisse && f2.partie, `la fiche aussi (${f2.r.filter(x => x.la).map(x => x.y).join(' → ')} px)`)

// =================== 5. AU BOUT DU QUOTA, LE PRÉNOM ATTEND ================
await page.goto(`${BASE}/g/2/swipe`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.evaluate(async () => {
  for (const p of ['Iris', 'Jeanne', 'Adèle', 'Margot', 'Rose', 'Zoé']) {
    const r = await fetch('/api/groupes/2/vote', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prenom: p, valeur: 2 }) })
    if (r.status === 402) break
  }
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await ouvrirRecherche(page)
await page.locator('input.chercher').fill('gaspard')
await page.waitForTimeout(400)
await ligne(page, 'Gaspard').click()
await page.waitForTimeout(700)
dit(await page.locator('.vide', { hasText: 'aujourd’hui' }).count() === 1
    && await page.evaluate(() => localStorage.getItem('pr_epingle_2')) === 'Gaspard',
  'au bout du quota, le mur reste, et Gaspard est retenu pour la prochaine fois')

// =================== 6. LE CLAVIER =========================================
const CLAVIER = 336
/** Un clavier simulé : selon le navigateur, il ne s'annonce pas de la même façon. */
const CLAVIERS = {
  // iPhone : il se pose sur la page, seule la « vue visible » rétrécit.
  iphone: () => {
    const vv = new EventTarget(); let k = 0
    Object.defineProperty(vv, 'height', { get: () => window.innerHeight - k })
    Object.defineProperty(vv, 'offsetTop', { get: () => 0 })
    Object.defineProperty(vv, 'scale', { get: () => 1 })
    Object.defineProperty(vv, 'width', { get: () => window.innerWidth })
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
    window.__clavier = (h) => { k = h; vv.dispatchEvent(new Event('resize')) }
  },
  // La vue visible rétrécit et innerHeight la suit, sans que la page soit
  // redimensionnée (Firefox sur iPhone, des navigateurs intégrés) : comparer
  // innerHeight à la vue visible ne voit rien.
  suiveur: () => {
    const vv = new EventTarget(); let k = 0
    const ih = Object.getOwnPropertyDescriptor(window, 'innerHeight')
      || Object.getOwnPropertyDescriptor(Window.prototype, 'innerHeight')
    const vrai = () => ih.get.call(window)
    Object.defineProperty(window, 'innerHeight', { get: () => vrai() - k, configurable: true })
    Object.defineProperty(vv, 'height', { get: () => vrai() - k })
    Object.defineProperty(vv, 'offsetTop', { get: () => 0 })
    Object.defineProperty(vv, 'scale', { get: () => 1 })
    Object.defineProperty(vv, 'width', { get: () => window.innerWidth })
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
    window.__clavier = (h) => { k = h; vv.dispatchEvent(new Event('resize')) }
  },
  // Le navigateur ne dit rien : ni page redimensionnée, ni vue visible à jour.
  muet: () => { window.__clavier = () => {} }
}
/** Où sont la feuille, le champ et les résultats, face à un clavier de `k` px. */
const releve = (p, k) => p.evaluate((k) => {
  const H = document.documentElement.clientHeight, bord = H - k
  const c = document.querySelector('.feuille-corps').getBoundingClientRect()
  const ch = document.querySelector('.feuille-corps input.chercher').getBoundingClientRect()
  const lignes = [...document.querySelectorAll('.resultats li')].map(l => l.getBoundingClientRect())
  return { haut: Math.round(c.top), bas: Math.round(c.bottom), bord, ecran: H,
    champ: Math.round(ch.top), champBas: Math.round(ch.bottom),
    lisibles: lignes.filter(r => r.top >= ch.bottom - 1 && r.bottom <= bord + 1).length, lignes: lignes.length }
}, k)
async function devantLaRecherche(clavier, taille) {
  const p = await entrer('Paul', CLAVIERS[clavier])
  if (taille) await p.setViewportSize(taille)
  // Par l'accueil, comme au premier bloc : c'est le chemin que prend l'app.
  await p.locator('a.carte', { hasText: 'Notre liste' }).first().click()
  const vue = await devant(p).locator('.nom').first().waitFor({ timeout: 30000 }).then(() => true, () => false)
  if (!vue) {
    await p.screenshot({ path: `/tmp/essai-recherche-${clavier}.png` })
    console.log(`   [${clavier}]`, p.url(), (await p.locator('main, body').first().innerText()).slice(0, 300).replace(/\s+/g, ' '))
  }
  await ouvrirRecherche(p)
  return p
}

// ---- 6a. Android : le clavier COMPOSE le mot, il ne le valide qu'en se rangeant
const android = await devantLaRecherche('muet')
await android.locator('input.chercher').focus()
const mot = await composer(android, 'ma')
const enCours = await android.evaluate(() => ({ champ: document.querySelector('input.chercher').value,
  lignes: document.querySelectorAll('.resultats li').length }))
dit(enCours.champ === 'ma' && enCours.lignes > 0,
  `le clavier compose encore « ${enCours.champ} » : les résultats sont déjà là (${enCours.lignes})`)
const carteAndroid = await nomDevant(android)
await mot.valider()
await android.keyboard.press('Enter')
await android.waitForTimeout(600)
dit(await android.locator('.feuille-corps').count() === 1 && await nomDevant(android) === carteAndroid
    && await android.evaluate(() => !!document.activeElement?.classList.contains('trouve')),
  'et la touche « rechercher » ne prend plus le premier : la feuille reste, les résultats sous les yeux')
await android.context().close()

// ---- 6b. iPhone : le clavier se pose sur la page
const iphone = await devantLaRecherche('iphone')
const sansClavier = await releve(iphone, 0)
await iphone.evaluate(k => window.__clavier(k), CLAVIER)
await iphone.waitForTimeout(300)
const sorti = await releve(iphone, CLAVIER)
dit(sorti.champ === sansClavier.champ,
  `le clavier sort : le champ ne saute pas (y=${sansClavier.champ} → ${sorti.champ})`)
await iphone.locator('input.chercher').fill('ma')
await iphone.waitForTimeout(400)
const vue = await releve(iphone, CLAVIER)
dit(vue.bas <= vue.bord + 1 && vue.haut >= 0 && vue.champ === sorti.champ,
  `la feuille tient au-dessus du clavier (bas ${vue.bas} ≤ ${vue.bord}), le champ toujours à y=${vue.champ}`)
dit(vue.lisibles >= 3, `et ${vue.lisibles} résultats se lisent entre le champ et le clavier`)

await iphone.evaluate(() => { document.querySelector('.feuille-dedans').scrollTop = 400 })
await iphone.waitForTimeout(150)
const defile = await iphone.evaluate(() => ({ y: Math.round(document.querySelector('input.chercher').getBoundingClientRect().top),
  liste: Math.round(document.querySelector('.feuille-dedans').scrollTop) }))
dit(defile.liste > 0 && defile.y === vue.champ,
  `la liste défile sous le champ, qui reste en place (liste à ${defile.liste} px, champ à y=${defile.y})`)
await iphone.locator('input.chercher').fill('mar')
await iphone.waitForTimeout(400)
dit(await iphone.evaluate(() => document.querySelector('.feuille-dedans').scrollTop) === 0,
  'une lettre de plus : les nouveaux résultats se lisent depuis le premier')

dit(await iphone.evaluate(() => document.activeElement?.classList.contains('chercher')), 'le curseur est encore dans le champ')
await glisser(iphone, '.resultats', -110)
await iphone.waitForTimeout(200)
dit(await iphone.evaluate(() => !document.activeElement?.classList.contains('chercher'))
    && await iphone.locator('.feuille-corps').count() === 1,
  'faire défiler les résultats range le clavier (le champ rend le focus), sans rien choisir')
await iphone.evaluate(() => window.__clavier(0))
await iphone.waitForTimeout(300)
const rentre = await releve(iphone, 0)
dit(rentre.bas >= rentre.ecran - 1 && rentre.champ === vue.champ,
  'clavier rentré : la feuille redescend jusqu’en bas, le champ n’a toujours pas bougé')
await iphone.context().close()

// ---- 6c. le navigateur fait suivre innerHeight : le clavier est vu quand même
const suiveur = await devantLaRecherche('suiveur')
await suiveur.evaluate(k => window.__clavier(k), CLAVIER)
await suiveur.locator('input.chercher').fill('ma')
await suiveur.waitForTimeout(500)
const s2 = await releve(suiveur, 0)   // innerHeight ment ici : le bord se compte à la main
dit(s2.bas <= 844 - CLAVIER + 1 && s2.champ === sansClavier.champ,
  `innerHeight qui suit la vue visible : la feuille s’arrête quand même au clavier (bas ${s2.bas} ≤ ${844 - CLAVIER})`)
await suiveur.context().close()

// ---- 6d. le navigateur ne dit rien : c'est la mise en page qui tient
const muet = await devantLaRecherche('muet')
await muet.locator('input.chercher').fill('adel')
await muet.waitForTimeout(400)
const m = await releve(muet, CLAVIER)
dit(m.champBas < m.bord && m.lisibles >= 3,
  `clavier que rien n’annonce : le champ (y=${m.champ}) et ${m.lisibles} résultats restent au-dessus`)
await muet.locator('input.chercher').fill('gasp')
await muet.waitForTimeout(400)
const peu = await releve(muet, CLAVIER)
dit(peu.lignes > 0 && peu.lignes <= 3 && peu.lisibles === peu.lignes && peu.champ === m.champ,
  `peu de résultats (${peu.lignes}) : ils ne tombent pas derrière le clavier, et le champ n’a pas bougé`)
await muet.context().close()

// ---- 6e. petit écran : la feuille prend toute la place que laisse le clavier
const petit = await devantLaRecherche('iphone', { width: 360, height: 560 })
await petit.evaluate(() => window.__clavier(250))
await petit.locator('input.chercher').fill('ma')
await petit.waitForTimeout(400)
const pt = await releve(petit, 250)
dit(pt.haut <= 13 && pt.bas <= pt.bord + 1 && pt.lisibles >= 3,
  `petit écran (360×560, clavier de 250) : la feuille monte jusqu’en haut (y=${pt.haut}), ${pt.lisibles} résultats lisibles`)
await petit.context().close()

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
