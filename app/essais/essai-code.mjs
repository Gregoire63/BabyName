/**
 * Le code reçu par e-mail se copie d'un geste — et l'écran le dit.
 *
 * Un e-mail ne sait rien faire quand on le touche. Le code y est donc un lien
 * vers une page du site (/connexion/code#c=123456), qui copie et le dit.
 *
 *  1. L'e-mail : le code d'un seul tenant (« 123456 », pas « 123 456 »), et
 *     c'est un lien vers la page de copie, sur le site d'où la demande est
 *     partie ; l'objet le porte aussi.
 *  2. Navigateur qui laisse copier sans geste (Chrome) : copié à l'arrivée,
 *     annoncé, et le code quitte l'adresse.
 *  3. Navigateur qui veut un geste (Safari, Firefox) : rien de copié ni
 *     d'annoncé à l'arrivée ; un bouton, qui copie et le dit.
 *  4. Pas de presse-papiers (une vue web) : le repli, sur un geste.
 *  5. Rien ne marche : on le dit, et le code se sélectionne à la main.
 *  6. Une adresse sans code, ou qui tend autre chose que six chiffres : la
 *     page ne copie rien.
 *  7. La page ne dit le code à aucun serveur.
 *  8. Collé dans l'app comme on le sélectionne à la main dans un e-mail (un
 *     espace au milieu, un blanc devant) : il entre.
 *  9. Aucune violation WCAG A/AA, en clair comme en sombre.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, compteur, courrielPour, BASE } from './navigateur.mjs'

const AXE = readFileSync(process.env.ESSAI_AXE
  || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []

/** Un téléphone, presse-papiers permis (pour le relire), et de quoi le fausser avant la page. */
async function onglet(avant) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await ctx.addInitScript(() => {
    // Le vrai presse-papiers, gardé de côté : l'essai le relit même quand la
    // page n'en a plus (cas 4 et 5).
    window.__presse = navigator.clipboard
    const c = () => {
      const s = document.createElement('style')
      s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
      document.head?.appendChild(s)
    }
    if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
  })
  if (avant) await ctx.addInitScript(avant)
  const page = await ctx.newPage()
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  return { ctx, page }
}
const TEMOIN = 'rien-de-copié'
const poser = (page, texte = TEMOIN) => page.evaluate(t => window.__presse.writeText(t), texte)
const presse = page => page.evaluate(() => window.__presse.readText())
// L'annonce de la carte (la page a d'autres zones d'annonce, à l'app entière).
const annonce = async page => (await page.locator('.carte').getByRole('status').innerText().catch(() => '')).trim()
const arriver = async (page, adresse) => {
  // Une première page du site, pour poser le témoin dans le presse-papiers.
  await page.goto(`${BASE}/connexion/code`, { waitUntil: 'networkidle' })
  await poser(page)
  await page.goto('about:blank')
  await page.goto(adresse, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { level: 2 }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
}

// =================== 1. L'E-MAIL ============================================
const A = await onglet()
await A.page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await A.page.getByRole('tab', { name: 'Connexion' }).click()
const avant = Date.now() - 1000
await A.page.locator('input[type="email"]').fill('alice@exemple.test')
await A.page.getByRole('button', { name: 'Recevoir un lien' }).click()
const m = await courrielPour('alice@exemple.test', { apres: avant })
if (!m?.code) { console.log('  ECHEC  aucun e-mail de connexion'); process.exit(1) }
const CODE = m.code
dit(m.copie === `${BASE}/connexion/code#c=${CODE}`,
  `dans l’e-mail, le code est un lien vers la page qui le copie, sur le site d’où part la demande (${m.copie?.replace(CODE, '······')})`)
dit(m.sujet.includes(CODE) && !m.sujet.includes(`${CODE.slice(0, 3)} ${CODE.slice(3)}`),
  'il y est écrit d’un seul tenant, dans le message comme dans son objet')

dit((await fetch(`${BASE}/connexion/code`)).status === 200,
  'la page de copie est une page connue du serveur (200, pas le 404 des adresses inventées)')

// =================== 2. COPIÉ À L'ARRIVÉE (Chrome) ==========================
{
  const { ctx, page } = await onglet()
  // 7. Ce que la page envoie : rien ne doit porter le code.
  const envois = []
  ctx.on('request', r => envois.push({ adresse: r.url().replace(/#.*$/, ''), corps: r.postData() ?? '' }))
  await arriver(page, m.copie)
  dit(await presse(page) === CODE && await annonce(page) === 'Code copié',
    `la page copie le code à l’arrivée, et le dit (« ${await annonce(page)} »)`)
  dit(page.url() === `${BASE}/connexion/code`, `le code quitte l’adresse (${page.url().replace(BASE, '')})`)
  dit(/Revenez dans babyNamed et collez-le/.test(await page.locator('.carte').innerText()), 'elle dit quoi en faire')
  // Le code affiché se touche, comme dans l'e-mail : il se recopie.
  await poser(page)
  await page.getByRole('button', { name: `Copier le code ${CODE}` }).click()
  await page.waitForTimeout(300)
  dit(await presse(page) === CODE, 'toucher le code, sur la page aussi, le copie')
  const fuites = envois.filter(e => e.adresse.includes(CODE) || e.corps.includes(CODE))
  dit(fuites.length === 0, `la page ne dit le code à aucun serveur (${envois.length} requêtes, ${fuites.length} qui le portent)`)

  // 9. Accessibilité, clair puis sombre.
  for (const [nom, schema] of [['clair', 'light'], ['sombre', 'dark']]) {
    await page.emulateMedia({ colorScheme: schema })
    await page.waitForTimeout(250)
    await page.evaluate(AXE)
    const v = await page.evaluate(async () => (await window.axe.run(document,
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }))
      .violations.map(x => `${x.id} (${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')})`))
    dit(v.length === 0, `la page du code, en ${nom} : aucune violation WCAG A/AA${v.length ? ` — ${v.join(' ; ')}` : ''}`)
  }
  await ctx.close()
}

// =================== 3. IL FAUT UN GESTE (Safari, Firefox) ==================
{
  const { ctx, page } = await onglet(() => {
    if (!navigator.clipboard) return          // about:blank n'en a pas
    const vrai = navigator.clipboard.writeText.bind(navigator.clipboard)
    navigator.clipboard.writeText = t => navigator.userActivation.isActive
      ? vrai(t) : Promise.reject(new DOMException('un geste est requis', 'NotAllowedError'))
  })
  await arriver(page, m.copie)
  dit(await presse(page) === TEMOIN && await annonce(page) === '',
    'navigateur qui veut un geste : rien de copié à l’arrivée, et rien d’annoncé à tort')
  const bouton = page.getByRole('button', { name: 'Copier le code', exact: true })
  dit(await bouton.count() === 1, 'un bouton : « Copier le code »')
  await bouton.click()
  await page.locator('.carte').getByRole('status').filter({ hasText: 'Code copié' }).waitFor({ timeout: 8000 }).catch(() => {})
  dit(await presse(page) === CODE && await annonce(page) === 'Code copié' && await bouton.count() === 0,
    'le geste copie le code, et l’écran le dit')
  await ctx.close()
}

// =================== 4. PAS DE PRESSE-PAPIERS (une vue web) =================
{
  const { ctx, page } = await onglet(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true })
  })
  await arriver(page, m.copie)
  dit(await presse(page) === TEMOIN && await annonce(page) === '', 'sans presse-papiers : rien d’annoncé à l’arrivée')
  await page.getByRole('button', { name: 'Copier le code', exact: true }).click()
  await page.locator('.carte').getByRole('status').filter({ hasText: 'Code copié' }).waitFor({ timeout: 8000 }).catch(() => {})
  dit(await presse(page) === CODE && await annonce(page) === 'Code copié',
    'sans presse-papiers : le geste copie quand même (le repli par sélection), et l’écran le dit')
  await ctx.close()
}

// =================== 5. RIEN NE MARCHE ======================================
{
  const { ctx, page } = await onglet(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true })
    document.execCommand = () => false
  })
  await arriver(page, m.copie)
  await page.getByRole('button', { name: 'Copier le code', exact: true }).click()
  await page.getByRole('alert').waitFor({ timeout: 8000 }).catch(() => {})
  const selection = await page.locator('.chiffres').evaluate(e => getComputedStyle(e).userSelect)
  dit(await annonce(page) === '' && /n’a pas marché/.test(await page.getByRole('alert').innerText().catch(() => ''))
      && await presse(page) === TEMOIN,
    'la copie échoue : l’écran le dit, sans prétendre le contraire')
  dit((await page.locator('.chiffres').innerText()).trim() === CODE && selection === 'all',
    'et le code reste là, à sélectionner d’un toucher')
  await ctx.close()
}

