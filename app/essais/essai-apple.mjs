/**
 * L'achat dans l'app iOS (l'achat intégré de l'App Store), contre un faux
 * Apple local qui vérifie notre signature.
 *
 * Sur iPhone, c'est Apple qui encaisse ; le serveur ne reçoit qu'un numéro de
 * transaction, qu'il relit chez Apple (server/utils/apple.ts).
 *
 * LE SERVEUR, sans écran (`partieServeur`) :
 *   - la demande faite à Apple est bien signée (ES256, les bons champs), et
 *     la vente ne s'ouvre que si Apple accepte la clé ;
 *   - c'est le JETON rendu par Apple qui désigne la liste, jamais l'app ;
 *   - une transaction ne débloque qu'une liste, une fois, qui que ce soit
 *     qui la présente ; un jeton ne sert qu'à un achat ;
 *   - une transaction inconnue, d'un autre produit ou d'une autre app, ne
 *     débloque rien ;
 *   - le bac à sable (TestFlight, la validation d'Apple) débloque, mais la
 *     liste est notée « offerte » ;
 *   - AVANT LA SORTIE DE L'APP, la production d'Apple refuse tout (401) et
 *     seul son bac à sable répond : la vente est ouverte quand même, un achat
 *     du bac à sable débloque — sans quoi Apple ne pourrait pas valider
 *     l'app — et l'on ne dit pas « inconnue » d'une transaction que l'on n'a
 *     pas pu chercher partout ;
 *   - deux parents, deux caisses (Stripe sur le site, Apple dans l'app) : un
 *     seul paie ; et l'achat arrivé trop tard n'est pas perdu, il sert à la
 *     liste suivante — dans l'app comme sur le site, avant toute caisse ;
 *   - un remboursement accordé par Apple re-verrouille ; un faux courrier
 *     n'y peut rien, même s'il affirme ;
 *   - l'achat qu'Apple annonce lui-même débloque sans attendre l'app (fermée
 *     en plein achat), et un faux courrier ne désigne aucune liste ;
 *   - Apple en panne : rien ne se débloque sur un doute, et sa feuille
 *     d'achat ne s'ouvre pas.
 *
 * L'ÉCRAN, dans un navigateur qui se présente comme l'app iOS, avec un faux
 * téléphone (`partieEcran`) :
 *   - pas d'offre tant que le téléphone ou le serveur ne sait pas vendre ;
 *   - le prix d'Apple, jamais celui du site ; ni Stripe, ni case d'accord,
 *     ni code cadeau ; les conditions de vente selon l'endroit ;
 *   - la feuille d'Apple refermée, l'accord à donner, la transaction qui
 *     arrive plus tard ;
 *   - l'app fermée en plein achat, Apple en retard, Apple en panne : la
 *     transaction n'est dite « traitée » qu'après la réponse du serveur, et
 *     l'on ne fait jamais payer deux fois ;
 *   - un achat d'avance : « déjà payé », sans prix.
 *
 * Le serveur est lancé avec essai-apple.env (une clé tirée pour l'essai, le
 * faux Apple sur 3197, le faux Stripe sur 3199).
 */
import { createServer } from 'node:http'
import { createHmac, createPrivateKey, createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, onglet, ongletApp, BASE, entrerComme, aller } from './navigateur.mjs'

const CLE = process.env.NUXT_APPLE_IAP_CLE
if (!CLE) { console.error('Lancer via relance.sh : essai-apple.env n’a pas été chargé.'); process.exit(2) }
const PRODUIT = 'fr.babynamed.app.deblocage'
const PAQUET = 'fr.babynamed.app'

const ok = [], ko = []
const dit = (c, m) => {
  (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m)
  // Pour saboter une garde à la fois (LISEZMOI) : un échec suffit à la dire vue.
  if (!c && process.env.ESSAI_ARRET_AU_PREMIER_ECHEC) process.exit(1)
}
/** axe-core, pour les écrans que seule l'app iOS montre (essai-accessibilite ne les voit pas). */
const AXE = (() => {
  try { return readFileSync(process.env.ESSAI_AXE || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8') }
  catch { return null }
})()
async function auditer(page, racine, nom) {
  if (!AXE) return
  await page.evaluate(AXE)
  const v = await page.evaluate(async sel => (await window.axe.run(sel ? document.querySelector(sel) : document,
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(x => x.id), racine)
  dit(v.length === 0, `${nom} : aucune violation WCAG A/AA${v.length ? ` (${v.join(', ')})` : ''}`)
}
const b64url = x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')
/** Un jeton « signé » comme ceux d'Apple. La signature est bidon : le serveur
 *  ne croit ce contenu que parce qu'il l'a reçu d'Apple lui-même. */
const jws = contenu => `${b64url({ alg: 'ES256', x5c: [] })}.${b64url(contenu)}.${b64url('signature')}`

// ------------------------------------------------------------- faux Apple --
const clePublique = createPublicKey(createPrivateKey({ key: Buffer.from(CLE, 'base64'), format: 'der', type: 'pkcs8' }))
/** numéro → { env: 'prod' | 'bac', t: le contenu de la transaction } */
const transactions = new Map()
const appels = []
const sondes = []
let panne = 0
/** Une réponse forcée, pour UN environnement : `seul.prod = 401` est l'état
 *  d'une app jamais sortie (la production refuse tout, le bac à sable répond). */
const seul = { prod: 0, bac: 0 }
/** Apple accepte toujours notre clé (la sonde passe), mais ne sait plus lire
 *  une transaction. */
let panneLecture = 0
let numero = 2000000100000000n
const apple = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const repondre = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
  const m = url.pathname.match(/^\/(prod|bac)\/inApps\/v1\/transactions\/([^/]+)$/)
  if (req.method !== 'GET' || !m) return repondre(404, { errorCode: 4040000 })
  // Le jeton d'accès, vérifié comme le ferait Apple.
  const [e, c, s] = String(req.headers.authorization ?? '').replace(/^Bearer /, '').split('.')
  let entete = null, corps = null, signe = false
  try {
    entete = JSON.parse(Buffer.from(e, 'base64url').toString())
    corps = JSON.parse(Buffer.from(c, 'base64url').toString())
    signe = verify('sha256', Buffer.from(`${e}.${c}`), { key: clePublique, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))
  } catch { /* illisible : refusé plus bas */ }
  // « 0 » : la sonde du serveur (Apple accepte-t-il notre clé ?), rangée à part.
  ;(m[2] === '0' ? sondes : appels).push({ env: m[1], id: m[2], entete, corps, signe })
  if (panne) return repondre(panne, { errorCode: panne * 10000, errorMessage: 'essai' })
  if (panneLecture && m[2] !== '0') return repondre(panneLecture, { errorCode: panneLecture * 10000, errorMessage: 'essai' })
  if (seul[m[1]]) return repondre(seul[m[1]], seul[m[1]] === 401 ? {} : { errorCode: seul[m[1]] * 10000, errorMessage: 'essai' })
  if (!signe || corps?.aud !== 'appstoreconnect-v1') return repondre(401, {})
  const t = transactions.get(m[2])
  if (!t || t.env !== m[1]) return repondre(404, { errorCode: 4040010, errorMessage: 'Transaction id not found.' })
  repondre(200, { signedTransactionInfo: jws(t.t) })
})
await new Promise(r => apple.listen(3197, '127.0.0.1', r))

/** Un achat fait dans l'app : la transaction existe désormais chez (le faux) Apple. */
function acheter({ jeton, env = 'prod', produit = PRODUIT, paquet = PAQUET, ...autres } = {}) {
  const id = String(++numero)
  transactions.set(id, { env, t: {
    transactionId: id, originalTransactionId: id, bundleId: paquet, productId: produit, type: 'Consumable',
    environment: env === 'bac' ? 'Sandbox' : 'Production', purchaseDate: Date.now(), quantity: 1,
    ...(jeton ? { appAccountToken: jeton } : {}), ...autres
  } })
  return id
}
const rembourser = (id, champs = { revocationDate: Date.now(), revocationType: 'REFUND_FULL', revocationPercentage: 100000 }) =>
  Object.assign(transactions.get(id).t, champs)
const annulerRemboursement = (id) => {
  for (const k of ['revocationDate', 'revocationType', 'revocationPercentage', 'revocationReason']) delete transactions.get(id).t[k]
}

// -------------------------------------------------------------- faux Expo --
// Le service d'acheminement des notifications : la liste débloquée dans l'app
// de l'un, l'autre l'apprend sur son téléphone (server/utils/push.ts).
const notifications = []
const expo = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const lot = JSON.parse(corps || '[]')
  notifications.push(...lot)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ data: lot.map(() => ({ status: 'ok', id: 'essai' })) }))
})
await new Promise(r => expo.listen(3198, '127.0.0.1', r))
const JETON_PAUL = 'ExponentPushToken[essai-apple-paul]', JETON_ALICE = 'ExponentPushToken[essai-apple-alice]'
const DEBLOQUEE = qui => `${qui} a débloqué la liste : swipes illimités, pour vous aussi.`
/** Ce qu'a reçu ce téléphone depuis `depuis` — après avoir laissé aux envois le temps de partir. */
async function recu(jeton, depuis, attendu = 1) {
  const fin = Date.now() + (attendu ? 6000 : 1200)
  for (;;) {
    const m = notifications.slice(depuis).filter(x => x.to === jeton)
    if ((attendu && m.length >= attendu) || Date.now() > fin) return m
    await new Promise(r => setTimeout(r, 100))
  }
}

