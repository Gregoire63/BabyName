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

/**
 * Les requêtes encore en vol, tous onglets confondus. Un essai qui s'arrête
 * sur « délai dépassé » ne dit pas ce que la page attendait : ceci le dit
 * (voir `lancer`).
 */
const enVol = new Map()

export async function lancer() {
  const nav = await chromium.launch({
    executablePath: process.env.ESSAI_CHROME || undefined,
    args: ['--no-sandbox']
  })
  // Chaque contexte ouvert par l'essai est suivi, d'où qu'il l'ouvre.
  const ouvrir = nav.newContext.bind(nav)
  nav.newContext = async (...options) => {
    const ctx = await ouvrir(...options)
    ctx.on('request', r => enVol.set(r, { le: Date.now(), quoi: `${r.method()} ${r.url().replace(BASE, '')}` }))
    ctx.on('requestfinished', r => enVol.delete(r))
    ctx.on('requestfailed', r => enVol.delete(r))
    return ctx
  }
  return nav
}
/**
 * Aller à une adresse et attendre que le réseau se calme — sans en mourir.
 * Playwright tient parfois pour « en vol », à jamais, une requête que la page
 * précédente a lancée à l'instant où on la quittait : le calme ne vient pas,
 * et l'essai s'arrêtait sur « délai dépassé », une fois sur cent. Passé quinze
 * secondes on le dit, avec ces requêtes, et l'on continue : la page a eu tout
 * son temps, et ce que l'essai attend ensuite (un sélecteur) dira si elle est
 * là. Pour les essais dont les pages travaillent en fond au moment où on les
 * quitte (essai-apple : un achat repris, représenté, rappelé).
 */
export async function aller(page, adresse, attente = 15000) {
  try {
    await page.goto(adresse, { waitUntil: 'networkidle', timeout: attente })
  } catch (e) {
    if (e?.name !== 'TimeoutError') throw e
    const reste = [...enVol.values()].filter(r => Date.now() - r.le > 3000).map(r => r.quoi)
    console.log('   [réseau jamais calme]', adresse.replace(BASE, ''), reste.slice(0, 6))
  }
}

// Un essai qui plante (un sélecteur attendu en vain, une page qui ne se calme
// pas) : avant de mourir, dire quelles requêtes n'avaient pas répondu.
process.on('uncaughtException', (e) => {
  const attendues = [...enVol.values()].filter(r => Date.now() - r.le > 3000)
  if (attendues.length) {
    console.log('   [en vol depuis plus de 3 s]', attendues.slice(0, 12).map(r => `${r.quoi} (${Math.round((Date.now() - r.le) / 1000)} s)`))
  }
  console.error(e)
  process.exit(1)
})

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
 * Un onglet qui se présente comme l'app des stores (dossier mobile/ du dépôt) :
 * son agent utilisateur — « … babyNamedApp/1.0.0 (android) », ce à quoi le
 * site et le serveur la reconnaissent — et le pont natif
 * (window.ReactNativeWebView), tenu ici à la place du téléphone.
 *
 * `natif` est ce faux téléphone : `recus` (tout ce que la page lui a dit),
 * `permission` des notifications (« indeterminee » tant qu'on n'a rien
 * demandé), `reponse` (ce que la personne répondra à la question du
 * téléphone), `jeton`, `muet` (une vieille app qui ne répond à rien). Il vit
 * côté Node : il survit aux rechargements de page. `dire(message)` envoie à
 * la page ce que le natif lui dirait (un lien reçu, le retour au premier plan).
 */
const AGENTS_APP = {
  android: v => 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 '
    + `(KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 babyNamedApp/${v} (android)`,
  ios: v => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 '
    + `(KHTML, like Gecko) Mobile/15E148 babyNamedApp/${v} (ios)`
}
export async function ongletApp(nav, plateforme, { version = '1.0.0', jeton } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    userAgent: AGENTS_APP[plateforme](version) })
  const natif = {
    recus: [], permission: 'indeterminee', reponse: 'accordee', muet: false,
    jeton: jeton ?? `ExponentPushToken[essai-${plateforme}-${Math.random().toString(36).slice(2, 12)}]`,
    /**
     * L'achat intégré (iOS). `produits` : ce que le faux App Store sait
     * vendre, { produit: prix } — null : une app d'avant l'achat intégré, qui
     * ne répond à rien de tout cela. `issue` : comment finit la feuille
     * d'achat — 'achete', 'annule', 'attente' (un accord à donner), 'erreur',
     * 'muet', ou 'ferme' (payé, puis l'app fermée avant d'avoir pu le dire).
     * `encaisser({ produit, jeton })` : ce que l'essai fait de l'achat (il
     * l'inscrit chez son faux Apple) ; rend le numéro de transaction.
     * `auRetour()` : ce qui se passe entre le paiement et la réponse du
     * téléphone — la feuille d'Apple se referme, l'app revient au premier plan.
     */
    achat: { produits: null, issue: 'achete', encaisser: null, auRetour: null, enSuspens: [], finies: [], demandes: [] }
  }
  await ctx.exposeBinding('__natif', async (_source, texte) => {
    const m = JSON.parse(texte)
    natif.recus.push(m)
    if (natif.muet) return null
    const push = () => ({ type: m.type, id: m.id, ok: true, permission: natif.permission,
      ...(natif.permission === 'accordee' ? { jeton: natif.jeton } : {}) })
    if (m.type === 'push.etat') return push()
    if (m.type === 'push.demander') { natif.permission = natif.reponse; return push() }
    if (m.type === 'partager' || m.type === 'fichier') return { type: m.type, id: m.id, ok: true }
    if (m.type.startsWith('achat.')) {
      const a = natif.achat
      if (!a.produits) return null
      const rep = plus => ({ type: m.type, id: m.id, ok: true, ...plus })
      if (m.type === 'achat.produit') {
        const prix = a.produits[m.produit]
        return prix ? rep({ prix }) : { type: m.type, id: m.id, ok: false }
      }
      if (m.type === 'achat.attente') return rep({ transactions: a.enSuspens.map(t => ({ ...t })) })
      if (m.type === 'achat.finir') {
        a.finies.push(m.transaction)
        a.enSuspens = a.enSuspens.filter(t => t.id !== m.transaction)
        return rep({})
      }
      if (m.type === 'achat.acheter') {
        a.demandes.push({ produit: m.produit, jeton: m.jeton })
        if (a.issue === 'muet') return null
        if (a.issue !== 'achete' && a.issue !== 'ferme') return rep({ etat: a.issue })
        const transaction = await a.encaisser({ produit: m.produit, jeton: m.jeton })
        a.enSuspens.push({ id: transaction, produit: m.produit })
        if (a.issue === 'ferme') return null
        await a.auRetour?.()
        return rep({ etat: 'achete', transaction })
      }
    }
    return null
  })
  await ctx.addInitScript(() => {
    window.ReactNativeWebView = { postMessage(texte) {
      window.__natif(texte).then(r => { if (r) window.__babyNamedNatif?.(JSON.stringify(r)) })
    } }
    const c = () => {
      const s = document.createElement('style')
      s.textContent = '#nuxt-devtools-container{display:none!important;pointer-events:none!important}'
      document.head?.appendChild(s)
    }
    if (document.head) c(); else document.addEventListener('DOMContentLoaded', c)
  })
  const page = await ctx.newPage()
  natif.dire = message => page.evaluate(m => window.__babyNamedNatif?.(JSON.stringify(m)), message)
  return { ctx, page, natif }
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
