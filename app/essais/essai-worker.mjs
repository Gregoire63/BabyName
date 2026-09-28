/**
 * Ce qui ne se voit qu'une fois l'app empaquetée pour Cloudflare.
 *
 * Lancé par relance-worker.sh : le build de production, dans workerd. Ce
 * qu'on prouve :
 *  - on entre par un lien de connexion (le seul chemin d'un compte neuf :
 *    plus de clé d'accès) ;
 *  - une passkey se crée, puis sert à revenir (le 28/09, l'enregistrement
 *    plantait en production, erreur 500 : « tsyringe requires a reflect
 *    polyfill », alors que `nuxt dev` n'en disait rien) ;
 *  - l'échec d'une action s'affiche sous elle, pas en bas de l'écran ;
 *  - /api/sante ne dit que { ok } sans le secret d'administration, tout avec ;
 *  - aucune réponse 500 de tout le parcours.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const SECRET = process.env.CRON_SECRET
const JETON = process.env.ESSAI_JETON
if (!JETON) { console.error('Lancer via relance-worker.sh : il pose le compte et son lien.'); process.exit(2) }
const nav = await lancer()
const { ctx, page } = await onglet(nav)
const pannes = []
page.on('response', r => { if (r.status() >= 500) pannes.push(`${r.status()} ${r.url().replace(BASE, '')}`) })
const api = (chemin, init) => page.evaluate(async ([c, i]) => {
  const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
  return { status: r.status, j: await r.json().catch(() => null) }
}, [chemin, init])

// ---------- /api/sante -------------------------------------------------------
const pub = await fetch(`${BASE}/api/sante`).then(async r => ({ s: r.status, j: await r.json() }))
dit(pub.s === 200 && JSON.stringify(pub.j) === '{"ok":true}',
  `sans le secret, /api/sante ne dit que ${JSON.stringify(pub.j)}`)
const faux = await fetch(`${BASE}/api/sante`, { headers: { authorization: 'Bearer pas-le-bon' } }).then(r => r.json())
dit(!faux?.presence, 'un mauvais secret ne montre rien de plus')
const adm = await fetch(`${BASE}/api/sante`, { headers: { authorization: `Bearer ${SECRET}` } }).then(r => r.json())
dit(adm?.base?.joignable === true && (adm?.base?.migrations?.appliquees?.length ?? 0) > 0 && 'vente_ouverte' in (adm?.legal ?? {}),
  'avec le secret, le détail : base, migrations, mentions légales')

// ---------- une passkey, créée puis utilisée ------------------------------------
const cdp = await ctx.newCDPSession(page)
await cdp.send('WebAuthn.enable')
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
  protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
  hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })

// Le lien de l'e-mail (posé par relance-worker.sh) : un bouton avant de le
// consommer ; puis, compte sans passkey, elle est proposée — on la créera
// depuis « Mon compte », là où elle cassait.
await page.goto(`${BASE}/connexion/lien#t=${JETON}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Continuer' }).click()
await page.getByRole('button', { name: 'Plus tard' }).click({ timeout: 15000 })
await page.waitForSelector('.bento', { timeout: 20000 })
dit((await api('/api/auth/moi')).j?.utilisateur?.pseudo === 'Essai', 'le compte d’essai entre par son lien de connexion')
dit((await api('/api/auth/reprendre', { method: 'POST', body: JSON.stringify({ cle: 'ABCD-EFGH-JKMN' }) })).status === 404,
  'la route de l’ancienne clé d’accès n’existe plus')
await page.getByRole('button', { name: /^Mon compte :/ }).click()
await page.waitForSelector('.feuille-corps', { timeout: 8000 })
await page.getByRole('button', { name: 'Créer une passkey' }).click()
const message = page.locator('.feuille-corps .message')
await message.first().waitFor({ timeout: 15000 })
const texte = await message.first().innerText()
dit(/Passkey ajoutée/.test(texte), `la passkey se crée dans le Worker (« ${texte} »)`)
// Le message est dans le bloc des passkeys, juste sous le bouton.
const bloc = await page.evaluate(() => {
  const m = document.querySelector('.feuille-corps .message')
  return m?.parentElement?.querySelector('.sous-titre')?.textContent?.trim() ?? ''
})
dit(bloc === 'Passkeys', `et son message s’affiche dans le bloc « ${bloc} »`)
const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId })
dit(credentials.length === 1 && credentials[0].rpId === 'localhost', 'une passkey, liée au domaine')

await api('/api/auth/sortir', { method: 'POST' })
await ctx.addInitScript(() => {
  if (window.PublicKeyCredential) PublicKeyCredential.isConditionalMediationAvailable = async () => false
})
await page.goto(`${BASE}/connexion?mode=connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Se connecter avec une passkey' }).click()
await page.waitForURL(u => !u.pathname.startsWith('/connexion'), { timeout: 15000 }).catch(() => null)
const moi = (await api('/api/auth/moi')).j
dit(moi?.utilisateur?.pseudo === 'Essai' && moi.utilisateur.passkeys === 1,
  'déconnecté, on revient avec la passkey, dans le Worker aussi')

dit(pannes.length === 0, `aucune réponse 500 (${pannes.join(', ') || 'aucune'})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