// ------------------------------------------------------------ faux Stripe --
// Juste de quoi ouvrir une page de paiement sur le site, pour l'autre parent.
const sessions = new Map()
let nStripe = 0
const stripe = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const url = new URL(req.url, 'http://x')
  const repondre = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    const f = new URLSearchParams(corps)
    const id = `cs_test_apple${++nStripe}`
    const s = { id, object: 'checkout.session', status: 'open', payment_status: 'unpaid', amount_total: 600,
      client_reference_id: f.get('client_reference_id'),
      metadata: { groupe_id: f.get('metadata[groupe_id]'), user_id: f.get('metadata[user_id]') },
      url: `http://127.0.0.1:3199/payer/${id}` }
    sessions.set(id, s)
    return repondre(200, s)
  }
  const m = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_[\w]+)(\/expire)?$/)
  if (m && sessions.has(m[1])) {
    if (m[2]) sessions.get(m[1]).status = 'expired'
    return repondre(200, sessions.get(m[1]))
  }
  if (req.method === 'POST' && url.pathname === '/v1/refunds') return repondre(200, { id: 're_essai' })
  repondre(404, { error: { message: 'inconnu' } })
})
await new Promise(r => stripe.listen(3199, '127.0.0.1', r))
const webhookStripe = async (ev) => {
  const corps = JSON.stringify(ev)
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', process.env.NUXT_STRIPE_WEBHOOK_SECRET).update(`${t}.${corps}`).digest('hex')
  const r = await fetch(`${BASE}/api/paiement/webhook`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` }, body: corps })
  return r.status
}

// -------------------------------------------------------------- outillage --
const nav = await lancer()
const erreurs = []
const api = (page, chemin, init) => page.evaluate(async ([c, i]) => {
  const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
  return { status: r.status, j: await r.json().catch(() => null) }
}, [chemin, init])
const poster = (page, chemin, corps = {}) => api(page, chemin, { method: 'POST', body: JSON.stringify(corps) })
async function entrer(page, qui) {
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  await aller(page, `${BASE}/connexion`)
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 25000 })
}

// Paul dans l'app iOS, Alice dans un navigateur, Mamie dans l'app Android.
const iphone = await ongletApp(nav, 'ios')
const paul = iphone.page
await entrer(paul, 'Paul')
const alice = (await onglet(nav)).page
await entrer(alice, 'Alice')
const mamie = (await ongletApp(nav, 'android')).page
await entrer(mamie, 'Mamie')
// Les téléphones de Paul et d'Alice sont prévenus de ce qui se passe dans leurs listes.
await poster(paul, '/api/appareils', { jeton: JETON_PAUL, plateforme: 'ios' })
await poster(alice, '/api/appareils', { jeton: JETON_ALICE, plateforme: 'ios' })

const nouvelleListe = async (nom, page = paul) => (await poster(page, '/api/groupes', { nom })).j
const etat = async (gid, page = paul) => (await api(page, `/api/groupes/${gid}`)).j?.groupe
const statut = async (gid, page = paul) => (await api(page, `/api/groupes/${gid}/paiement-statut`)).j
const preparer = (gid, page = paul) => poster(page, `/api/groupes/${gid}/achat-apple`)
const valider = (transaction, page = paul, plus = {}) => poster(page, '/api/achats-apple', { transaction, ...plus })
const rejoindre = (liste, page) => poster(page, '/api/groupes/rejoindre', { code: liste.code_invitation })
/** Un courrier « d'Apple ». `pretend` : ce qu'il affirme de la transaction, en plus (ou à la place) de ce qu'Apple en sait. */
const courrier = async (type, id, { connu = true, pretend = {} } = {}) => {
  const t = transactions.get(id)?.t ?? { transactionId: id }
  const r = await fetch(`${BASE}/api/apple/notifications`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signedPayload: jws({ notificationType: type, notificationUUID: `essai-${Math.random()}`,
      version: '2.0', signedDate: Date.now(),
      data: { bundleId: PAQUET, environment: 'Production',
        signedTransactionInfo: jws(connu ? { ...t, ...pretend } : { transactionId: id }) } }) }) })
  return { status: r.status, j: await r.json().catch(() => null) }
}

/** Le serveur seul, sans écran : ce que disent ses réponses. */
async function partieServeur() {
// ============ 0. L'app iOS peut vendre, et elle seule =====================
{
  const e = (await api(paul, '/api/achats-apple/etat')).j
  dit(e?.ouvert === true && e?.produit === PRODUIT, `le serveur dit à l’app iOS qu’elle peut vendre, et quel produit (${e?.produit})`)
  // … après l'avoir demandé à Apple : une clé posée n'est pas une clé acceptée.
  const s = sondes.at(-1)
  dit(s?.env === 'prod' && s?.signe === true && s?.corps?.bid === PAQUET,
    'avant d’ouvrir la vente, il a essayé sa clé chez Apple, pour de bon')
  panne = 401
  const refusee = (await api(paul, '/api/achats-apple/etat')).j
  panne = 500
  const enPanne = (await api(paul, '/api/achats-apple/etat')).j
  panne = 0
  // La production seule en panne, le bac à sable debout : fermée aussi. Les
  // vrais achats se vérifient en production.
  seul.prod = 500
  const sansProduction = (await api(paul, '/api/achats-apple/etat')).j
  seul.prod = 0
  const revenue = (await api(paul, '/api/achats-apple/etat')).j
  dit(refusee?.ouvert === false && refusee?.produit === null && enPanne?.ouvert === false && revenue?.ouvert === true,
    'une clé qu’Apple refuse, ou Apple en panne : la vente reste fermée — pas d’offre qui encaisserait sans pouvoir débloquer')
  dit(sansProduction?.ouvert === false, 'la production d’Apple en panne, son bac à sable debout : fermée aussi')
  const sante = (await api(paul, '/api/sante')).j?.presence
  dit(sante?.achat_apple_cle_acceptee === true && sante?.achat_apple_production === true,
    '/api/sante dit que la clé est acceptée, et par la production')
}
const A = await nouvelleListe('Pomme A')
{
  await rejoindre(A, alice); await rejoindre(A, mamie)
  const depuisNavigateur = await preparer(A.id, alice)
  const depuisAndroid = await preparer(A.id, mamie)
  dit(depuisNavigateur.status === 403 && depuisAndroid.status === 403,
    `l’achat par l’App Store ne se prépare que dans l’app iOS (navigateur : ${depuisNavigateur.status}, Android : ${depuisAndroid.status})`)
  const stripeDansLApp = await poster(paul, `/api/groupes/${A.id}/paiement`, { consentement: true })
  dit(stripeDansLApp.status === 403, `et la caisse du site reste fermée dans l’app iOS (HTTP ${stripeDansLApp.status})`)
}

// ============ 1. Préparer : un jeton, la place prise ======================
const pA = await preparer(A.id)
dit(pA.status === 200 && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(pA.j?.jeton ?? '')
    && pA.j?.produit === PRODUIT, `avant l’achat, le serveur tire un jeton pour cette liste (${String(pA.j?.jeton).slice(0, 8)}…)`)
{
  const s = await statut(A.id, alice)
  dit(s?.paye === false && s?.en_cours?.par === 'Paul' && s?.en_cours?.moi === false,
    `l’autre parent voit qu’un achat est en cours (${s?.en_cours?.par})`)
  dit((await etat(A.id))?.paye === false, 'et rien n’est débloqué tant qu’Apple n’a rien dit')
}

// ============ 2. L'achat : relu chez Apple, la liste débloquée ============
const tA = acheter({ jeton: pA.j.jeton })
{
  const avant = appels.length
  const nAvant = notifications.length
  const v = await valider(tA)
  const eA = await etat(A.id)
  const n = await recu(JETON_ALICE, nAvant)
  dit(n.length === 1 && n[0].title === 'Pomme A' && n[0].body === DEBLOQUEE('Paul') && n[0].channelId === 'activite'
      && (await recu(JETON_PAUL, nAvant, 0)).length === 0,
    `l’autre parent l’apprend sur son téléphone, pas celui qui vient de payer (« ${n[0]?.body} »)`)
  dit(v.status === 200 && v.j?.etat === 'applique' && v.j?.groupe === A.id && eA?.paye === true,
    `l’achat relu chez Apple débloque la liste (${v.j?.etat})`)
  dit(eA?.offert === false, 'elle est comptée comme vendue, pas offerte')
  const s = await statut(A.id, alice)
  dit(s?.paye === true && s?.par === 'Paul' && !s?.en_cours, `l’autre parent la voit débloquée par ${s?.par}, et la place est rendue`)
  dit(s?.par_moi === false && (await statut(A.id))?.par_moi === true, 'chacun sait si c’est lui qui l’a payée')
  const a = appels[avant]
  dit(appels.length === avant + 1 && a?.env === 'prod' && a?.id === tA, 'une seule demande à Apple, à la production d’abord')
  dit(a?.signe === true && a?.entete?.alg === 'ES256' && a?.entete?.typ === 'JWT' && a?.entete?.kid === 'CLEESSAI01',
    'la demande est signée en ES256, avec l’identifiant de la clé')
  dit(a?.corps?.iss === '11111111-2222-4333-8444-555555555555' && a?.corps?.aud === 'appstoreconnect-v1'
      && a?.corps?.bid === PAQUET && a?.corps?.exp - a?.corps?.iat > 0 && a?.corps?.exp - a?.corps?.iat <= 1200
      && Math.abs(a?.corps?.iat - Date.now() / 1000) < 120,
    `et porte l’émetteur, l’app, et une échéance courte (${(a?.corps?.exp - a?.corps?.iat) / 60} min ; Apple refuse au-delà d’une heure)`)
  dit(!JSON.stringify(v.j).includes(CLE.slice(0, 20)) && !JSON.stringify(pA.j).includes(CLE.slice(0, 20)),
    'la clé ne quitte jamais le serveur')
}

// ============ 3. Une transaction ne sert qu'une fois ======================
const B = await nouvelleListe('Pomme B')
{
  const nAvant = notifications.length
  let v = await valider(tA)
  dit(v.status === 200 && v.j?.etat === 'applique' && v.j?.groupe === A.id, 'la même transaction, présentée de nouveau : même réponse, rien de plus')
  v = await valider(tA, alice)
  dit((await recu(JETON_ALICE, nAvant, 0)).length === 0 && (await recu(JETON_PAUL, nAvant, 0)).length === 0,
    'et le déblocage n’est pas annoncé une seconde fois')
  dit(v.status === 200 && v.j?.groupe === A.id && (await etat(B.id))?.paye === false,
    'présentée par quelqu’un d’autre : toujours la liste d’origine, aucune autre')
  // L'app ne choisit pas la liste : ce qu'elle ajoute au corps n'est pas lu.
  const pB = await preparer(B.id)
  const tB = acheter({ jeton: pB.j.jeton })
  const C = await nouvelleListe('Pomme C')
  v = await valider(tB, paul, { groupe: C.id, groupe_id: C.id, liste: C.id })
  dit(v.j?.groupe === B.id && (await etat(B.id))?.paye === true && (await etat(C.id))?.paye === false,
    'c’est le jeton rendu par Apple qui désigne la liste : en nommer une autre dans la requête ne change rien')
  // Un jeton ne sert qu'à UN achat. Un second achat qui le porte aussi (une
  // app fautive, ou bricolée) ne prend pas la place du premier : il reste
  // d'avance, à qui le présente — ici Mamie, pour ne rien devoir à Paul.
  const tB2 = acheter({ jeton: pB.j.jeton })
  v = await valider(tB2, mamie)
  const premier = await valider(tB)
  dit(v.j?.etat === 'avance' && premier.j?.etat === 'applique' && premier.j?.groupe === B.id,
    `un second achat portant le même jeton n’écrase pas le premier : il reste d’avance (${v.j?.etat}, ${premier.j?.etat})`)
}

// ============ 4. Ce qui ne débloque rien ==================================
const D = await nouvelleListe('Pomme D')
{
  const pD = await preparer(D.id)
  let v = await valider('2000000999999999')
  dit(v.status === 404 && v.j?.statusMessage === 'transaction_inconnue', `une transaction qu’Apple ne connaît pas : refusée (HTTP ${v.status})`)
  dit(appels.at(-2)?.env === 'prod' && appels.at(-1)?.env === 'bac', 'après avoir demandé à la production, puis au bac à sable')
  const avant = appels.length
  v = await valider('abc; drop table groupes')
  const v2 = await valider('')
  dit(v.status === 400 && v2.status === 400 && appels.length === avant, 'un numéro qui n’en est pas un : refusé sans déranger Apple')
  v = await valider(acheter({ jeton: pD.j.jeton, produit: 'fr.babynamed.app.autre' }))
  dit(v.status === 200 && v.j?.etat === 'etrangere', `un autre produit : rien (${v.j?.etat})`)
  v = await valider(acheter({ jeton: pD.j.jeton, paquet: 'com.exemple.autre' }))
  dit(v.j?.etat === 'etrangere' && (await etat(D.id))?.paye === false, 'une autre app : rien non plus, la liste reste bloquée')
  const sansSession = await fetch(`${BASE}/api/achats-apple`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transaction: tA }) })
  dit(sansSession.status === 401, `sans être connecté : refusé (HTTP ${sansSession.status})`)
}

// ============ 5. Apple en panne : rien sur un doute =======================
{
  const pD = await preparer(D.id)
  const tD = acheter({ jeton: pD.j.jeton })
  panne = 500
  let v = await valider(tD)
  dit(v.status === 502 && v.j?.statusMessage === 'achat_indisponible' && (await etat(D.id))?.paye === false,
    `Apple en panne : pas de déblocage, l’app gardera la transaction (HTTP ${v.status})`)
  panne = 401
  v = await valider(tD)
  dit(v.status === 502 && !JSON.stringify(v.j).includes('401'), 'une clé refusée par Apple : même réponse, sans détail pour le navigateur')
  // Tant qu'on ne peut rien vérifier chez Apple, on n'ouvre pas sa feuille :
  // elle encaisserait, et l'on ne pourrait pas débloquer.
  panne = 500
  const D2 = await nouvelleListe('Pomme D2')
  await rejoindre(D2, alice)
  const refuse = await preparer(D2.id)
  dit(refuse.status === 503 && refuse.j?.statusMessage === 'achat_indisponible' && !refuse.j?.jeton
      && !(await statut(D2.id, alice))?.en_cours,
    `Apple en panne : le serveur ne laisse pas ouvrir la feuille d’achat, et ne prend pas la place (HTTP ${refuse.status})`)
  panne = 0
  const rouvert = await preparer(D2.id)
  dit(rouvert.status === 200 && !!rouvert.j?.jeton, 'Apple revenu, l’achat se prépare de nouveau')
  await poster(paul, `/api/groupes/${D2.id}/annuler-paiement`)
  v = await valider(tD)
  dit(v.j?.etat === 'applique' && (await etat(D.id))?.paye === true, 'et la transaction restée en suspens débloque')
}

// ============ 6. Le bac à sable ===========================================
{
  const E = await nouvelleListe('Pomme E')
  const pE = await preparer(E.id)
  const tE = acheter({ jeton: pE.j.jeton, env: 'bac' })
  const v = await valider(tE)
  const eE = await etat(E.id)
  dit(v.j?.etat === 'applique' && eE?.paye === true, 'un achat du bac à sable (TestFlight, la validation d’Apple) débloque')
  dit(eE?.offert === true, 'mais la liste est notée offerte : ce n’est pas une vente')
}

// ============ 6 bis. Avant la sortie : la production d'Apple refuse tout ===
// Tant que l'app n'est jamais sortie sur l'App Store, l'API de production
// d'Apple répond 401 à TOUT, même à une bonne clé ; seul son bac à sable
// répond. C'est l'état dans lequel l'app est essayée (TestFlight), puis
// validée par Apple : si la vente y restait fermée, ou si l'achat n'y
// débloquait pas, Apple refuserait l'app faute d'avoir pu acheter.
{
  seul.prod = 401
  let avant = sondes.length
  const e = (await api(paul, '/api/achats-apple/etat')).j
  dit(e?.ouvert === true && sondes.length === avant + 2 && sondes.at(-2)?.env === 'prod' && sondes.at(-1)?.env === 'bac',
    'app jamais sortie (la production d’Apple refuse tout, son bac à sable accepte la clé) : la vente est ouverte')
  const sante = (await api(paul, '/api/sante')).j?.presence
  dit(sante?.achat_apple_cle_acceptee === true && sante?.achat_apple_production === false,
    '/api/sante le dit : clé acceptée, mais pas encore par la production')
  const T = await nouvelleListe('Pomme T')
  const pT = await preparer(T.id)
  const tT = acheter({ jeton: pT.j?.jeton, env: 'bac' })
  avant = appels.length
  const v = await valider(tT)
  const eT = await etat(T.id)
  dit(pT.status === 200 && v.status === 200 && v.j?.etat === 'applique' && eT?.paye === true && eT?.offert === true,
    `… et un achat du bac à sable y débloque : c’est ainsi qu’Apple valide l’app (${v.j?.etat ?? `HTTP ${v.status}`})`)
  dit(appels.length === avant + 2 && appels.at(-2)?.env === 'prod' && appels.at(-1)?.env === 'bac',
    'refusé par la production, le serveur a demandé au bac à sable')
  // Absente du bac à sable, et la production n'a pas pu être interrogée : on
  // ne sait pas. Dire « inconnue », ce serait laisser racheter par-dessus un
  // achat de production que l'on n'a simplement pas pu lire.
  const absente = await valider('2000000999999998')
  dit(absente.status === 502 && absente.j?.statusMessage === 'achat_indisponible',
    `une transaction absente du bac à sable, quand la production refuse de répondre : « on ne sait pas », pas « inconnue » (HTTP ${absente.status})`)
  // Une clé vraiment fausse est refusée des DEUX côtés.
  seul.bac = 401
  const fausse = (await api(paul, '/api/achats-apple/etat')).j
  dit(fausse?.ouvert === false, 'refusée par la production ET par le bac à sable, la clé est fausse : vente fermée')
  // L'inverse : la production accepte, le bac à sable refuse. La vente est
  // ouverte ; un achat du bac à sable ne peut pas être lu, et n'est pas dit
  // inconnu pour autant.
  seul.prod = 0
  const U = await nouvelleListe('Pomme U')
  const pU = await preparer(U.id)
  const tU = acheter({ jeton: pU.j?.jeton, env: 'bac' })
  const pasLue = await valider(tU)
  dit(pU.status === 200 && pasLue.status === 502 && pasLue.j?.statusMessage === 'achat_indisponible' && (await etat(U.id))?.paye === false,
    `le bac à sable seul refuse : la vente reste ouverte, et son achat attend au lieu d’être dit inconnu (HTTP ${pasLue.status})`)
  seul.bac = 0
  // Un numéro que la production tient pour mal formé (400) : on demande quand
  // même au bac à sable.
  seul.prod = 400
  const lue = await valider(tU)
  seul.prod = 0
  dit(lue.j?.etat === 'applique' && (await etat(U.id))?.paye === true,
    'un numéro que la production dit mal formé (400) : le bac à sable est interrogé quand même')
}

// ============ 7. Deux parents, deux caisses ===============================
{
  // Alice a ouvert la page de paiement du site : Paul, dans l'app, attend.
  const F = await nouvelleListe('Pomme F')
  await rejoindre(F, alice)
  const page = await poster(alice, `/api/groupes/${F.id}/paiement`, { consentement: true })
  let p = await preparer(F.id)
  dit(page.status === 200 && p.status === 409 && p.j?.statusMessage === 'paiement_en_cours' && p.j?.data?.par === 'Alice',
    `Alice paie sur le site : l’app de Paul attend au lieu de payer aussi (${p.j?.data?.par})`)
  // Et l'inverse : Paul achète dans l'app, le site fait attendre Alice.
  const G = await nouvelleListe('Pomme G')
  await rejoindre(G, alice)
  const pG = await preparer(G.id)
  const surLeSite = await poster(alice, `/api/groupes/${G.id}/paiement`, { consentement: true })
  dit(surLeSite.status === 409 && surLeSite.j?.data?.par === 'Paul', 'Paul achète dans l’app : le site fait attendre Alice')
  // Paul referme la feuille d'Apple : la place est rendue.
  await poster(paul, `/api/groupes/${G.id}/annuler-paiement`)
  dit(!(await statut(G.id, alice))?.en_cours, 'la feuille d’Apple refermée, la place est rendue')
  // Paul avait laissé SA page de paiement ouverte sur le site (un autre
  // appareil), puis achète dans l'app : cette page ne doit plus pouvoir encaisser.
  const paulSurLeSite = (await onglet(nav)).page
  await entrer(paulSurLeSite, 'Paul')
  const laMienne = await poster(paulSurLeSite, `/api/groupes/${G.id}/paiement`, { consentement: true })
  const pageDePaul = `cs_test_apple${nStripe}`
  const dansLApp = await preparer(G.id)
  dit(laMienne.status === 200 && !!laMienne.j?.url && dansLApp.status === 200 && !!dansLApp.j?.jeton
      && sessions.get(pageDePaul)?.status === 'expired',
    `ma propre page de paiement, restée ouverte sur le site, est fermée quand j’achète dans l’app (${sessions.get(pageDePaul)?.status})`)
  await poster(paul, `/api/groupes/${G.id}/annuler-paiement`)
  await paulSurLeSite.context().close()

  // L'achat arrivé trop tard. Paul a payé chez Apple, mais la liste vient
  // d'être débloquée par Stripe (une page ouverte avant la sienne).
  const pG2 = await preparer(G.id)
  const tG = acheter({ jeton: pG2.j.jeton })
  await webhookStripe({ id: 'evt_g', type: 'checkout.session.completed', data: { object: {
    object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: 600, payment_intent: 'pi_essai_G',
    client_reference_id: String(G.id), metadata: { groupe_id: String(G.id), user_id: null } } } })
  const v = await valider(tG)
  dit(v.status === 200 && v.j?.etat === 'avance' && (await etat(G.id))?.paye === true,
    `l’achat arrivé après celui de l’autre parent n’est pas perdu : il reste d’avance (${v.j?.etat})`)
  const H = await nouvelleListe('Pomme H'), I = await nouvelleListe('Pomme I')
  await rejoindre(H, alice)
  const avant = transactions.size
  let nAvant = notifications.length
  p = await preparer(H.id)
  dit(p.status === 200 && p.j?.deja === true && p.j?.avance === true && !p.j?.jeton && (await etat(H.id))?.paye === true,
    'il sert à la liste suivante, sans nouvel achat')
  dit((await recu(JETON_ALICE, nAvant))[0]?.body === DEBLOQUEE('Paul'), 'et l’autre parent de cette liste-là l’apprend')
  p = await preparer(I.id)
  dit(p.j?.jeton && !p.j?.deja && (await etat(I.id))?.paye === false && transactions.size === avant,
    'et à elle seule : la suivante se paie normalement')
  await poster(paul, `/api/groupes/${I.id}/annuler-paiement`)

  // Un achat sans jeton connu (lancé hors de notre parcours) : à qui le présente.
  const tSans = acheter({})
  const v2 = await valider(tSans, alice)
  const J = await nouvelleListe('Pomme J', alice)
  dit(v2.j?.etat === 'avance', 'un achat sans jeton connu revient, d’avance, à qui le présente')
  const pasPourPaul = await preparer(I.id)
  dit(!!pasPourPaul.j?.jeton && !pasPourPaul.j?.deja && (await etat(I.id))?.paye === false,
    'et à lui seul : Paul, lui, passe toujours par la feuille d’achat')
  await poster(paul, `/api/groupes/${I.id}/annuler-paiement`)
  // Qui a une avance le lit dans l'état du paiement de ses listes — et lui seul.
  dit((await statut(J.id, alice))?.avance === true && (await statut(I.id))?.avance === false,
    'l’état du paiement dit à qui a un achat d’avance qu’il servira, et ne le dit à personne d’autre')
  // Alice est dans un navigateur. On lui a promis que son achat « débloquera
  // une autre de ses listes » : le site s'en sert donc AVANT sa caisse — ni
  // page de paiement, ni case d'accord — au lieu de la faire payer deux fois.
  const pagesAvant = nStripe
  await rejoindre(J, paul)
  nAvant = notifications.length
  const parLeSite = await poster(alice, `/api/groupes/${J.id}/paiement`, {})
  dit((await recu(JETON_PAUL, nAvant))[0]?.body === DEBLOQUEE('Alice'),
    'débloquée par un achat d’avance, sur le site : l’autre parent l’apprend aussi')
  dit(parLeSite.status === 200 && parLeSite.j?.avance === true && !parLeSite.j?.url && nStripe === pagesAvant
      && (await etat(J.id, alice))?.paye === true,
    'sur le site, l’achat d’avance débloque la liste sans ouvrir de page de paiement')
  const J2 = await nouvelleListe('Pomme J2', alice)
  const ensuite = await poster(alice, `/api/groupes/${J2.id}/paiement`, {})
  dit((await statut(J2.id, alice))?.avance === false && ensuite.status === 400 && ensuite.j?.statusMessage === 'consentement_requis'
      && (await etat(J2.id, alice))?.paye === false,
    'une seule fois : la liste d’après repasse par la caisse du site, case d’accord comprise')
  // Une avance qu'Apple a remboursée entre-temps ne débloque plus rien.
  const tRendu = acheter({})
  await valider(tRendu, alice)
  rembourser(tRendu)
  const rendu = await poster(alice, `/api/groupes/${J2.id}/paiement`, {})
  dit(rendu.status === 400 && (await etat(J2.id, alice))?.paye === false && (await statut(J2.id, alice))?.avance === false,
    'un achat d’avance remboursé par Apple entre-temps ne débloque rien, et n’est plus annoncé')
}

// ============ 8. Remboursements ===========================================
{
  // Un faux courrier, pour une transaction qu'on ne connaît pas : rien, et Apple n'est pas dérangé.
  let avant = appels.length
  let c = await courrier('REFUND', '2000000888888888', { connu: false })
  dit(c.status === 200 && c.j?.ignore === 'transaction_inconnue' && appels.length === avant,
    'un courrier sur une transaction inconnue : ignoré, sans appel à Apple')
  c = await fetch(`${BASE}/api/apple/notifications`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"signedPayload":"n.importe.quoi"}' })
  dit(c.status === 200, 'un courrier illisible : 200, ignoré')
  // Un courrier qui AFFIRME un remboursement total, pour une transaction qui ne
  // l'est pas chez Apple : on ne le croit pas, on relit, rien ne bouge.
  c = await courrier('REFUND', tA, { pretend: { revocationDate: Date.now(), revocationType: 'REFUND_FULL',
    revocationPercentage: 100000, revocationReason: 0 } })
  dit(c.j?.etat === 'applique' && (await etat(A.id))?.paye === true,
    'un courrier qui annonce un remboursement qu’Apple ne confirme pas : la liste reste débloquée')
  // Un remboursement partiel : la liste reste.
  rembourser(tA, { revocationDate: Date.now(), revocationType: 'REFUND_PRORATED', revocationPercentage: 40000 })
  c = await courrier('REFUND', tA)
  dit((await etat(A.id))?.paye === true, 'un remboursement partiel laisse la liste débloquée')
  // Le vrai : Apple a tout rendu.
  rembourser(tA)
  c = await courrier('REFUND', tA)
  const eA = await etat(A.id)
  dit(c.status === 200 && c.j?.etat === 'rembourse' && eA?.paye === false, 'un remboursement total, confirmé par Apple, re-verrouille la liste')
  // L'app qui représente la transaction remboursée ne la redébloque pas.
  const v = await valider(tA)
  dit(v.j?.etat === 'rembourse' && (await etat(A.id))?.paye === false, 'la transaction remboursée, représentée par l’app, ne redébloque rien')
  // Apple annule le remboursement (litige) : la liste revient.
  annulerRemboursement(tA)
  c = await courrier('REFUND_REVERSED', tA)
  dit(c.j?.etat === 'applique' && (await etat(A.id))?.paye === true, 'un remboursement annulé par Apple rend la liste')
}

// ============ 8 bis. L'achat annoncé par Apple ============================
// Apple écrit aussi au moment où il encaisse (ONE_TIME_CHARGE). L'app fermée
// entre le paiement et le déblocage, ou l'accord d'un tiers donné des heures
// plus tard : ce courrier débloque sans attendre que l'app soit rouverte.
{
  const V = await nouvelleListe('Pomme V')
  await rejoindre(V, alice)
  const pV = await preparer(V.id)
  const tV = acheter({ jeton: pV.j.jeton })
  // (L'app ne présente rien : elle a été fermée.)
  let avant = appels.length
  const nAvant = notifications.length
  let c = await courrier('ONE_TIME_CHARGE', tV)
  const s = await statut(V.id, alice)
  const n = await recu(JETON_ALICE, nAvant)
  dit(n.length === 1 && n[0].title === 'Pomme V' && n[0].body === DEBLOQUEE('Paul')
      && (await recu(JETON_PAUL, nAvant, 0)).length === 0,
    'débloquée par le courrier d’Apple : l’autre parent l’apprend, au nom de celui qui a payé')
  dit(c.status === 200 && c.j?.etat === 'applique' && s?.paye === true && s?.par === 'Paul' && !s?.en_cours,
    `l’app fermée entre le paiement et le déblocage : l’achat annoncé par Apple débloque la liste sans elle (${c.j?.etat ?? c.j?.ignore})`)
  dit(appels.length === avant + 1 && appels.at(-1)?.id === tV, 'après l’avoir relu chez Apple, lui aussi')
  const v = await valider(tV)
  dit(v.j?.etat === 'applique' && v.j?.groupe === V.id, 'l’app rouverte présente la transaction : même réponse, elle peut la clore')
  dit((await recu(JETON_ALICE, nAvant, 0)).length === 1, 'sans que le déblocage soit annoncé une seconde fois')

  // Un faux courrier. Il affiche le jeton d'une feuille d'achat ouverte, pour
  // une transaction qui existe bien chez Apple — mais qui, chez Apple, ne
  // porte pas ce jeton. Seul le jeton rendu par Apple désigne une liste.
  const W = await nouvelleListe('Pomme W')
  const pW = await preparer(W.id)
  const tSansJeton = acheter({})
  c = await courrier('ONE_TIME_CHARGE', tSansJeton, { pretend: { appAccountToken: pW.j.jeton } })
  dit(c.status === 200 && c.j?.ignore === 'transaction_inconnue' && (await etat(W.id))?.paye === false,
    `un faux courrier qui affiche le jeton d’une feuille ouverte, pour une transaction qui ne le porte pas : rien (${c.j?.ignore ?? c.j?.etat})`)
  // … et rien n'a été enregistré au nom de personne : la transaction revient
  // toujours à qui la présente (ici Alice, qui s'en sert aussitôt).
  const X = await nouvelleListe('Pomme X', alice)
  await valider(tSansJeton, alice)
  const pourAlice = (await statut(X.id, alice))?.avance
  const servie = await poster(alice, `/api/groupes/${X.id}/paiement`, {})
  dit(pourAlice === true && servie.j?.avance === true, 'et la transaction n’a été prise au nom de personne : elle revient toujours à qui la présente')
  // Le bon jeton, mais l'achat d'autre chose.
  c = await courrier('ONE_TIME_CHARGE', acheter({ jeton: pW.j.jeton, produit: 'fr.babynamed.app.autre' }))
  dit(c.j?.ignore === 'transaction_inconnue' && (await etat(W.id))?.paye === false, 'annoncé avec le bon jeton, mais pour un autre produit : rien')
  // Un achat qui ne porte aucun jeton que nous attendions : Apple n'est même pas dérangé.
  avant = appels.length
  c = await courrier('ONE_TIME_CHARGE', acheter({ jeton: '11111111-2222-4333-8444-555555555555' }))
  const dejaServi = await courrier('ONE_TIME_CHARGE', acheter({ jeton: pV.j.jeton }))
  dit(c.j?.ignore === 'transaction_inconnue' && dejaServi.j?.ignore === 'transaction_inconnue' && appels.length === avant,
    'un achat annoncé sans jeton attendu (inconnu, ou déjà servi) : ignoré, sans appel à Apple')
  await poster(paul, `/api/groupes/${W.id}/annuler-paiement`)
}

// ============ 9. Ce que la personne retrouve dans ses données =============
{
  const d = (await api(paul, '/api/moi/donnees')).j
  const achats = d?.achats_app_store ?? []
  dit(achats.some(a => a.transaction_apple === tA && a.liste === String(A.id)) && achats.every(a => a.transaction_apple),
    `l’export de ses données liste ses achats de l’app (${achats.length}), sans les feuilles d’achat refermées`)
  dit(!JSON.stringify(d).includes(pA.j.jeton), 'et pas les jetons, qui ne disent rien d’elle')
}

}

// ===========================================================================
//  L'ÉCRAN, dans l'app iOS. Jusqu'ici le téléphone ne savait rien vendre (une
//  app d'avant l'achat intégré) ; il connaît maintenant le produit, à 7,99 €.
// ===========================================================================
async function partieEcran() {
const PRIX = '7,99 €'
const plat = async (page, sel) => (await page.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
const achat = iphone.natif.achat
achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit })
const ouvrirReglages = async (liste, page = paul) => {
  await aller(page, `${BASE}/g/${liste.id}/reglages`)
  await page.waitForSelector('section.carte', { timeout: 20000 })
  await page.waitForTimeout(600)
}
const ouvrirOffre = async (page = paul) => {
  await page.getByRole('button', { name: /Voir le détail/ }).click()
  await page.getByRole('heading', { name: 'Débloquer cette liste' }).first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
}
const FEUILLE = '.feuille-corps'

// ============ 10. Tant que le téléphone ne sait rien vendre : pas d'offre ==
const K = await nouvelleListe('Pomme K')
{
  await ouvrirReglages(K)
  dit(await paul.locator('section.achat').count() === 0 && !iphone.natif.recus.some(m => m.type === 'achat.acheter'),
    'une app d’avant l’achat intégré (elle ne répond pas) : aucune offre, comme avant')
  achat.produits = { 'un.autre.produit': '1,99 €' }
  await ouvrirReglages(K)
  dit(iphone.natif.recus.some(m => m.type === 'achat.produit' && m.produit === PRODUIT)
      && await paul.locator('section.achat').count() === 0,
    'un produit que l’App Store ne connaît pas : aucune offre non plus')
}

// Le téléphone sait vendre, le produit existe — mais Apple refuse la clé du
// serveur (mal collée, révoquée) : toujours rien.
achat.produits = { [PRODUIT]: PRIX }
{
  panne = 401
  await ouvrirReglages(K)
  await paul.waitForTimeout(800)
  dit(await paul.locator('section.achat').count() === 0, 'une clé qu’Apple refuse : aucune offre, même sur un téléphone prêt à vendre')
  panne = 0
}

// ============ 11. L'offre, au prix d'Apple ================================
{
  await ouvrirReglages(K)
  await paul.waitForSelector('section.achat', { timeout: 15000 }).catch(() => null)
  const carte = await plat(paul, 'section.achat')
  dit(carte.includes(PRIX) && !/6 €/.test(carte), `les réglages proposent le déblocage au prix de l’App Store (« ${carte.slice(0, 60)}… »)`)
  await ouvrirOffre()
  const feuille = await plat(paul, FEUILLE)
  const pied = await plat(paul, '.feuille-pied, .feuille footer, [class*=pied]')
  const tout = `${feuille} ${pied} ${await plat(paul, '[role=dialog]')}`
  dit(tout.includes(`${PRIX} : débloque cette liste pour la vie`) && !tout.includes(`${PRIX} TTC`)
      && tout.includes(`Débloquer cette liste (${PRIX})`), 'la feuille dit le prix tel qu’Apple le formule, jusque sur le bouton')
  dit(/App Store/.test(tout) && !/Stripe/.test(tout) && !/293 B/.test(tout),
    'elle dit qu’Apple encaisse — ni Stripe, ni la mention de TVA du vendeur')
  dit(!/6 €/.test(tout) && !/babynamed\.fr/i.test(tout) && !/sur le site/i.test(tout),
    'ni le prix du site, ni le site : rien ne mène ailleurs qu’à l’achat intégré')
  dit(await paul.locator('[role=dialog] input[type=checkbox]').count() === 0 && !/code cadeau/i.test(tout),
    'pas de case d’accord (la feuille d’Apple en tient lieu), pas de code cadeau')
  await auditer(paul, '[role=dialog]', 'la feuille « Débloquer » de l’app iOS')

  // ============ 12. Acheter =================================================
  // La feuille d'Apple, en se refermant, ramène l'app au premier plan : le
  // téléphone le dit à la page (« actif ») à l'instant même où il lui rend l'achat.
  achat.auRetour = () => iphone.natif.dire({ type: 'actif' })
  const avant = achat.demandes.length
  const dits = iphone.natif.recus.length
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.waitForSelector('.paiement', { timeout: 20000 }).catch(() => null)
  const bandeau = await plat(paul, '.paiement')
  const d = achat.demandes.at(-1)
  dit(achat.demandes.length === avant + 1 && d?.produit === PRODUIT && /^[0-9a-f-]{36}$/.test(d?.jeton ?? ''),
    'le bouton ouvre la feuille d’Apple avec le produit et le jeton tiré par le serveur')
  dit(/débloqué/i.test(bandeau) && (await etat(K.id))?.paye === true, `l’achat débloque la liste, et l’écran le dit : « ${bandeau} »`)
  dit(achat.finies.length === 1 && achat.enSuspens.length === 0,
    'la transaction n’est dite « traitée » au téléphone qu’après la réponse du serveur')
  await paul.waitForTimeout(800)
  const depuis = iphone.natif.recus.slice(dits).map(m => m.type)
  const apresAchat = depuis.slice(depuis.indexOf('achat.acheter') + 1)
  dit(depuis.includes('achat.acheter') && !apresAchat.includes('achat.attente')
      && appels.filter(a => a.id === achat.finies[0]).length === 1,
    'le retour au premier plan, pendant l’achat, ne le porte pas une seconde fois au serveur')
  achat.auRetour = null
  await paul.waitForTimeout(600)
  const apres = await plat(paul, 'section.achat')
  dit(/Liste débloquée/.test(apres) && !/Offrir/.test(apres), `les réglages la montrent débloquée, sans « Offrir » (« ${apres.slice(0, 50)} »)`)
}

// ============ 13. La feuille d'Apple refermée =============================
const L = await nouvelleListe('Pomme L')
{
  await rejoindre(L, alice)
  await ouvrirReglages(L)
  await ouvrirOffre()
  achat.issue = 'annule'
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.waitForTimeout(1500)
  const tout = await plat(paul, '[role=dialog]')
  dit(await paul.locator('[role=dialog] [role=alert]').count() === 0 && tout.includes(`Débloquer cette liste (${PRIX})`)
      && (await etat(L.id))?.paye === false, 'refermée : rien ne se passe, pas de message d’erreur, le bouton est de nouveau là')
  dit(!(await statut(L.id, alice))?.en_cours, 'et la place est rendue à l’autre parent')

  // ============ 14. Un accord à donner (« Demander à acheter ») ============
  achat.issue = 'attente'
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/en attente d’un accord/).waitFor({ timeout: 10000 }).catch(() => null)
  dit(/en attente d’un accord/.test(await plat(paul, '[role=dialog]')) && (await etat(L.id))?.paye === false,
    'un achat à faire valider par un tiers : l’écran le dit, rien n’est débloqué')
  // L'accord arrive pendant que l'app est ouverte, la feuille encore là : la
  // transaction apparaît sur le téléphone, qui l'annonce à la page.
  const tx = acheter({ jeton: achat.demandes.at(-1).jeton })
  achat.enSuspens.push({ id: tx, produit: PRODUIT })
  await iphone.natif.dire({ type: 'achat.arrivee' })
  await paul.waitForSelector('.paiement', { timeout: 20000 }).catch(() => null)
  const bandeau = await plat(paul, '.paiement')
  dit((await etat(L.id))?.paye === true && /C’est débloqué/.test(bandeau) && achat.finies.includes(tx),
    `l’accord donné, le téléphone l’annonce et la liste se débloque d’elle-même : « ${bandeau} »`)
  await paul.waitForTimeout(600)
  dit(await paul.locator('[role=dialog]').count() === 0 && !/vient de débloquer/.test(await plat(paul, '.paiement')),
    'la feuille se referme, et personne ne m’annonce mon propre achat comme celui d’un autre')

  // Le même accord, donné pendant que l'app était derrière : au retour au
  // premier plan, sans rien toucher.
  const L2 = await nouvelleListe('Pomme L2')
  await ouvrirReglages(L2)
  await ouvrirOffre()
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/en attente d’un accord/).waitFor({ timeout: 10000 }).catch(() => null)
  await paul.getByRole('button', { name: 'Plus tard' }).click()
  await paul.waitForTimeout(500)
  const tx2 = acheter({ jeton: achat.demandes.at(-1).jeton })
  achat.enSuspens.push({ id: tx2, produit: PRODUIT })
  await iphone.natif.dire({ type: 'actif' })
  await paul.waitForSelector('.paiement', { timeout: 20000 }).catch(() => null)
  dit((await etat(L2.id))?.paye === true && /C’est débloqué/.test(await plat(paul, '.paiement')) && achat.finies.includes(tx2),
    'donné pendant que l’app était derrière : la liste se débloque au retour au premier plan')
  achat.issue = 'achete'

  // Payée par moi ailleurs (le site, sur un autre appareil) pendant que la
  // feuille est ouverte ici : elle se referme, sans « quelqu'un vient de… ».
  const L3 = await nouvelleListe('Pomme L3')
  const idPaul = (await api(paul, '/api/auth/moi')).j?.utilisateur?.id
  await ouvrirReglages(L3)
  await ouvrirOffre()
  await webhookStripe({ id: 'evt_l3', type: 'checkout.session.completed', data: { object: {
    object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: 600, payment_intent: 'pi_essai_L3',
    client_reference_id: String(L3.id), metadata: { groupe_id: String(L3.id), user_id: idPaul } } } })
  await paul.waitForSelector('.paiement', { timeout: 20000 }).catch(() => null)
  await paul.waitForTimeout(600)
  const bandeau3 = await plat(paul, '.paiement')
  dit(!!idPaul && /C’est débloqué/.test(bandeau3) && !/vient de débloquer/.test(bandeau3)
      && await paul.locator('[role=dialog]').count() === 0,
    `ma propre liste payée ailleurs pendant que la feuille est ouverte : « ${bandeau3.slice(0, 40)}… », pas « quelqu’un vient de… »`)
}

// ============ 15. L'app fermée en plein achat =============================
const M = await nouvelleListe('Pomme M')
{
  achat.issue = 'ferme'
  await ouvrirReglages(M)
  await ouvrirOffre()
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  for (let i = 0; i < 40 && !achat.enSuspens.length; i++) await paul.waitForTimeout(150)
  const paye = achat.enSuspens.at(-1)?.id
  dit(!!paye && (await etat(M.id))?.paye === false, 'payé chez Apple, l’app fermée avant d’avoir pu le dire : rien n’est encore débloqué')
  // On rouvre l'app, ailleurs que sur cette liste : personne ne touche rien.
  achat.issue = 'achete'
  await aller(paul, `${BASE}/`)
  for (let i = 0; i < 60 && !achat.finies.includes(paye); i++) await paul.waitForTimeout(250)
  dit((await etat(M.id))?.paye === true && achat.finies.includes(paye),
    'à la réouverture, la transaction en suspens est portée au serveur : la liste est débloquée, sans rien toucher')
}

// ============ 15 (suite). Une transaction que le serveur ne reconnaît pas ===
{
  // Payée, mais pour un produit que le serveur ne vend pas (son nom a changé
  // dans les réglages) : on ne débloque rien — et surtout on ne la clôt pas.
  const autre = acheter({ produit: 'fr.babynamed.app.ancien' })
  achat.enSuspens.push({ id: autre, produit: 'fr.babynamed.app.ancien' })
  const lectures = () => appels.filter(a => a.id === autre).length
  await iphone.natif.dire({ type: 'achat.arrivee' })
  for (let i = 0; i < 40 && !lectures(); i++) await paul.waitForTimeout(150)
  await paul.waitForTimeout(800)
  const premieres = lectures()
  await iphone.natif.dire({ type: 'achat.arrivee' })
  await paul.waitForTimeout(1200)
  dit(premieres >= 1 && !achat.finies.includes(autre) && achat.enSuspens.some(t => t.id === autre),
    'une transaction payée que le serveur ne reconnaît pas n’est pas dite « traitée » : le téléphone la garde')
  dit(lectures() === premieres, 'et la page ne la représente pas en boucle : une fois par ouverture de l’app')
  achat.enSuspens = achat.enSuspens.filter(t => t.id !== autre)
}

// ============ 15 bis. Le téléphone en avance sur les serveurs d'Apple ======
{
  const Q = await nouvelleListe('Pomme Q')
  await ouvrirReglages(Q)
  await ouvrirOffre()
  // Le téléphone tient sa transaction une seconde avant que l'API d'Apple la connaisse.
  achat.encaisser = ({ jeton, produit }) => {
    const id = acheter({ jeton, produit })
    const t = transactions.get(id)
    transactions.delete(id)
    setTimeout(() => transactions.set(id, t), 1000)
    return id
  }
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/C’est débloqué/).waitFor({ timeout: 20000 }).catch(() => null)
  dit((await etat(Q.id))?.paye === true && /C’est débloqué/.test(await plat(paul, '.paiement')),
    'Apple en retard d’une seconde sur le téléphone : la page insiste, et la liste se débloque')
  achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit })
}

// ============ 15 ter. Payé, et le serveur ne peut pas le vérifier ==========
{
  const R = await nouvelleListe('Pomme R')
  await ouvrirReglages(R)
  await ouvrirOffre()
  // Apple tombe en panne PENDANT la feuille d'achat : l'argent part, et le
  // serveur ne peut plus rien vérifier. (Avant, il n'aurait pas laissé l'ouvrir.)
  achat.encaisser = ({ jeton, produit }) => { const id = acheter({ jeton, produit }); panne = 500; return id }
  const finies = achat.finies.length
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/la confirmation tarde/).waitFor({ timeout: 30000 }).catch(() => null)
  const bandeau = await plat(paul, '.paiement')
  const paye = achat.enSuspens.at(-1)?.id
  dit(/la confirmation tarde/.test(bandeau) && /rien n’est perdu/.test(bandeau) && (await etat(R.id))?.paye === false,
    `payé chez Apple, serveur incapable de le vérifier : l’écran le dit (« ${bandeau.slice(0, 50)}… »), rien n’est débloqué à tort`)
  dit(!!paye && achat.finies.length === finies,
    'et la transaction n’est PAS dite « traitée » au téléphone : il la gardera')
  // Elle rouvre la feuille « Débloquer ». Le bandeau flotte au-dessus du pied
  // de la feuille : resté là, il en couvrirait le bouton.
  await ouvrirOffre()
  dit(await paul.locator('.paiement').count() === 0, 'la feuille rouverte, le bandeau s’efface : il aurait couvert son bouton')
  await paul.getByRole('button', { name: 'Plus tard' }).click()
  await paul.waitForTimeout(300)
  // Personne ne touche plus à rien, l'app reste à l'écran. La page y retourne
  // d'elle-même : une première fois, Apple toujours en panne…
  achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit })
  const lectures = () => appels.filter(a => a.id === paye).length
  const avantRappel = lectures()
  for (let i = 0; i < 120 && lectures() < avantRappel + 3; i++) await paul.waitForTimeout(250)
  const rappelee = lectures() - avantRappel
  await paul.waitForTimeout(400)
  dit(rappelee >= 3 && (await etat(R.id))?.paye === false && achat.finies.length === finies,
    `sans rien toucher, la page est retournée d’elle-même présenter la transaction (${rappelee} demandes de plus) — Apple toujours en panne, rien`)
  // … puis une seconde, Apple revenu : la liste se débloque, sans que l'app ait été rouverte.
  panne = 0
  const feuilles = achat.demandes.length
  await paul.getByText(/C’est débloqué/).waitFor({ timeout: 60000 }).catch(() => null)
  dit((await etat(R.id))?.paye === true && /C’est débloqué/.test(await plat(paul, '.paiement'))
      && achat.finies.includes(paye) && achat.demandes.length === feuilles,
    'Apple revenu, toujours sans rien toucher : elle y retourne encore, et la liste se débloque')
}

// ============ 15 ter (suite). L'app rouverte, et la personne n'attend pas ===
{
  const R2 = await nouvelleListe('Pomme R2')
  await ouvrirReglages(R2)
  await ouvrirOffre()
  // Apple accepte toujours notre clé, mais ses lectures échouent : l'offre
  // reste donc affichée, et l'achat payé ne peut pas être vérifié.
  achat.encaisser = ({ jeton, produit }) => { const id = acheter({ jeton, produit }); panneLecture = 500; return id }
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/la confirmation tarde/).waitFor({ timeout: 30000 }).catch(() => null)
  const paye = achat.enSuspens.at(-1)?.id
  achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit })
  // Elle ferme l'app, la rouvre, et retouche « Débloquer » alors que rien
  // n'est revenu : surtout pas une seconde feuille d'achat.
  await ouvrirReglages(R2)
  await ouvrirOffre()
  const avantRetouche = achat.demandes.length
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/attend encore sa confirmation/).waitFor({ timeout: 25000 }).catch(() => null)
  dit(!!paye && /Un achat précédent attend encore sa confirmation/.test(await plat(paul, '[role=dialog]'))
      && achat.demandes.length === avantRetouche && (await etat(R2.id))?.paye === false,
    'elle retouche « Débloquer » trop tôt : l’écran dit qu’un achat attend déjà, sans rouvrir la feuille d’Apple')
  await paul.getByRole('button', { name: 'Plus tard' }).click()
  await paul.waitForTimeout(500)
  // Tout revient. Sans attendre le prochain lancement, la personne retouche
  // « Débloquer » : son achat déjà payé passe d'abord, elle ne paie pas deux fois.
  panneLecture = 0
  await ouvrirOffre()
  const demandes = achat.demandes.length
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/C’est débloqué/).waitFor({ timeout: 20000 }).catch(() => null)
  dit((await etat(R2.id))?.paye === true && achat.demandes.length === demandes && achat.finies.includes(paye),
    'elle retouche « Débloquer » : l’achat déjà payé passe d’abord, sans seconde feuille d’achat')
}

// ============ 15 quater. Une transaction qu'Apple ne connaît pas ===========
{
  const S = await nouvelleListe('Pomme S')
  await ouvrirReglages(S)
  // Le téléphone garde une VIEILLE transaction qu'Apple dit ne pas connaître
  // (un achat d'essai d'une autre installation) : elle ne sera jamais
  // confirmée, et ne doit pas interdire d'acheter pour toujours.
  achat.enSuspens.push({ id: '2000000777777771', produit: PRODUIT, le: Date.now() - 2 * 86400000 })
  await ouvrirOffre()
  let demandes = achat.demandes.length
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/C’est débloqué/).waitFor({ timeout: 25000 }).catch(() => null)
  dit((await etat(S.id))?.paye === true && achat.demandes.length === demandes + 1 && !achat.finies.includes('2000000777777771'),
    'une vieille transaction inconnue d’Apple n’empêche pas d’acheter, et n’est pas dite « traitée »')
  achat.enSuspens = achat.enSuspens.filter(t => t.id !== '2000000777777771')

  // La même, mais d'il y a un instant : Apple n'est peut-être qu'en retard.
  // Elle a peut-être été payée — on ne rouvre pas la feuille d'achat.
  const S2 = await nouvelleListe('Pomme S2')
  await ouvrirReglages(S2)
  achat.enSuspens.push({ id: '2000000777777772', produit: PRODUIT, le: Date.now() - 20000 })
  await ouvrirOffre()
  demandes = achat.demandes.length
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  await paul.getByText(/attend encore sa confirmation/).waitFor({ timeout: 25000 }).catch(() => null)
  dit(/attend encore sa confirmation/.test(await plat(paul, '[role=dialog]')) && achat.demandes.length === demandes
      && (await etat(S2.id))?.paye === false,
    'récente, elle retient l’achat suivant : Apple n’est peut-être qu’en retard')
  achat.enSuspens = achat.enSuspens.filter(t => t.id !== '2000000777777772')
}

// ============ 16. Payé juste après l'autre parent =========================
{
  const N = await nouvelleListe('Pomme N')
  await rejoindre(N, alice)
  const idAlice = (await api(alice, '/api/auth/moi')).j?.utilisateur?.id
  await ouvrirReglages(N)
  await ouvrirOffre()
  // Pendant que la feuille d'Apple est ouverte, le paiement d'Alice (une
  // page Stripe ouverte avant) aboutit.
  achat.encaisser = async ({ jeton, produit }) => {
    await webhookStripe({ id: 'evt_n', type: 'checkout.session.completed', data: { object: {
      object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: 600, payment_intent: 'pi_essai_N',
      client_reference_id: String(N.id), metadata: { groupe_id: String(N.id), user_id: idAlice } } } })
    return acheter({ jeton, produit })
  }
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click()
  // (Pendant la feuille d'Apple, l'écran a pu dire « Alice vient de débloquer » : c'est le mot de la fin qui compte.)
  await paul.getByText(/n’est pas perdu/).waitFor({ timeout: 20000 }).catch(() => null)
  const bandeau = await plat(paul, '.paiement')
  dit(/Alice avait débloqué la liste juste avant vous/.test(bandeau) && /n’est pas perdu/.test(bandeau),
    `payé juste après l’autre parent : l’écran dit que l’achat servira à une autre liste (« ${bandeau.slice(0, 70)}… »)`)
  achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit })
  // … et il sert : la liste suivante se débloque sans repasser par Apple.
  const O = await nouvelleListe('Pomme O')
  await ouvrirReglages(O)
  await ouvrirOffre()
  await paul.getByText(/n’avait servi à aucune liste/).waitFor({ timeout: 10000 }).catch(() => null)
  const feuilleO = await plat(paul, '[role=dialog]')
  dit(/Déjà payé/.test(feuilleO) && /sans rien payer/.test(feuilleO) && !feuilleO.includes(PRIX),
    'sur la liste suivante, la feuille dit que c’est déjà payé : plus de prix, ni en tête ni sur le bouton')
  await auditer(paul, '[role=dialog]', 'la feuille « déjà payé »')
  const avant = achat.demandes.length
  await paul.getByRole('button', { name: 'Débloquer cette liste', exact: true }).click()
  await paul.waitForSelector('.paiement', { timeout: 20000 }).catch(() => null)
  dit((await etat(O.id))?.paye === true && achat.demandes.length === avant && /débloqué/i.test(await plat(paul, '.paiement')),
    'elle se débloque avec lui, sans nouvelle feuille d’achat')
  // Dépensé : la suivante se vend de nouveau, au prix d'Apple.
  const O2 = await nouvelleListe('Pomme O2')
  await ouvrirReglages(O2)
  await ouvrirOffre()
  await paul.waitForTimeout(700)
  const feuilleO2 = await plat(paul, '[role=dialog]')
  dit(feuilleO2.includes(`${PRIX} : débloque`) && feuilleO2.includes(`Débloquer cette liste (${PRIX})`) && !/Déjà payé/.test(feuilleO2),
    'et une fois dépensé, la liste d’après se vend de nouveau au prix d’Apple')
}

// ============ 16 bis. Avant la sortie : TestFlight, la validation d'Apple ==
// L'état dans lequel Apple essaie l'app : sa production refuse tout, son bac
// à sable répond. De l'offre au déblocage, par l'écran.
{
  seul.prod = 401
  const Y = await nouvelleListe('Pomme Y')
  // Rien de gardé d'une ouverture précédente : l'offre doit venir du serveur.
  await paul.evaluate(() => localStorage.removeItem('bn-offre-apple'))
  await ouvrirReglages(Y)
  await paul.waitForSelector('section.achat', { timeout: 15000 }).catch(() => null)
  const carte = await plat(paul, 'section.achat')
  achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit, env: 'bac' })
  await ouvrirOffre().catch(() => null)
  await paul.getByRole('button', { name: `Débloquer cette liste (${PRIX})` }).click({ timeout: 10000 }).catch(() => null)
  await paul.waitForSelector('.paiement', { timeout: 20000 }).catch(() => null)
  const bandeau = await plat(paul, '.paiement')
  const eY = await etat(Y.id)
  dit(carte.includes(PRIX) && /débloqué/i.test(bandeau) && eY?.paye === true && eY?.offert === true,
    `app jamais sortie : l’offre est là, et un achat du bac à sable débloque par l’écran (« ${bandeau.slice(0, 30)} »)`)
  dit(achat.enSuspens.length === 0, 'et la transaction est close sur le téléphone')
  achat.encaisser = ({ jeton, produit }) => acheter({ jeton, produit })
  seul.prod = 0
}

// ============ 17. Les cadeaux restent hors de l'app, le web ne change pas ==
{
  await aller(paul, `${BASE}/`)
  await paul.waitForSelector('.bento', { timeout: 20000 })
  dit(await paul.getByRole('button', { name: /Offrir/ }).count() === 0, 'dans l’app iOS, toujours pas d’« Offrir » : les cadeaux se vendent sur le site')
  const P = await nouvelleListe('Pomme P', alice)
  await ouvrirReglages(P, alice)
  await ouvrirOffre(alice)
  const tout = await plat(alice, '[role=dialog]')
  dit(tout.includes('6 € TTC') && /Stripe/.test(tout) && !tout.includes(PRIX)
      && await alice.locator('[role=dialog] input[type=checkbox]').count() === 1 && /code cadeau/i.test(tout),
    'dans un navigateur, rien n’a changé : 6 €, Stripe, la case d’accord, le code cadeau')
  // L'app Android ne demande rien à son téléphone, et ne vend toujours rien.
  const androidRecus = (await ongletApp(nav, 'android')).natif
  dit(!androidRecus.recus.some(m => String(m.type).startsWith('achat.')), 'l’app Android ne parle pas d’achat à son téléphone')
}

// ============ 18. Les conditions de vente, selon l'endroit ================
{
  const conditions = async (page) => {
    await aller(page, `${BASE}/conditions`)
    await page.getByRole('heading', { name: /L’option payante/ }).waitFor({ timeout: 20000 })
    await page.waitForTimeout(500)
    return (await page.locator('main#contenu').innerText()).replace(/\s+/g, ' ')
  }
  const ios = await conditions(paul)
  dit(/achat intégré de l’App Store/.test(ios) && ios.includes(PRIX) && /reportaproblem\.apple\.com/.test(ios),
    'dans l’app iOS, les conditions décrivent l’achat par l’App Store : son prix, et à qui demander un remboursement')
  dit(!/6 €/.test(ios) && !/Stripe/.test(ios) && !/293 B/.test(ios) && !/babynamed\.fr/i.test(ios) && !/sur le site/i.test(ios)
      && !/code cadeau/i.test(ios),
    'et rien d’autre : ni le prix du site, ni Stripe, ni le site, ni les codes cadeaux')
  dit(/prochaine liste/.test(ios) && /version gratuite/.test(ios),
    'elles disent ce que devient un achat arrivé trop tard, et une liste remboursée')
  await auditer(paul, null, 'les conditions de vente dans l’app iOS')
  const web = await conditions(alice)
  dit(web.includes('6 € TTC') && /Stripe/.test(web) && /293 B/.test(web) && /code cadeau/i.test(web) && /case à cocher/.test(web),
    'dans un navigateur, elles décrivent la vente du site : 6 €, Stripe, la case d’accord, les codes cadeaux')
  dit(/Dans l’application iPhone, une liste se débloque par l’achat intégré de l’App Store/.test(web) && !web.includes(PRIX),
    'et disent que l’app iPhone vend par l’App Store, à son prix à elle — sans le chiffrer')
  const android = await conditions(mamie)
  dit(android.includes('6 € TTC') && /Dans l’application Android, rien ne s’achète/.test(android),
    'dans l’app Android, le texte du site : rien ne s’y achète')
}

}

// Les deux parties se tiennent seules : `ESSAI_APPLE_PARTIE=serveur` ou
// `ecran` n'en joue qu'une (c'est ce qui rend supportable de saboter une
// garde à la fois, voir essais/LISEZMOI.md). Sans rien : tout.
const PARTIE = process.env.ESSAI_APPLE_PARTIE
if (PARTIE !== 'ecran') await partieServeur()
if (PARTIE !== 'serveur') await partieEcran()

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close(); apple.close(); stripe.close(); expo.close()
process.exit(ko.length ? 1 : 0)
