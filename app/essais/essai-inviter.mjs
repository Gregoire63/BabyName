/**
 * Partager la liste depuis sa carte, sur l'accueil : le bouton « Partager »
 * et sa feuille de partage rapide (25/10).
 *
 *  1. Le bouton est SUR la carte de la liste en cours (pas dans son lien), ne
 *     cache aucun texte, et s'ouvre sans entrer dans la liste.
 *  2. La feuille dit le code de CETTE liste ; « Partager le lien » donne
 *     /rejoindre/<code> à la feuille de partage du téléphone ; sans elle, le
 *     lien est copié et le bouton le dit.
 *  3. Seul à décider : pas d'avertissement. À deux : l'avertissement d'un
 *     membre de plus est dit dans la feuille, AVANT l'envoi, et propose la
 *     lecture seule — qui donne le lien des observateurs.
 *  4. Lecture seule sur une liste gratuite : la feuille renvoie au déblocage,
 *     dans la liste.
 *  5. Un glissé à la souris sur le bouton n'ouvre rien.
 *  6. Un observateur n'a pas le bouton ; en anglais, il parle anglais.
 *  7. Les réglages gardent la même carte d'invitation (même composant).
 *  8. Le serveur compte les décideurs à part, et ne donne les codes qu'aux
 *     décideurs.
 */
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

async function entrer(pseudo) {
  const { ctx, page } = await onglet(nav)
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  // La feuille de partage du téléphone, tenue ici : ce qu'on lui a donné.
  await ctx.addInitScript(() => {
    window.__partages = []
    if (!localStorage.getItem('sans_partage')) {
      navigator.share = async d => { window.__partages.push(d) }
    } else {
      try { delete Navigator.prototype.share } catch { /* rien */ }
      navigator.share = undefined
    }
  })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, pseudo)
  await page.waitForSelector('.bento', { timeout: 20000 })
  return { ctx, page }
}

/** Met `gid` en avant sur l'accueil (la liste « en cours » de l'appareil). */
async function accueilSur(page, gid) {
  await page.evaluate(id => localStorage.setItem('bn_liste_courante', id), gid)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.bento .grande .titre', { timeout: 20000 })
}

const feuille = p => p.locator('.feuille-corps[role=dialog]')
async function ouvrirFeuille(p) {
  await p.locator('.bento .carte-liste button.partager').click()
  await feuille(p).waitFor({ timeout: 8000 })
  await p.waitForTimeout(400)
}
async function fermerFeuille(p) {
  await p.keyboard.press('Escape')
  await feuille(p).waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
}
const nbPartages = p => p.evaluate(() => window.__partages.length)

// ---------- Paul -----------------------------------------------------------
const { page } = await entrer('Paul')
let listes = await page.evaluate(() => fetch('/api/groupes').then(r => r.json()))
const notre = listes.find(l => l.nom === 'Notre liste')
dit(notre && Number(notre.nb_decideurs) === 2 && Number(notre.nb_membres) === 3,
  `serveur : « Notre liste » compte 2 décideurs sur 3 membres (Mamie observe) — ${notre?.nb_decideurs}/${notre?.nb_membres}`)
dit(notre?.code_invitation && notre?.code_observateur, 'serveur : un décideur reçoit les deux codes')

// Une liste à lui seul (gratuite).
const seule = await page.evaluate(() => fetch('/api/groupes', { method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ filtres: {}, nom: 'Rien qu’à moi' }) }).then(r => r.json()))
listes = await page.evaluate(() => fetch('/api/groupes').then(r => r.json()))
const solo = listes.find(l => l.id === String(seule.id))
dit(solo && Number(solo.nb_decideurs) === 1 && solo.code_invitation && !solo.paye,
  'serveur : une liste neuve, un décideur, un code, gratuite')