// =================== 6. UNE ADRESSE QUI NE PORTE PAS UN CODE ================
{
  const { ctx, page } = await onglet()
  for (const [nom, suite] of [['sans code', ''], ['cinq chiffres', '#c=12345'], ['sept chiffres', '#c=1234567'],
    ['des lettres', '#c=abcdef'], ['autre chose que le code', '#c=123456<script>'], ['un jeton de lien', '#t=123456']]) {
    await arriver(page, `${BASE}/connexion/code${suite}`)
    const titre = (await page.getByRole('heading', { level: 2 }).innerText()).trim()
    dit(titre === 'Code introuvable' && await presse(page) === TEMOIN && await page.locator('.chiffres').count() === 0,
      `${nom} : « ${titre} », et rien n’est copié`)
  }
  await ctx.close()
}

// =================== 8. COLLÉ DANS L'APP ====================================
// Sélectionné à la main dans un e-mail, un code vient avec ce qui l'entoure.
// Le champ était limité à 7 caractères : le collage était coupé avant d'être lu.
{
  const sale = ` ${CODE.slice(0, 3)} ${CODE.slice(3)} `
  await poser(A.page, sale)
  const champ = A.page.locator('input[autocomplete="one-time-code"]')
  await champ.click()
  await A.page.keyboard.press('Control+V')
  await A.page.getByRole('button', { name: 'Plus tard' }).click({ timeout: 15000 }).catch(() => {})
  await A.page.waitForSelector('.bento', { timeout: 20000 }).catch(() => {})
  const moi = await A.page.evaluate(() => fetch('/api/auth/moi').then(r => r.json()).catch(() => null))
  dit(moi?.utilisateur?.pseudo === 'Alice', `collé avec ses blancs (« ${sale.replace(/\d/g, '·')} »), le code entre`)
  await A.ctx.close()
}

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
