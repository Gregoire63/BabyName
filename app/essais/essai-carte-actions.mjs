/**
 * La carte de tri : ce qu'on y touche, et la place qu'elle prend.
 *
 * Ce qui se vérifie ici :
 *  - toucher la carte ouvre la fiche ; un glissement court ou un appui long,
 *    non ;
 *  - les trois gestes du bas sont dessinés ET nommés : « Infos »,
 *    « Non aux Maël… » (le début de prénom en clair, et combien il en
 *    balaierait), « Veto » ;
 *  - quand il n'y a rien à balayer de plus que le prénom, le geste du milieu
 *    s'efface sans déplacer les autres ;
 *  - la courbe prend la place qui reste sur un grand écran ; sur un petit,
 *    elle cède, et les gestes restent DANS la carte, au-dessus des boutons de
 *    vote ;
 *  - une carte chargée (Amaël : graphies, sens, nom de famille, origine,
 *    message de rareté) garde une vraie courbe : l'origine est montée à côté
 *    du genre, l'essai du nom tient sur une ligne. Sur 393×805, la courbe
 *    était tombée à 28 px, axe rogné. Plus serré encore, elle perd ses
 *    légendes au lieu de les voir coupées.
 */
import { lancer, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function ouvrir(largeur, hauteur) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, 'Paul')
  await page.waitForSelector('.bento', { timeout: 20000 })
  await page.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
  await page.waitForTimeout(700)
  return { ctx, page }
}
const devant = p => p.locator('.carte.fiche:not(.derriere)')
/** Pendant l'échange, deux cartes de devant coexistent un instant : on attend
 *  qu'il n'en reste qu'une. */
const posee = p => p.waitForFunction(() =>
  document.querySelectorAll('.carte.fiche:not(.derriere)').length === 1, null, { timeout: 5000 }).catch(() => {})
const nomDevant = async p => { await posee(p); return (await devant(p).locator('.nom').innerText()).trim() }
const ficheOuverte = p => p.locator('.voile .feuille').count()

// =================== 1. TOUCHER, GLISSER, APPUYER =========================
{
  const { ctx, page } = await ouvrir(390, 844)
  const avant = await nomDevant(page)
  await devant(page).locator('.nom').tap()
  await page.waitForTimeout(600)
  dit(await ficheOuverte(page) === 1, `toucher la carte ouvre la fiche de ${avant}`)
  dit((await page.locator('.voile .nom').first().innerText()).trim() === avant, 'la bonne')
  await page.getByRole('button', { name: 'Fermer la fiche' }).click()
  await page.waitForTimeout(600)

  // Un glissement court, relâché : ni fiche, ni vote.
  const b = await devant(page).locator('.nom').boundingBox()
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await page.mouse.move(x, y); await page.mouse.down()
  await page.mouse.move(x + 14, y, { steps: 3 }); await page.mouse.move(x + 30, y, { steps: 4 })
  await page.waitForTimeout(150); await page.mouse.up()
  await page.waitForTimeout(700)
  dit(await ficheOuverte(page) === 0 && await nomDevant(page) === avant,
    'un glissement court ne vote pas et n’ouvre rien')

  // Un appui long, sans bouger : on hésite, on ne demande rien.
  await page.mouse.move(x, y); await page.mouse.down()
  await page.waitForTimeout(650); await page.mouse.up()
  await page.waitForTimeout(600)
  dit(await ficheOuverte(page) === 0, 'un appui long n’ouvre pas la fiche')

  // =================== 2. LES GESTES DU BAS ================================
  const bas = devant(page).locator('.bas')
  dit(await bas.getByRole('button', { name: `Infos sur ${avant}` }).count() === 1
      && await bas.getByRole('button', { name: `Veto sur ${avant}` }).count() === 1,
    '« Infos » et « Veto » : nommés par ce qu’ils font, sur ce prénom')
  dit(await bas.locator('.outil svg').count() === 3, 'chacun avec son icône')

  // On cherche une carte avec un balayage possible, et une sans.
  let avecFamille = null, sansFamille = null
  for (let i = 0; i < 14 && !(avecFamille && sansFamille); i++) {
    await posee(page)
    const milieu = devant(page).locator('.bas .outil').nth(1)
    const vide = await milieu.evaluate(el => el.classList.contains('vide'))
    const nom = await nomDevant(page)
    if (vide && !sansFamille) {
      sansFamille = { nom, visible: await milieu.evaluate(el => getComputedStyle(el).visibility),
                      tab: await milieu.getAttribute('tabindex') }
    }
    if (!vide && !avecFamille) {
      avecFamille = { nom, etiquette: (await milieu.innerText()).trim(),
                      nomAccessible: await milieu.getAttribute('aria-label') }
    }
    await page.getByRole('button', { name: /^Neutre pour/ }).click()
    await page.waitForTimeout(700)
  }
  dit(!!avecFamille && /^Non aux \S+…$/.test(avecFamille.etiquette)
      && avecFamille.nomAccessible.startsWith(avecFamille.etiquette)
      && /\d+ prénoms qui commencent par/.test(avecFamille.nomAccessible),
    `le balayage dit son début de prénom et son nombre (${avecFamille?.nom} : « ${avecFamille?.nomAccessible} »)`)
  if (sansFamille) {
    dit(sansFamille.visible === 'hidden' && sansFamille.tab === '-1',
      `rien à balayer (${sansFamille.nom}) : le geste s’efface, sa place reste, le clavier ne s’y arrête pas`)
  } else console.log('   (aucune carte sans balayage dans les 14 premières)')

  // =================== 3. LA PLACE ========================================
  await posee(page)
  const courbe = await devant(page).locator('.graphe-corps').boundingBox()
  dit(courbe && courbe.height > 150, `grand écran : la courbe prend la place (${Math.round(courbe?.height)} px)`)
  await ctx.close()
}

