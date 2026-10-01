/**
 * Les prénoms qui ont déjà été des tempêtes (app/utils/tempetes.ts).
 *
 * Ce qui se vérifie ici :
 *  - Irma en première carte : une icône d'orage dans la rangée du haut, de la
 *    hauteur des autres étiquettes, sans faire déborder la rangée ; c'est un
 *    bouton, nommé pour les lecteurs d'écran (« Nom d'un ouragan : Irma,
 *    2017. En savoir plus ») ;
 *  - la toucher ouvre SA feuille — ni la fiche, ni un glissement, ni un
 *    vote : l'ouragan, sa date, il y a combien d'années, le bilan, ce qui a
 *    marqué, le nom rayé des listes, un lien vers la source (nouvel onglet,
 *    sans référent) ; les flèches n'y votent pas ; Échap la ferme et rend le
 *    focus à l'icône ;
 *  - la fiche dit la même chose, tout en haut, sans défiler ;
 *  - à l'oreille : Eléanore « se dit comme la tempête Eleanor », Ugo comme
 *    l'ouragan Hugo ; la feuille et la fiche le disent ;
 *  - Martin en porte deux, la plus marquante d'abord (1999, puis 1997) ;
 *  - rien pour Thomas et Raphaël (Tomas et Rafael sont écartés), ni pour
 *    Louis et Mathis (un ou deux morts : écartés), ni pour Jade ;
 *  - aucune violation WCAG A/AA, carte, feuille et fiche, en clair comme en
 *    sombre.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })

async function auditer(nom) {
  await page.waitForTimeout(450)
  await page.evaluate(AXE)
  const r = await page.evaluate(async () => (await window.axe.run(document,
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }))
    .violations.map(v => `${v.id} (${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')})`))
  dit(r.length === 0, `${nom} : aucune violation WCAG A/AA${r.length ? ` — ${r.join(' ; ')}` : ''}`)
}

const devant = () => page.locator('.carte.fiche:not(.derriere)')
const echappe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const plat = s => s.replace(/\s+/g, ' ').trim()
const an = new Date().getFullYear()

/** Met `nom` en première carte, par la loupe. */
async function epingler(nom) {
  await page.getByRole('button', { name: 'Chercher un prénom' }).click()
  await page.waitForSelector('.feuille-corps input.chercher')
  await page.waitForTimeout(350)
  await page.locator('input.chercher').fill(nom)
  await page.waitForTimeout(450)
  await page.getByRole('button', { name: new RegExp(`^${echappe(nom)}(, rare)? : mettre en première carte`) }).click()
  await page.waitForTimeout(900)
  const vu = (await devant().locator('.nom').first().innerText()).trim()
  if (vu !== nom) throw new Error(`première carte : ${vu}, pas ${nom}`)
}
const icone = () => devant().locator('.tete button.orage')
/** Ce que dit l'icône de la première carte ('' si elle n'en a pas). */
const resume = async () => await icone().count() ? (await icone().getAttribute('title')) ?? '?' : ''

const feuille = () => page.locator('.feuille-corps[role="dialog"]')
async function ouvrirFeuille() {
  await icone().click()
  await feuille().waitFor({ timeout: 8000 })
  await page.waitForTimeout(450)
}
async function fermerFeuille() {
  await feuille().getByRole('button', { name: 'Fermer' }).click()
  await page.waitForSelector('.feuille-voile', { state: 'detached', timeout: 8000 })
  await page.waitForTimeout(200)
}
async function ouvrirFiche(nom) {
  await devant().getByRole('button', { name: `Infos sur ${nom}` }).click()
  await page.waitForSelector('.voile .feuille[role="dialog"]', { timeout: 8000 })
  await page.waitForTimeout(450)
}
async function fermerFiche() {
  await page.getByRole('button', { name: 'Fermer la fiche' }).click()
  await page.waitForSelector('.voile', { state: 'detached', timeout: 8000 })
  await page.waitForTimeout(200)
}
const blocFiche = () => page.locator('.voile .feuille .tempetes')

