/**
 * La recherche sous la loupe du tri, et les feuilles qui se referment en
 * descendant.
 *
 * Ce qui se vérifie ici :
 *  - la loupe du tri ouvre la recherche, curseur déjà dans le champ ;
 *  - on y juge, avec des boutons qui disent à quel prénom ils répondent, et
 *    le tri suit (le prénom jugé quitte la pile) ;
 *  - on y pose un veto, confirmé sur place (motif, compte des vetos), et on
 *    le lève ; un observateur n'a pas le bouton ;
 *  - une liste gratuite au bout de son quota le DIT, au lieu d'échouer en
 *    silence ;
 *  - la feuille et la fiche se referment en glissant, pas d'un coup.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
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
  return page
}
const devant = p => p.locator('.carte.fiche:not(.derriere) .nom').first()
const ouvrirRecherche = async p => {
  await p.getByRole('button', { name: 'Chercher un prénom' }).click()
  await p.waitForSelector('.feuille-corps input.chercher', { timeout: 8000 })
}
const ligne = (p, nom) => p.locator('.trouve').filter({ has: p.locator(`.nom:text-is("${nom}")`) })

/**
 * Suit une fermeture image par image : présente et en mouvement juste après
 * le geste, partie ensuite. `sel` est la boîte qui doit descendre.
 */
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
  const pendant = r.filter(x => x.la && x.y > 20)
  const fin = r[r.length - 1]
  return { r, glisse: pendant.length >= 3, partie: !fin.la }
}

// =================== 1. LA LOUPE ========================================
const page = await entrer('DEVG-REGX-2345')
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
await devant(page).waitFor({ timeout: 25000 })
await page.waitForTimeout(500)

const loupe = page.getByRole('button', { name: 'Chercher un prénom' })
const boite = await loupe.boundingBox()
dit(!!boite && boite.x + boite.width > 390 - 40 && boite.y < 90,
  `la loupe est dans le coin haut droit (x=${Math.round(boite?.x)}, y=${Math.round(boite?.y)})`)
await ouvrirRecherche(page)
await page.waitForTimeout(450)
dit(await page.evaluate(() => document.activeElement?.classList.contains('chercher')),
  'le curseur est déjà dans le champ')
dit(await page.locator('.pager section:nth-child(3) input.chercher').count() === 0,
  'la recherche n’est plus dans les réglages')

// =================== 2. JUGER DEPUIS LA RECHERCHE ========================
await page.locator('input.chercher').fill('louise')
await page.waitForTimeout(400)
const louise = ligne(page, 'Louise')
dit(await louise.count() === 1, 'Louise est trouvée')
dit((await louise.locator('.puce').allInnerTexts()).includes('Oui'), 'avec ce que Greg en a dit : Oui')
dit(await louise.getByRole('button', { name: 'Oui à Louise' }).getAttribute('aria-pressed') === 'true',
  'les boutons disent à quel prénom ils répondent, et lequel est choisi')

// Le prénom de devant, jugé depuis la recherche, quitte la pile.
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
const cible = (await devant(page).innerText()).trim()
await ouvrirRecherche(page)
await page.locator('input.chercher').fill(cible)
await page.waitForTimeout(400)
await ligne(page, cible).getByRole('button', { name: `Non à ${cible}` }).click()
await page.waitForTimeout(900)
dit((await ligne(page, cible).locator('.puce').allInnerTexts()).includes('Non'),
  `${cible} passe à Non`)
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
dit((await devant(page).innerText()).trim() !== cible, `et quitte le tri (${cible} → ${(await devant(page).innerText()).trim()})`)

