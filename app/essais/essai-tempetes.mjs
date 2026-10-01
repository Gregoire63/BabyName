/**
 * Les prénoms qui ont déjà été des tempêtes (app/utils/tempetes.ts).
 *
 * Ce qui se vérifie ici :
 *  - Irma en première carte : une icône d'orage dans la rangée du haut, qui
 *    dit « Nom d'un ouragan : Irma, 2017 » aux lecteurs d'écran, de la
 *    hauteur des autres étiquettes, sans faire déborder la rangée ;
 *  - la fiche l'explique tout en haut, sans défiler : l'ouragan, sa date,
 *    son bilan ;
 *  - à l'oreille : Eléanore « se dit comme la tempête Eleanor », Ugo comme
 *    l'ouragan Hugo ; la fiche le dit aussi ;
 *  - Martin en porte deux, la plus marquante d'abord (1999, puis 1997) ;
 *  - rien pour Thomas et Raphaël (Tomas et Rafael sont écartés), ni pour
 *    Louis et Mathis (un ou deux morts : écartés), ni pour Jade ;
 *  - aucune violation WCAG A/AA, carte et fiche, en clair comme en sombre.
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
/** Ce que dit l'icône de la première carte ('' si elle n'en a pas). */
const icone = async () => {
  const o = devant().locator('.tete .orage')
  return await o.count() ? (await o.getAttribute('aria-label')) ?? '?' : ''
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

// ---------- 1. Irma : l'icône, puis la fiche ---------------------------------
await epingler('Irma')
dit(await icone() === 'Nom d’un ouragan : Irma, 2017', `Irma : une icône d’orage, « ${await icone()} »`)
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

await ouvrirFiche('Irma')
const bloc = blocFiche()
dit(await bloc.count() === 1, 'la fiche a son encadré de tempête')
const texte = (await bloc.innerText()).replace(/\s+/g, ' ')
dit(/^Nom de tempête/i.test(texte) && /Ouragan Irma/.test(texte) && /septembre 2017/.test(texte)
    && /Saint-Martin/.test(texte) && /11 morts/.test(texte),
  `elle dit quel ouragan, quand, où, quel bilan (« ${texte} »)`)
const visible = await bloc.evaluate(b => b.getBoundingClientRect().bottom <= innerHeight)
dit(visible, 'l’encadré se voit sans défiler')
await auditer('la fiche d’Irma')
await fermerFiche()

// ---------- 2. À l'oreille --------------------------------------------------
await epingler('Eléanore')
dit(await icone() === 'Se dit comme la tempête Eleanor, 2018', `Eléanore : « ${await icone()} »`)
await ouvrirFiche('Eléanore')
const t2 = (await blocFiche().innerText()).replace(/\s+/g, ' ')
dit(/^Se dit comme une tempête/i.test(t2) && /Tempête Eleanor/.test(t2) && /janvier 2018/.test(t2),
  `sa fiche le dit (« ${t2.slice(0, 70)}… »)`)
await fermerFiche()
await epingler('Ugo')
dit(await icone() === 'Se dit comme l’ouragan Hugo, 1989', `Ugo : « ${await icone()} »`)

// ---------- 3. Deux tempêtes ----------------------------------------------------
await epingler('Martin')
dit(await icone() === 'Nom de deux tempêtes : Martin, 1999 et 1997', `Martin : « ${await icone()} »`)
await ouvrirFiche('Martin')
const lignes = await blocFiche().locator('p').allInnerTexts()
dit(lignes.length === 2 && /Tempête Martin/.test(lignes[0]) && /1999/.test(lignes[0])
    && /Cyclone Martin/.test(lignes[1]) && /1997/.test(lignes[1]),
  `sa fiche les donne toutes les deux, 1999 d’abord (${lignes.map(l => l.split('\n')[0]).join(' / ')})`)
await fermerFiche()

// ---------- 4. Et pas les autres -------------------------------------------------
for (const nom of ['Thomas', 'Raphaël', 'Louis', 'Mathis', 'Jade']) {
  await epingler(nom)
  dit(await icone() === '', `${nom} : pas d’icône`)
}
await ouvrirFiche('Jade')
dit(await blocFiche().count() === 0, 'ni d’encadré dans sa fiche')
await fermerFiche()

// ---------- 5. En sombre ------------------------------------------------------
await page.emulateMedia({ colorScheme: 'dark' })
await epingler('Garance')
dit(/^Nom d’un cyclone : Garance, 2025$/.test(await icone()), `Garance : « ${await icone()} »`)
await auditer('la carte de Garance, en sombre')
await ouvrirFiche('Garance')
await auditer('sa fiche, en sombre')
await fermerFiche()

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
