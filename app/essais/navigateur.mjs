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