// 1. le bouton, sur la carte
await accueilSur(page, solo.id)
const bouton = page.locator('.bento .carte-liste button.partager')
dit(await bouton.count() === 1, 'un bouton « Partager » sur la carte de la liste en cours')
dit((await bouton.innerText()).trim() === 'Partager'
  && await bouton.getAttribute('aria-label') === 'Partager « Rien qu’à moi »'
  && await bouton.getAttribute('aria-haspopup') === 'dialog',
  `… nommé « Partager », pour la voix « ${await bouton.getAttribute('aria-label')} », et annoncé comme ouvrant une fenêtre`)
dit(await page.locator('.bento a.grande button').count() === 0, '… posé sur la carte, pas dans son lien')

/** Le bouton tient dans la carte, et ne cache aucun mot de sa dernière ligne. */
async function placement() {
  return page.evaluate(() => {
    const carte = document.querySelector('.bento a.grande').getBoundingClientRect()
    const btn = document.querySelector('.bento button.partager').getBoundingClientRect()
    const r = document.createRange(); r.selectNodeContents(document.querySelector('.bento a.grande .dernier'))
    const chevauche = [...r.getClientRects()].some(m => m.right > btn.left && m.left < btn.right && m.bottom > btn.top && m.top < btn.bottom)
    return { dedans: btn.left >= carte.left && btn.right <= carte.right && btn.top >= carte.top && btn.bottom <= carte.bottom,
      chevauche, h: Math.round(btn.height) }
  })
}
for (const larg of [390, 320]) {
  await page.setViewportSize({ width: larg, height: 844 })
  await page.waitForTimeout(200)
  const pl = await placement()
  dit(pl.dedans && !pl.chevauche && pl.h >= 40, `${larg} px : dans la carte, rien de caché dessous, ${pl.h} px de haut`)
}
await page.setViewportSize({ width: 390, height: 844 })

// 2. la feuille
await ouvrirFeuille(page)
dit(new URL(page.url()).pathname === '/', 'la feuille s’ouvre sur l’accueil : on n’entre pas dans la liste')
const titre = (await feuille(page).locator('h2').first().innerText()).trim()
dit(titre === 'Partager « Rien qu’à moi »', `son titre : « ${titre} »`)
const codeAffiche = (await feuille(page).locator('.lien-invit .code').first().innerText()).replace(/\W/g, '')
dit(codeAffiche.toUpperCase() === solo.code_invitation.replace(/\W/g, '').toUpperCase(),
  `elle dit le code de CETTE liste (${codeAffiche})`)
dit(await feuille(page).locator('.avert').count() === 0, 'seul à décider : pas d’avertissement')
await feuille(page).getByRole('button', { name: 'Partager le lien' }).click()
await page.waitForTimeout(300)
const partages = await page.evaluate(() => window.__partages)
dit(partages.length === 1 && partages[0].url === `${BASE}/rejoindre/${solo.code_invitation}`,
  `« Partager le lien » : la feuille du téléphone reçoit le lien de CETTE liste (${partages[0]?.url})`)

// 4. lecture seule sur une liste gratuite : vers le déblocage
await feuille(page).getByRole('button', { name: /En lecture seule/ }).click()
const voir = feuille(page).getByRole('button', { name: 'Voir ce que ça ouvre' })
dit(await voir.isVisible(), 'liste gratuite, lecture seule : la feuille dit que c’est compris dans le déblocage')
await voir.click()
await page.waitForURL(/\/g\/[^/]+\/reglages/, { timeout: 15000 })
dit(page.url().includes(`/g/${solo.id}/reglages`), '… et « Voir ce que ça ouvre » mène aux réglages de cette liste')

// 5. un glissé n'est pas un clic
await accueilSur(page, solo.id)
const b = await bouton.boundingBox()
const cx = b.x + b.width / 2, cy = b.y + b.height / 2
await page.mouse.move(cx, cy); await page.mouse.down()
for (const [dx, dy] of [[-40, 0], [-80, 4], [-40, 2], [0, 0]]) { await page.mouse.move(cx + dx, cy + dy); await page.waitForTimeout(15) }
await page.mouse.up()
await page.waitForTimeout(500)
dit(await feuille(page).count() === 0 && new URL(page.url()).pathname === '/',
  'glisser à la souris puis relâcher sur le bouton n’ouvre rien')

