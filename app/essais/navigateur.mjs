/**
 * Ouvrir un navigateur, ici comme ailleurs.
 *
 * Les essais tournaient avec deux chemins en dur — l'installation globale de
 * Playwright et un binaire Chromium precis. Ils ne demarraient donc que sur
 * une seule machine, ce qui revient a ne pas avoir d'essais du tout des qu'on
 * change d'ordinateur.
 *
 * Ici on cherche, dans l'ordre : ce que disent les variables d'environnement,
 * puis le `playwright` installe a cote du projet. Le binaire n'est impose que
 * si on le demande : sans `ESSAI_CHROME`, Playwright prend le sien.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node essais/essai-panorama.mjs
 */
const chemin = process.env.ESSAI_PLAYWRIGHT || 'playwright'
const module_ = await import(chemin)
// Playwright est un module CommonJS : selon le chemin par lequel on l'importe,
// `chromium` arrive en export nomme ou seulement sous `default`. Les deux.
const chromium = module_.chromium ?? module_.default?.chromium
if (!chromium) throw new Error(`Playwright introuvable via « ${chemin} ». `
  + 'Installez-le (npm i -D playwright && npx playwright install chromium) '
  + 'ou donnez ESSAI_PLAYWRIGHT.')

export const BASE = process.env.ESSAI_BASE || 'http://127.0.0.1:3100'

/** Le compteur d'assertions, identique dans tous les essais. */
export function compteur() {
  const ok = [], ko = []
  const dit = (c, m) => {
    ;(c ? ok : ko).push(m)
    console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m)
  }
  return { ok, ko, dit }
}

export async function lancer() {
  return chromium.launch({
    executablePath: process.env.ESSAI_CHROME || undefined,
    args: ['--no-sandbox']
  })
}

/** Un onglet de telephone, sans le panneau devtools de Nuxt dans le chemin. */
export async function onglet(nav) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await ctx.addInitScript(() => {
    const c = () => {
      const s = document.createElement('style')
      s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
      document.head?.appendChild(s)
    }
    if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
  })
  return { ctx, page: await ctx.newPage() }
}

/**
 * La boîte aux lettres du développement (/api/dev/courriels) : le dernier
 * e-mail reçu par `a` depuis `apres` (ms), qu'on attend un peu.
 */
export async function courrielPour(a, { apres = 0, delai = 10000 } = {}) {
  const fin = Date.now() + delai
  while (Date.now() < fin) {
    const boite = await fetch(`${BASE}/api/dev/courriels`).then(r => r.json()).catch(() => [])
    const m = boite.find(c => c.a === a && Date.parse(c.le) >= apres)
    if (m) return m
    await new Promise(r => setTimeout(r, 200))
  }
  return null
}

/**
 * S'inscrire depuis /connexion, onglet Inscription : le prénom, l'adresse,
 * puis le code reçu (ou, avec `parLien`, le lien de l'e-mail ouvert dans le
 * même navigateur). La passkey, proposée juste après, est remise à plus tard
 * (sauf `passkey: true` : on s'arrête sur la proposition). Rend l'e-mail reçu.
 */
export async function inscrire(page, pseudo, email, { parLien = false, passkey = false } = {}) {
  const avant = Date.now() - 1000
  await page.getByLabel('Votre prénom').fill(pseudo)
  await page.getByLabel('Votre adresse e-mail').fill(email)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  const m = await courrielPour(email, { apres: avant })
  if (!m?.code) throw new Error(`aucun e-mail d’inscription pour ${email}`)
  if (parLien) {
    await page.goto(m.lien, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Continuer' }).click()
  } else {
    await page.locator('input[autocomplete="one-time-code"]').fill(m.code)
  }
  const plusTard = page.getByRole('button', { name: 'Plus tard' })
  await plusTard.waitFor({ timeout: 15000 })
  if (!passkey) await plusTard.click()
  return m
}

/**
 * Taper comme un clavier Android. Il « compose » le mot en cours : le champ
 * l'affiche, souligné, mais le mot n'est validé qu'à l'espace, à Entrée ou
 * quand le clavier se range. Tant qu'il ne l'est pas, un `v-model` n'a rien
 * vu — d'où `frappe()` (app/utils/frappe.ts) pour tout champ auquel l'écran
 * répond pendant qu'on écrit. Sans cette composition, un essai tape comme un
 * clavier d'ordinateur et ne voit pas la différence.
 *
 * Le champ doit avoir le focus. Rend `valider()`, qui termine la composition
 * comme le fait le clavier en se rangeant.
 */
export async function composer(page, mot) {
  const cdp = await page.context().newCDPSession(page)
  for (let i = 1; i <= mot.length; i++) {
    await cdp.send('Input.imeSetComposition', { text: mot.slice(0, i), selectionStart: i, selectionEnd: i })
  }
  await page.waitForTimeout(150)
  return {
    valider: async () => {
      await cdp.send('Input.insertText', { text: mot })
      await cdp.detach().catch(() => {})
    }
  }
}

/**
 * Un doigt qui glisse de `dy` px sur l'élément `selecteur` : un défilement,
 * pas un toucher. Les événements tactiles sont fabriqués dans la page — on
 * éprouve ce que l'app en fait, pas le défilement du navigateur.
 */
export async function glisser(page, selecteur, dy, pas = 6) {
  await page.evaluate(([sel, dy, pas]) => {
    const el = document.querySelector(sel)
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 120)
    const doigt = yy => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })
    const envoyer = (type, yy, leve) => el.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true, changedTouches: [doigt(yy)],
      touches: leve ? [] : [doigt(yy)], targetTouches: leve ? [] : [doigt(yy)] }))
    envoyer('touchstart', y)
    for (let i = 1; i <= pas; i++) envoyer('touchmove', y + dy * i / pas)
    envoyer('touchend', y + dy, true)
  }, [selecteur, dy, pas])
}

/**
 * Entrer comme un compte du jeu d'essai — Paul, Alice, Mamie — depuis la
 * page de connexion déjà ouverte : un geste sur le bloc « Base locale »
 * (outils-dev/OutilsConnexion.vue, route /api/dev/entrer). Depuis que la
 * clé d'accès est partie, c'est la seule porte vers un compte semé : il n'a
 * ni passkey ni, sauf Alice, d'adresse. Développement seulement.
 */
export async function entrerComme(page, pseudo) {
  await page.locator('section.dev', { hasText: 'Base locale' })
    .getByRole('button', { name: pseudo, exact: true }).click()
}
