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
 *  - les apps des stores (essai-coquille les éprouve en entier, sous
 *    `nuxt dev`) : ici, ce qui dépend du Worker — les deux fichiers
 *    .well-known et les adresses que l'app ouvre sont bien servis, le compte
 *    de démonstration entre sans e-mail, et une notification part APRÈS la
 *    réponse (`waitUntil` : sous Node la promesse court toute seule, dans le
 *    Worker elle serait coupée net) ;
 *  - l'achat de l'app iPhone (essai-apple l'éprouve en entier, sous
 *    `nuxt dev`) : ici, que le Worker sait signer sa demande à Apple — ES256,
 *    par le WebCrypto de workerd et non celui de Node — et débloquer, dans
 *    l'état où Apple validera l'app : JAMAIS SORTIE, sa production refuse
 *    tout (401) et seul son bac à sable répond ;
 *  - aucune réponse 500 de tout le parcours.
 *
 * Le Worker est lancé avec essai-worker.env (faux Expo sur 3198, faux Apple
 * sur 3197).
 */
import { createServer } from 'node:http'
import { createPrivateKey, createPublicKey, verify } from 'node:crypto'
import { lancer, onglet, ongletApp, compteur, BASE } from './navigateur.mjs'

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

// ---------- un faux Apple (3197) ---------------------------------------------
// Dès le départ : /api/sante, plus bas, lui fait essayer la clé du Worker, et
// un Apple absent à ce moment-là fermerait la vente pour la minute qui suit.
// Un faux Apple, qui vérifie la signature de la demande avec la clé d'essai.
// Il commence dans l'état d'une app JAMAIS SORTIE sur l'App Store : sa
// production refuse tout (401), même une bonne clé, et seul son bac à sable
// répond. C'est dans cet état que le Worker en ligne servira TestFlight, puis
// la validation d'Apple.
const clePublique = createPublicKey(createPrivateKey(
  { key: Buffer.from(process.env.NUXT_APPLE_IAP_CLE ?? '', 'base64'), format: 'der', type: 'pkcs8' }))
/** numéro → { env: 'prod' | 'bac', t: le contenu de la transaction } */
const transactions = new Map()
const demandes = []
let sortie = false
const apple = createServer((req, res) => {
  const repondre = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
  const [, env, id] = req.url.match(/^\/(prod|bac)\/inApps\/v1\/transactions\/(\d+)$/) ?? []
  const [e, c, s] = String(req.headers.authorization ?? '').replace(/^Bearer /, '').split('.')
  let entete = null, signe = false
  try {
    entete = JSON.parse(Buffer.from(e, 'base64url').toString())
    signe = verify('sha256', Buffer.from(`${e}.${c}`), { key: clePublique, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))
  } catch { /* illisible : refusé */ }
  // (« 0 » : la sonde par laquelle le serveur essaie sa clé avant d'ouvrir la vente.)
  if (id !== '0') demandes.push({ env, id, alg: entete?.alg, signe })
  if (!signe || !env) return repondre(401, {})
  if (env === 'prod' && !sortie) return repondre(401, {})
  const t = transactions.get(id)
  if (!t || t.env !== env) return repondre(404, { errorCode: 4040010 })
  const b64 = x => Buffer.from(JSON.stringify(x)).toString('base64url')
  repondre(200, { signedTransactionInfo: `${b64({ alg: 'ES256' })}.${b64(t.t)}.${Buffer.from('signature').toString('base64url')}` })
})
await new Promise(r => apple.listen(3197, '127.0.0.1', r))


// ---------- /api/sante -------------------------------------------------------
const pub = await fetch(`${BASE}/api/sante`).then(async r => ({ s: r.status, j: await r.json() }))
dit(pub.s === 200 && JSON.stringify(pub.j) === '{"ok":true}',
  `sans le secret, /api/sante ne dit que ${JSON.stringify(pub.j)}`)
const faux = await fetch(`${BASE}/api/sante`, { headers: { authorization: 'Bearer pas-le-bon' } }).then(r => r.json())
dit(!faux?.presence, 'un mauvais secret ne montre rien de plus')
const adm = await fetch(`${BASE}/api/sante`, { headers: { authorization: `Bearer ${SECRET}` } }).then(r => r.json())
dit(adm?.base?.joignable === true && (adm?.base?.migrations?.appliquees?.length ?? 0) > 0 && 'vente_ouverte' in (adm?.legal ?? {}),
  'avec le secret, le détail : base, migrations, mentions légales')