{
  const { ctx, page } = await ouvrir(360, 640)
  await posee(page)
  const carte = await devant(page).boundingBox()
  const barre = await devant(page).locator('.bas').boundingBox()
  const vote = await page.locator('.boutons').boundingBox()
  dit(barre.y + barre.height <= carte.y + carte.height + 1 && barre.y + barre.height <= vote.y,
    `petit écran : les gestes restent dans la carte, au-dessus des boutons de vote (bas ${Math.round(barre.y + barre.height)} ≤ ${Math.round(carte.y + carte.height)}, vote à ${Math.round(vote.y)})`)
  const stat = devant(page).locator('.resume dd').first()
  dit(await stat.evaluate(el => el.scrollWidth <= el.clientWidth + 1),
    `le premier chiffre tient sans être coupé (« ${(await stat.innerText()).trim()} »)`)
  await ctx.close()
}

// =================== 4. UNE CARTE CHARGÉE =================================
async function carteChargee(largeur, hauteur) {
  const { ctx, page } = await ouvrir(largeur, hauteur)
  await page.evaluate(() => fetch('/api/groupes/1/nom-famille', { method: 'PUT',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nom: 'Raturat' }) }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 20000 })
  await page.getByRole('button', { name: 'Chercher un prénom' }).click()
  await page.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
  await page.locator('.feuille-corps input.chercher').fill('Amaël')
  await page.waitForTimeout(600)
  await page.locator('.trouve').filter({ has: page.locator('.nom:text-is("Amaël")') }).first().click()
  await page.waitForFunction(() => {
    const e = [...document.querySelectorAll('.carte.fiche:not(.derriere)')]
    return e.length === 1 && e[0].querySelector('.nom')?.textContent?.trim() === 'Amaël'
  }, null, { timeout: 8000 })
  await page.waitForTimeout(700)
  const m = await devant(page).evaluate(c => {
    const bas = c.querySelector('.milieu').getBoundingClientRect().bottom
    // « vue » : affichée en entier ; « rognée » : affichée mais coupée par le bas.
    const etat = s => {
      const e = c.querySelector(s)
      if (!e || getComputedStyle(e).display === 'none') return 'cachée'
      return e.getBoundingClientRect().bottom <= bas + 0.5 ? 'vue' : 'rognée'
    }
    const corps = c.querySelector('.graphe-corps').getBoundingClientRect()
    return {
      courbe: Math.round(Math.min(corps.bottom, bas) - corps.top),
      essai: Math.round(c.querySelector('.essai-nom').getBoundingClientRect().height),
      essaiTexte: c.querySelector('.essai-nom').innerText.replace(/\s+/g, ' ').trim(),
      enHaut: [...c.querySelectorAll('.tete .puce')].map(e => e.textContent.trim()),
      alerte: !!c.querySelector('.alerte'), tete: etat('.graphe-tete'), axe: etat('.graphe-axe')
    }
  })
  await ctx.close()
  return m
}
{
  // L'écran de la capture d'origine (Android, PWA) : la courbe y faisait 28 px.
  const m = await carteChargee(393, 805)
  dit(m.alerte && m.enHaut.includes('celtique') && m.enHaut[0] === 'garçon',
    `l’origine est en haut, à côté du genre (${m.enHaut.join(', ')}), le message de rareté est là`)
  dit(m.essaiTexte === 'Amaël Raturat rien n’accroche' && m.essai <= 40,
    `l’essai du nom tient sur une ligne, sans initiales ni compte (« ${m.essaiTexte} », ${m.essai} px)`)
  dit(m.courbe >= 70 && m.tete === 'vue' && m.axe === 'vue',
    `393×805 : la courbe garde ${m.courbe} px, avec sa tête et son axe`)
}
{
  const m = await carteChargee(360, 740)
  dit(m.courbe >= 50 && m.tete !== 'rognée' && m.axe !== 'rognée',
    `360×740 : ${m.courbe} px de courbe, légendes ${m.tete} / ${m.axe} (jamais coupées)`)
}

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