// 2 bis. sans feuille de partage : copié, et dit
await page.evaluate(() => localStorage.setItem('sans_partage', '1'))
await accueilSur(page, solo.id)
await ouvrirFeuille(page)
const boutonLien = feuille(page).locator('.lien-invit .btn')
await boutonLien.click()
await page.waitForTimeout(250)
dit(await page.evaluate(() => navigator.clipboard.readText()) === `${BASE}/rejoindre/${solo.code_invitation}`,
  'sans feuille de partage : le lien est copié')
dit(/Lien copié/.test(await boutonLien.innerText()), '… et le bouton le dit')
await fermerFeuille(page)
dit(await feuille(page).count() === 0 && new URL(page.url()).pathname === '/', 'Échap ferme la feuille, on reste sur l’accueil')
await page.evaluate(() => localStorage.removeItem('sans_partage'))

// 3. à deux décideurs : l'avertissement, dans la feuille, avant l'envoi
await accueilSur(page, notre.id)
await ouvrirFeuille(page)
const avert = (await feuille(page).locator('.avert').innerText().catch(() => '')).replace(/\s+/g, ' ')
dit(/troisième personne/i.test(avert), `à deux : l’avertissement est dans la feuille — « ${avert.slice(0, 70)}… »`)
dit(await nbPartages(page) === 0, '… et rien n’est parti')
await feuille(page).getByRole('button', { name: /simple avis/ }).click()
const codeObs = (await feuille(page).locator('.lien-invit .code').first().innerText()).replace(/\W/g, '')
dit(codeObs.toUpperCase() === notre.code_observateur.replace(/\W/g, '').toUpperCase(),
  `« pour un simple avis » : le code des observateurs (${codeObs})`)
await feuille(page).locator('.lien-invit .btn').click()
await page.waitForTimeout(300)
const obs = await page.evaluate(() => window.__partages.at(-1))
dit(obs?.url === `${BASE}/rejoindre/${notre.code_observateur}`, `… et c’est son lien qui part (${obs?.url})`)
await fermerFeuille(page)

// 7. les réglages : la même carte
await page.goto(`${BASE}/g/${notre.id}/reglages`, { waitUntil: 'networkidle' })
await page.waitForSelector('.invit .lien-invit', { timeout: 20000 })
dit(await page.locator('.invit .deux-facons').count() === 1 && await page.locator('.invit .avert').count() === 1,
  'les réglages gardent la carte d’invitation : deux façons, et l’avertissement')

// 6. en anglais
await page.evaluate(async () => {
  await fetch('/api/moi/langue', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ choix: 'en', langue: 'en' }) })
  localStorage.setItem('pr_langue', 'en')
})
await accueilSur(page, solo.id)
dit((await bouton.innerText()).trim() === 'Share' && await bouton.getAttribute('aria-label') === 'Share “Rien qu’à moi”',
  `en anglais : « ${(await bouton.innerText()).trim()} »`)
await ouvrirFeuille(page)
dit(/Share “Rien qu’à moi”/.test(await feuille(page).locator('h2').first().innerText()), '… et la feuille aussi')

// 6 bis. un observateur : pas de bouton, pas de code
const m = await entrer('Mamie')
const lm = await m.page.evaluate(() => fetch('/api/groupes').then(r => r.json()))
const sienne = lm.find(l => l.nom === 'Notre liste')
dit(sienne && !sienne.code_invitation && !sienne.code_observateur, 'serveur : un observateur ne reçoit aucun code')
await accueilSur(m.page, notre.id)
dit(await m.page.locator('.bento button.partager').count() === 0, 'Mamie (observatrice) : pas de bouton « Partager »')

dit(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ' : ' + erreurs.join(' | ') : ''}`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