dit(adm?.presence?.achat_apple === true && adm?.presence?.achat_apple_cle_acceptee === true
    && adm?.presence?.achat_apple_production === false,
  'et si Apple accepte la clé des achats de l’app iPhone : oui, par son bac à sable — pas encore par sa production, l’app n’est jamais sortie')

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

// ---------- les apps des stores, dans le Worker --------------------------------
{
  const recus = []
  const expo = createServer(async (req, res) => {
    let corps = ''
    for await (const c of req) corps += c
    const messages = JSON.parse(corps || '[]')
    recus.push(...messages)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: messages.map(() => ({ status: 'ok', id: 'essai' })) }))
  })
  await new Promise(r => expo.listen(3198, '127.0.0.1', r))

  const aasa = await fetch(`${BASE}/.well-known/apple-app-site-association`)
  const j = await aasa.json().catch(() => null)
  const liens = await fetch(`${BASE}/.well-known/assetlinks.json`)
  const a = await liens.json().catch(() => null)
  dit(aasa.status === 200 && /json/.test(aasa.headers.get('content-type') ?? '')
      && j?.applinks?.details?.[0]?.appIDs?.[0] === 'ABCDE12345.fr.babynamed.app'
      && liens.status === 200 && a?.[0]?.target?.package_name === 'fr.babynamed.app',
    `le Worker sert les deux fichiers qui lient le site aux apps (${aasa.status}, ${liens.status})`)
  const adresses = await Promise.all(['/rejoindre/dec0de00', '/connexion/app', '/rejoindre/a/b']
    .map(c => fetch(`${BASE}${c}`).then(r => r.status)))
  dit(JSON.stringify(adresses) === '[200,200,404]',
    `les deux adresses que l’app ouvre répondent, pas leurs voisines (${adresses.join(', ')})`)

  // Le compte de démonstration, dans l'app Android : pas d'e-mail, un code fixe.
  const app = await ongletApp(nav, 'android')
  app.page.on('response', r => { if (r.status() >= 500) pannes.push(`${r.status()} ${r.url().replace(BASE, '')}`) })
  const dansApp = (chemin, init) => app.page.evaluate(async ([c, i]) => {
    const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
    return { status: r.status, j: await r.json().catch(() => null) }
  }, [chemin, init])
  // Par l'API : ce Worker d'essai n'a pas d'envoi d'e-mails réglé, et l'écran
  // ne montre alors pas le champ de l'adresse (essai-coquille passe par l'écran).
  await app.page.goto(`${BASE}/connexion?mode=connexion`, { waitUntil: 'networkidle' })
  const demande = await dansApp('/api/auth/lien', { method: 'POST', body: JSON.stringify({ email: 'demo@exemple.test' }) })
  const faux = await dansApp('/api/auth/code', { method: 'POST', body: JSON.stringify({ email: 'demo@exemple.test', code: '000000', but: 'connexion' }) })
  const juste = await dansApp('/api/auth/code', { method: 'POST', body: JSON.stringify({ email: 'demo@exemple.test', code: '424242', but: 'connexion' }) })
  await app.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await app.page.waitForSelector('.bento', { timeout: 20000 })
  dit(demande.status === 200 && faux.status === 400 && juste.status === 200
      && (await dansApp('/api/auth/moi')).j?.utilisateur?.pseudo === 'Démo',
    `le compte de démonstration des stores entre avec son code fixe, sans e-mail (${demande.status}, ${faux.status}, ${juste.status})`)

  const liste = (await dansApp('/api/groupes', { method: 'POST', body: JSON.stringify({ nom: 'Démonstration' }) })).j
  const code = (await dansApp(`/api/groupes/${liste?.id}`)).j?.groupe?.code_invitation
  const achat = await dansApp(`/api/groupes/${liste?.id}/paiement`, { method: 'POST', body: JSON.stringify({ consentement: true }) })
  dit(achat.status === 403 && achat.j?.statusMessage === 'vente_fermee_dans_l_app',
    `depuis l’app, le Worker refuse l’achat (HTTP ${achat.status})`)
  await app.page.goto(`${BASE}/g/${liste?.id}/reglages`, { waitUntil: 'networkidle' })
  await app.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' }).click({ timeout: 20000 })
  await app.page.getByRole('button', { name: 'Ne plus me prévenir' }).waitFor({ timeout: 10000 })

  // « Essai » suit le lien d'invitation dans son navigateur : le téléphone de
  // la démonstration doit l'apprendre, par un envoi parti après la réponse.
  await page.goto(`${BASE}/rejoindre/${code}`, { waitUntil: 'networkidle' })
  await page.waitForURL(new RegExp(`/g/${liste?.id}/swipe`), { timeout: 20000 })
  let m = null
  for (let i = 0; i < 50 && !m; i++) {
    m = recus.find(x => x.to === app.natif.jeton)
    if (!m) await new Promise(r => setTimeout(r, 120))
  }
  dit(m?.title === 'Démonstration' && m.body === 'Essai a rejoint votre liste.' && m.data?.chemin === `/g/${liste?.id}/reglages`,
    `dans le Worker, la notification part après la réponse (« ${m?.title} — ${m?.body} »)`)
  expo.close()

  // ---------- l'achat de l'app iPhone ---------------------------------------
  const iphone = await ongletApp(nav, 'ios')
  iphone.page.on('response', r => { if (r.status() >= 500) pannes.push(`${r.status()} ${r.url().replace(BASE, '')}`) })
  const surIphone = (chemin, init) => iphone.page.evaluate(async ([c, i]) => {
    const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
    return { status: r.status, j: await r.json().catch(() => null) }
  }, [chemin, init])
  await iphone.page.goto(`${BASE}/connexion?mode=connexion`, { waitUntil: 'networkidle' })
  await surIphone('/api/auth/lien', { method: 'POST', body: JSON.stringify({ email: 'demo@exemple.test' }) })
  await surIphone('/api/auth/code', { method: 'POST', body: JSON.stringify({ email: 'demo@exemple.test', code: '424242', but: 'connexion' }) })
  const etatVente = (await surIphone('/api/achats-apple/etat')).j
  const aDebloquer = (await surIphone('/api/groupes', { method: 'POST', body: JSON.stringify({ nom: 'Pomme' }) })).j
  const prep = await surIphone(`/api/groupes/${aDebloquer?.id}/achat-apple`, { method: 'POST', body: '{}' })
  // Un achat du bac à sable : celui d'un testeur TestFlight, ou d'Apple qui valide l'app.
  transactions.set('2000000100000001', { env: 'bac', t: { transactionId: '2000000100000001', bundleId: 'fr.babynamed.app',
    productId: etatVente?.produit, environment: 'Sandbox', purchaseDate: Date.now(), appAccountToken: prep.j?.jeton } })
  const valide = await surIphone('/api/achats-apple', { method: 'POST', body: JSON.stringify({ transaction: '2000000100000001' }) })
  const debloquee = (await surIphone(`/api/groupes/${aDebloquer?.id}`)).j?.groupe
  dit(etatVente?.ouvert === true && prep.status === 200 && !!prep.j?.jeton,
    'app jamais sortie : le Worker ouvre la vente quand même, sur la foi du bac à sable d’Apple')
  dit(demandes.map(d => d.env).join() === 'prod,bac' && demandes.every(d => d.alg === 'ES256' && d.signe === true),
    `dans le Worker, la demande à Apple est signée par le WebCrypto de workerd (${demandes[0]?.alg}, signature ${demandes[0]?.signe ? 'valide' : 'refusée'}) — à la production, qui refuse, puis au bac à sable`)
  dit(valide.status === 200 && valide.j?.etat === 'applique' && debloquee?.paye === true && debloquee?.offert === true,
    `et l’achat du bac à sable débloque la liste, notée offerte (${valide.j?.etat ?? valide.status})`)
  // Le jour de la sortie, la production se met à répondre : /api/sante le voit
  // tout de suite, sans attendre l'heure pendant laquelle le Worker garde sa réponse.
  sortie = true
  const apres = await fetch(`${BASE}/api/sante`, { headers: { authorization: `Bearer ${SECRET}` } }).then(r => r.json())
  dit(apres?.presence?.achat_apple_cle_acceptee === true && apres?.presence?.achat_apple_production === true,
    'l’app sortie, /api/sante dit aussitôt que la production d’Apple accepte la clé')
  apple.close()
}

dit(pannes.length === 0, `aucune réponse 500 (${pannes.join(', ') || 'aucune'})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