await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(page, 'Paul')
await page.waitForSelector('.bento', { timeout: 20000 })
await page.locator('a.carte', { hasText: 'Notre liste' }).first().click()
await devant().locator('.nom').first().waitFor({ timeout: 25000 })
await page.waitForTimeout(500)

// ---------- 1. Irma : l'icône --------------------------------------------------
await epingler('Irma')
dit(await resume() === 'Nom d’un ouragan : Irma, 2017', `Irma : une icône d’orage, « ${await resume()} »`)
dit(await icone().getAttribute('aria-label') === 'Nom d’un ouragan : Irma, 2017. En savoir plus',
  'c’est un bouton, qui dit ce qu’il ouvre')
const geo = await devant().evaluate(c => {
  const tete = c.querySelector('.tete'), o = c.querySelector('.orage')
  const genre = c.querySelector('.etiquettes .puce:not(.orage)')
  const r = o.getBoundingClientRect(), g = genre.getBoundingClientRect()
  return { h: Math.round(r.height), hg: Math.round(g.height), memeLigne: Math.abs(r.top - g.top) < 2,
    deborde: tete.scrollWidth > tete.clientWidth + 1 }
})
dit(Math.abs(geo.h - geo.hg) <= 1 && geo.memeLigne && !geo.deborde,
  `dans la rangée du haut, à côté du genre, à sa hauteur (${geo.h} px contre ${geo.hg}), sans déborder`)
await auditer('la carte d’Irma')

// ---------- 2. … qui ouvre sa feuille ----------------------------------------
await ouvrirFeuille()
dit(await page.locator('.voile .feuille').count() === 0, 'toucher l’icône ouvre sa feuille, pas la fiche')
dit((await feuille().locator('h2').innerText()).trim() === 'Ouragan Irma', 'la feuille s’intitule « Ouragan Irma »')
const tf = plat(await feuille().locator('.tempete').innerText())
dit(/6 septembre 2017/.test(tf) && /Saint-Martin, Saint-Barthélemy/.test(tf) && new RegExp(`il y a ${an - 2017} ans`).test(tf),
  `quand, où, il y a combien de temps (« ${tf.split(' 11 morts')[0]} »)`)
dit(/11 morts à Saint-Martin/.test(tf) && /Catégorie 5/.test(tf), 'le bilan, et ce qui a marqué')
dit(/plus aucune tempête de l’Atlantique ne s’appellera Irma/.test(tf), 'le nom rayé des listes')
const lien = feuille().getByRole('link', { name: /^En savoir plus sur Wikipédia/ })
const attrs = await lien.evaluate(a => ({ href: a.href, cible: a.target, rel: a.rel }))
dit(attrs.href === 'https://fr.wikipedia.org/wiki/Ouragan_Irma' && attrs.cible === '_blank'
    && /noopener/.test(attrs.rel) && /noreferrer/.test(attrs.rel),
  `un lien vers la source, dans un nouvel onglet, sans référent (${attrs.href})`)
dit(/l’ouragan Irma, nouvel onglet/.test(await lien.evaluate(a => a.textContent)),
  'le lien dit, pour un lecteur d’écran, de quelle tempête et qu’il ouvre un onglet')
await auditer('la feuille d’Irma')
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(600)
dit(await feuille().count() === 1 && (await devant().locator('.nom').first().innerText()).trim() === 'Irma',
  'les flèches ne votent pas sous la feuille')
await page.keyboard.press('Escape')
await page.waitForSelector('.feuille-voile', { state: 'detached', timeout: 8000 })
await page.waitForTimeout(300)
dit(await page.evaluate(() => document.activeElement?.classList.contains('orage')),
  'Échap la ferme et rend le focus à l’icône')
dit((await devant().locator('.nom').first().innerText()).trim() === 'Irma', 'Irma est toujours là, rien n’a été voté')