// =================== 3. LE VETO, CONFIRME SUR PLACE ======================
await ouvrirRecherche(page)
await page.locator('input.chercher').fill('hector')
await page.waitForTimeout(400)
const hector = ligne(page, 'Hector')
await hector.getByRole('button', { name: 'Veto sur Hector' }).click()
const confirme = page.locator('.confirme-veto')
await confirme.waitFor({ timeout: 4000 })
const texte = (await confirme.innerText()).replace(/\s+/g, ' ')
dit(/définitif/.test(texte) && /Personne ne verra/.test(texte), 'le veto se confirme, avec ce qu’il engage')
dit(/Il vous en reste 2 sur 3/.test(texte), `et ce qu’il en reste (« ${texte.match(/Il vous en reste[^.]*/)?.[0]} »)`)
await confirme.locator('input.champ').fill('trop sévère')
await confirme.getByRole('button', { name: 'Poser mon veto sur Hector' }).click()
await page.waitForTimeout(1200)
dit((await hector.locator('.puce').allInnerTexts()).includes('Veto'), 'Hector porte maintenant « Veto »')
const apresVeto = await page.evaluate(() => fetch('/api/groupes/1').then(r => r.json()))
dit(apresVeto.mes_vetos.some(v => v.prenom === 'Hector' && v.motif === 'trop sévère'),
  'le veto est en base, avec son motif')
await hector.getByRole('button', { name: 'Lever mon veto sur Hector' }).click()
await page.waitForTimeout(1200)
const leve = await page.evaluate(() => fetch('/api/groupes/1').then(r => r.json()))
dit(!leve.mes_vetos.some(v => v.prenom === 'Hector'), 'et il se lève d’ici aussi')

// =================== 4. LA FERMETURE GLISSE ==============================
const f1 = await suivreFermeture(page, '.feuille-corps',
  () => page.getByRole('button', { name: 'Fermer', exact: true }).click())
dit(f1.glisse && f1.partie,
  `la feuille descend avant de disparaître (${f1.r.filter(x => x.la).map(x => x.y).join(' → ')} px)`)

await ouvrirRecherche(page)
await page.locator('input.chercher').fill('jeanne')
await page.waitForTimeout(400)
await ligne(page, 'Jeanne').locator('.nom').click()
await page.waitForSelector('.voile .feuille', { timeout: 6000 })
await page.waitForTimeout(450)
const f2 = await suivreFermeture(page, '.voile .feuille',
  () => page.getByRole('button', { name: 'Fermer la fiche' }).click())
dit(f2.glisse && f2.partie,
  `la fiche aussi (${f2.r.filter(x => x.la).map(x => x.y).join(' → ')} px)`)
dit(await page.locator('.feuille-corps input.chercher').count() === 1,
  'et on retrouve la recherche dessous')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

// =================== 5. LE QUOTA SE DIT ==================================
await page.goto(`${BASE}/g/2/swipe`, { waitUntil: 'networkidle' })
await devant(page).waitFor({ timeout: 20000 }).catch(() => null)
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
await ligne(page, 'Gaspard').getByRole('button', { name: 'Oui à Gaspard' }).click()
const alerte = page.locator('.feuille-corps [role="alert"]')
await alerte.waitFor({ timeout: 5000 }).catch(() => null)
dit(/prénoms du jour sont jugés/.test(await alerte.innerText().catch(() => '')),
  'au bout du quota, la recherche le dit au lieu d’échouer en silence')
dit(!(await ligne(page, 'Gaspard').locator('.puce').allInnerTexts()).includes('Oui'),
  'et le vote n’apparaît pas comme fait')

// =================== 6. UN OBSERVATEUR N'A PAS DE VETO ===================
const mamie = await entrer('DEVM-AMIE-2345')
await mamie.goto(`${BASE}/g/1/swipe`, { waitUntil: 'networkidle' })
await devant(mamie).waitFor({ timeout: 20000 })
await ouvrirRecherche(mamie)
await mamie.locator('input.chercher').fill('mar')
await mamie.waitForTimeout(400)
dit(await mamie.locator('.trouve').count() > 0 && await mamie.locator('.trouve button.veto').count() === 0,
  'une observatrice cherche et juge, mais n’a pas de bouton veto')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