// ---------- 3. La fiche dit la même chose ----------------------------------------
await ouvrirFiche('Irma')
const bloc = blocFiche()
dit(await bloc.count() === 1, 'la fiche a son encadré de tempête')
const texte = plat(await bloc.innerText())
dit(/^Nom de tempête/i.test(texte) && /Ouragan Irma/.test(texte) && /6 septembre 2017/.test(texte)
    && /11 morts à Saint-Martin/.test(texte) && /Catégorie 5/.test(texte) && /En savoir plus/.test(texte),
  'le même détail que la feuille (titre, date, bilan, ce qui a marqué, lien)')
const visible = await bloc.evaluate(b => b.getBoundingClientRect().top < innerHeight * .6)
dit(visible, 'l’encadré commence dans le haut de la fiche, sans défiler')
await auditer('la fiche d’Irma')
await fermerFiche()

// ---------- 4. À l'oreille --------------------------------------------------
await epingler('Eléanore')
dit(await resume() === 'Se dit comme la tempête Eleanor, 2018', `Eléanore : « ${await resume()} »`)
await ouvrirFeuille()
const t2 = plat(await feuille().innerText())
dit(/Tempête Eleanor/.test(t2) && /Eléanore se prononce comme Eleanor, le nom de la tempête\./.test(t2)
    && /3 et 4 janvier 2018/.test(t2),
  'sa feuille : « Eléanore se prononce comme Eleanor, le nom de la tempête »')
await fermerFeuille()
await ouvrirFiche('Eléanore')
dit(/^Se dit comme une tempête/i.test(plat(await blocFiche().innerText())), 'sa fiche aussi')
await fermerFiche()
await epingler('Ugo')
dit(await resume() === 'Se dit comme l’ouragan Hugo, 1989', `Ugo : « ${await resume()} »`)

// ---------- 5. Deux tempêtes ----------------------------------------------------
await epingler('Martin')
dit(await resume() === 'Nom de deux tempêtes : Martin, 1999 et 1997', `Martin : « ${await resume()} »`)
await ouvrirFeuille()
const detailsF = await feuille().locator('.tempete').allInnerTexts()
dit((await feuille().locator('h2').innerText()).trim() === 'Deux tempêtes Martin' && detailsF.length === 2
    && /Tempête Martin/.test(detailsF[0]) && /1999/.test(detailsF[0])
    && /Cyclone Martin/.test(detailsF[1]) && /1997/.test(detailsF[1]),
  `sa feuille : « Deux tempêtes Martin », 1999 d’abord`)
await auditer('la feuille de Martin')
await fermerFeuille()
await ouvrirFiche('Martin')
const detailsFiche = await blocFiche().locator('.tempete').allInnerTexts()
dit(detailsFiche.length === 2 && /1999/.test(detailsFiche[0]) && /1997/.test(detailsFiche[1]),
  'sa fiche aussi, dans le même ordre')
await fermerFiche()

// ---------- 6. Et pas les autres -------------------------------------------------
for (const nom of ['Thomas', 'Raphaël', 'Louis', 'Mathis', 'Jade']) {
  await epingler(nom)
  dit(await resume() === '', `${nom} : pas d’icône`)
}
await ouvrirFiche('Jade')
dit(await blocFiche().count() === 0, 'ni d’encadré dans sa fiche')
await fermerFiche()

// ---------- 7. En sombre ------------------------------------------------------
await page.emulateMedia({ colorScheme: 'dark' })
await epingler('Garance')
dit(await resume() === 'Nom d’un cyclone : Garance, 2025', `Garance : « ${await resume()} »`)
await auditer('la carte de Garance, en sombre')
await ouvrirFeuille()
await auditer('sa feuille, en sombre')
await fermerFeuille()
await ouvrirFiche('Garance')
await auditer('sa fiche, en sombre')
await fermerFiche()

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
