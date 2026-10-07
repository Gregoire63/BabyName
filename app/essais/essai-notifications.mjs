/**
 * Les notifications, au-delà de l'accord et de l'arrivée (essai-coquille) :
 * ce qui se passe dans une liste quand on n'y est pas — et rien de plus.
 *
 *  1. Un commentaire : les AUTRES membres l'apprennent (qui, dans quelle
 *     liste — ni le prénom, ni le texte) ; d'affilée, un seul message par
 *     demi-heure et par personne.
 *  2. La liste débloquée par quelqu'un d'autre : par un cadeau, par Stripe au
 *     retour du navigateur, par Stripe via son webhook. Une fois : un rejeu
 *     ne redit rien. Celui qui a payé n'est pas prévenu.
 *  3. L'avance : l'un franchit un palier (25 prénoms d'écart, puis 50…),
 *     l'autre l'apprend, avec l'écart. Pas à chaque vote ; une fois par jour
 *     au plus ; pas à qui a déjà trié aujourd'hui ; jamais à qui ne décide
 *     pas (un invité en lecture seule).
 *  4. Ces messages ne sonnent pas et vont dans le canal « activite » ; un
 *     accord sonne toujours, dans « accords ».
 *  5. Aucun message ne porte un prénom jugé ou commenté.
 *
 * Le serveur est lancé avec essai-notifications.env (faux Expo sur 3198,
 * faux Stripe sur 3199).
 */
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { lancer, onglet, compteur, BASE, entrerComme } from './navigateur.mjs'

const WHSEC = process.env.NUXT_STRIPE_WEBHOOK_SECRET
if (!process.env.NUXT_PUSH_URL || !WHSEC) {
  console.error('Lancer via relance.sh : essai-notifications.env n’a pas été chargé.'); process.exit(2)
}

const { ok, ko, dit } = compteur()
const pause = ms => new Promise(r => setTimeout(r, ms))
/** Attendre qu'une condition devienne vraie (les envois partent APRÈS la réponse). */
async function jusqua(f, delai = 6000) {
  const fin = Date.now() + delai
  for (;;) {
    const v = await f()
    if (v || Date.now() > fin) return v
    await pause(100)
  }
}

// ------------------------------------------------------- faux Expo (3198) --
const messages = []               // tout ce que le service a reçu, dans l'ordre
const expo = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const lot = JSON.parse(corps || '[]')
  messages.push(...lot)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ data: lot.map((_, i) => ({ status: 'ok', id: `essai-${messages.length}-${i}` })) }))
})
await new Promise(r => expo.listen(3198, '127.0.0.1', r))

// ----------------------------------------------------- faux Stripe (3199) --
const sessions = new Map()
let n = 0
const stripe = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const url = new URL(req.url, 'http://x')
  const repondre = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    const f = new URLSearchParams(corps)
    const id = `cs_test_essai${++n}`
    const s = { id, object: 'checkout.session', status: 'open', payment_status: 'unpaid', amount_total: 600,
      client_reference_id: f.get('client_reference_id'),
      metadata: { groupe_id: f.get('metadata[groupe_id]'), user_id: f.get('metadata[user_id]') },
      url: `http://127.0.0.1:3199/payer/${id}` }
    sessions.set(id, s)
    return repondre(200, s)
  }
  const m = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_[\w]+)$/)
  if (req.method === 'GET' && m) return sessions.has(m[1]) ? repondre(200, sessions.get(m[1])) : repondre(404, { error: { message: 'inconnue' } })
  repondre(200, {})
})
await new Promise(r => stripe.listen(3199, '127.0.0.1', r))
const webhook = async (type, s) => {
  const corps = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, type, data: { object: s } })
  const t = Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', WHSEC).update(`${t}.${corps}`).digest('hex')
  const r = await fetch(`${BASE}/api/paiement/webhook`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` }, body: corps })
  return { status: r.status, j: await r.json().catch(() => null) }
}

// -------------------------------------------------------------- outillage --
const nav = await lancer()
const erreurs = []
const api = (page, chemin, init) => page.evaluate(async ([c, i]) => {
  const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
  return { status: r.status, j: await r.json().catch(() => null) }
}, [chemin, init])
const poster = (page, chemin, corps = {}) => api(page, chemin, { method: 'POST', body: JSON.stringify(corps) })
const voter = (page, gid, prenom, valeur = 0, plus = {}) => poster(page, `/api/groupes/${gid}/vote`, { prenom, valeur, ...plus })

/** Une personne, son navigateur, et son téléphone (un jeton donné au serveur). */
async function personne(qui) {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(`${qui} : ${e.message}`); console.log('   [err]', qui, e.message) })
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
  const jeton = `ExponentPushToken[essai-${qui.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}]`
  const r = await poster(page, '/api/appareils', { jeton, plateforme: qui === 'Paul' ? 'android' : 'ios' })
  if (r.status !== 200) throw new Error(`téléphone de ${qui} refusé (${r.status})`)
  return { qui, ctx, page, jeton }
}
const paul = await personne('Paul')
const alice = await personne('Alice')
const mamie = await personne('Mamie')

/** Les messages reçus par le téléphone de `p` depuis `depuis` (un indice dans `messages`). */
const pour = (p, depuis = 0) => messages.slice(depuis).filter(m => m.to === p.jeton)
/** Laisser aux envois le temps de partir — pour affirmer qu'il n'y en a PAS eu. */
const silence = () => pause(1200)

/** Une liste neuve de Paul, débloquée ou non, où Alice entre par le lien. */
async function listeADeux(nom, { debloquee = true } = {}) {
  const l = (await poster(paul.page, '/api/groupes', { nom })).j
  const code = (await api(paul.page, `/api/groupes/${l.id}`)).j?.groupe?.code_invitation
  const avant = messages.length
  await poster(alice.page, '/api/groupes/rejoindre', { code })
  // L'arrivée d'Alice prévient Paul (essai-coquille) : on l'attend, pour ne pas la confondre avec la suite.
  await jusqua(() => pour(paul, avant).length)
  if (debloquee) await poster(paul.page, '/api/dev/base', { action: 'debloquer', groupe: Number(l.id) })
  return Number(l.id)
}

// De quoi voter longtemps, sans qu'aucun de ces prénoms soit celui d'un membre.
const PRENOMS = ['Adèle', 'Agathe', 'Alba', 'Alma', 'Ambre', 'Anna', 'Apolline', 'Camille', 'Capucine', 'Charlie',
  'Charlotte', 'Chloé', 'Clémence', 'Emma', 'Eva', 'Garance', 'Gabrielle', 'Giulia', 'Inès', 'Iris', 'Jade', 'Jeanne',
  'Joséphine', 'Julia', 'Juliette', 'Léa', 'Léna', 'Léonie', 'Lina', 'Lison', 'Lou', 'Louise', 'Lucie', 'Luna', 'Manon',
  'Margaux', 'Margot', 'Mia', 'Mila', 'Nina', 'Olivia', 'Romane', 'Romy', 'Rose', 'Sarah', 'Sofia', 'Victoire',
  'Victoria', 'Zoé', 'Arthur', 'Gabriel', 'Léo', 'Louis', 'Raphaël', 'Jules', 'Adam', 'Maël', 'Lucas', 'Hugo', 'Noah',
  'Liam', 'Ethan', 'Sacha', 'Gabin', 'Nathan', 'Aaron', 'Léon', 'Marius', 'Victor', 'Martin', 'Timéo', 'Eden', 'Tom',
  'Théo', 'Nino', 'Malo', 'Robin', 'Augustin', 'Côme', 'Gaspard']
const NOTRE = 1           // « Notre liste » : Paul et Alice décident, Mamie observe (semence)
const SANS_BRUIT = m => m.channelId === 'activite' && !('sound' in m) && m.priority === 'default'

// =================== 1. UN COMMENTAIRE ======================================
{
  let avant = messages.length
  const texte = 'Comme mon arrière-grand-mère, tiens.'
  const r = await poster(mamie.page, `/api/groupes/${NOTRE}/commentaires`, { prenom: 'Louise', texte })
  const aPaul = await jusqua(() => pour(paul, avant)[0])
  const aAlice = await jusqua(() => pour(alice, avant)[0])
  dit(r.status === 200 && aPaul?.title === 'Notre liste' && aPaul.body === 'Mamie a laissé un commentaire.'
      && aPaul.data?.chemin === `/g/${NOTRE}/communs` && aAlice?.body === aPaul.body,
    `un commentaire prévient les autres membres : « ${aPaul?.title} — ${aPaul?.body} » → ${aPaul?.data?.chemin}`)
  dit(SANS_BRUIT(aPaul), `sans bruit, dans le canal « ${aPaul?.channelId} » : il se coupe sans couper les accords`)
  await silence()
  dit(pour(mamie, avant).length === 0 && pour(paul, avant).length === 1,
    'celle qui l’a écrit n’est pas prévenue, et chacun ne l’est qu’une fois')
  dit(!JSON.stringify(messages.slice(avant)).includes('Louise') && !JSON.stringify(messages.slice(avant)).includes('grand-mère'),
    'le message ne porte ni le prénom commenté, ni le texte')

  // D'affilée : un seul message par demi-heure et par personne.
  avant = messages.length
  await poster(mamie.page, `/api/groupes/${NOTRE}/commentaires`, { prenom: 'Jeanne', texte: 'Et celui-ci aussi.' })
  await poster(mamie.page, `/api/groupes/${NOTRE}/commentaires`, { prenom: 'Rose', texte: 'Très joli.' })
  await silence()
  dit(messages.length === avant, 'elle en écrit deux autres dans la foulée : rien de plus ne part')
  // … mais ce rythme est celui de CHACUN : Alice commente, on l'apprend.
  await poster(alice.page, `/api/groupes/${NOTRE}/commentaires`, { prenom: 'Rose', texte: 'Oui !' })
  const dAlice = await jusqua(() => pour(paul, avant)[0])
  dit(dAlice?.body === 'Alice a laissé un commentaire.' && (await jusqua(() => pour(mamie, avant)[0]))?.body === dAlice.body
      && pour(alice, avant).length === 0,
    'ce rythme est celui de chacun : le commentaire d’Alice, lui, prévient Paul et Mamie')
}

// =================== 2. LA LISTE DÉBLOQUÉE PAR QUELQU'UN D'AUTRE ============
{
  // --- par un cadeau (le code de la semence)
  const cadeau = await listeADeux('Offerte', { debloquee: false })
  let avant = messages.length
  const r = await poster(paul.page, '/api/cadeaux/utiliser', { code: 'BEBE2345CADE', groupe: cadeau })
  const m = await jusqua(() => pour(alice, avant)[0])
  dit(r.status === 200 && m?.title === 'Offerte'
      && m.body === 'Paul a débloqué la liste : swipes illimités, pour vous aussi.'
      && m.data?.chemin === `/g/${cadeau}/swipe` && SANS_BRUIT(m),
    `Paul débloque la liste par un cadeau : Alice l’apprend (« ${m?.title} — ${m?.body} »)`)
  await silence()
  dit(pour(paul, avant).length === 0 && pour(alice, avant).length === 1, 'pas lui : il le sait')

  // --- par Stripe, au retour du navigateur
  const caisse = await listeADeux('Caisse', { debloquee: false })
  const ouv = await poster(alice.page, `/api/groupes/${caisse}/paiement`, { consentement: true })
  const s = sessions.get([...sessions.keys()].at(-1))
  Object.assign(s, { status: 'complete', payment_status: 'paid', payment_intent: 'pi_essai_retour' })
  avant = messages.length
  const conf = await poster(alice.page, `/api/groupes/${caisse}/confirmer-paiement`, { session_id: s.id })
  const mp = await jusqua(() => pour(paul, avant)[0])
  dit(ouv.status === 200 && conf.j?.paye === true && mp?.title === 'Caisse'
      && mp.body === 'Alice a débloqué la liste : swipes illimités, pour vous aussi.',
    `Alice paie sur le site : au retour de la caisse, Paul l’apprend (« ${mp?.body} »)`)
  // Le webhook de la même session arrive ensuite, puis le retour est rejoué : rien de plus.
  await webhook('checkout.session.completed', s)
  await poster(alice.page, `/api/groupes/${caisse}/confirmer-paiement`, { session_id: s.id })
  await silence()
  dit(pour(paul, avant).length === 1 && pour(alice, avant).length === 0,
    'le webhook de la même session, puis le retour rejoué : la liste n’est annoncée débloquée qu’une fois')

  // --- par Stripe, via son webhook (l'onglet fermé avant le retour)
  const fermee = await listeADeux('Onglet fermé', { debloquee: false })
  await poster(paul.page, `/api/groupes/${fermee}/paiement`, { consentement: true })
  const s2 = sessions.get([...sessions.keys()].at(-1))
  Object.assign(s2, { status: 'complete', payment_status: 'paid', payment_intent: 'pi_essai_webhook' })
  avant = messages.length
  const w = await webhook('checkout.session.completed', s2)
  const mw = await jusqua(() => pour(alice, avant)[0])
  dit(w.status === 200 && w.j?.groupe === fermee && mw?.body === 'Paul a débloqué la liste : swipes illimités, pour vous aussi.',
    `Paul paie et ferme l’onglet : par le webhook de Stripe, Alice l’apprend quand même (« ${mw?.body} »)`)
  await webhook('checkout.session.completed', s2)
  await silence()
  dit(pour(alice, avant).length === 1 && pour(paul, avant).length === 0, 'Stripe rejoue son webhook : rien de plus')
}

// =================== 3. L'AVANCE ============================================
{
  const gid = await listeADeux('Avance')
  let avant = messages.length
  // Vingt-quatre prénoms d'avance : pas encore un palier.
  for (const p of PRENOMS.slice(0, 24)) await voter(paul.page, gid, p)
  await silence()
  dit(messages.length === avant, 'Paul juge 24 prénoms de plus qu’Alice : rien ne part (pas un message par vote)')
  // Le vingt-cinquième.
  await voter(paul.page, gid, PRENOMS[24])
  const m = await jusqua(() => pour(alice, avant)[0])
  dit(m?.title === 'Avance' && m.body === 'Paul a jugé 25 prénoms de plus que vous. Les accords vous attendent.'
      && m.data?.chemin === `/g/${gid}/swipe` && SANS_BRUIT(m),
    `au 25e, Alice l’apprend, avec l’écart : « ${m?.title} — ${m?.body} » → ${m?.data?.chemin}`)
  // Il continue jusqu'au palier suivant, le même jour.
  for (const p of PRENOMS.slice(25, 52)) await voter(paul.page, gid, p)
  await silence()
  dit(pour(alice, avant).length === 1 && pour(paul, avant).length === 0,
    'il continue jusqu’à 52 (le palier de 50, le même jour) : une fois par jour au plus, et jamais à lui-même')

  // Un accord, lui, sonne toujours : Alice dit oui à un prénom que Paul a aimé.
  await voter(paul.page, gid, 'Gaspard', 2)
  avant = messages.length
  await voter(alice.page, gid, 'Gaspard', 2)
  const accord = await jusqua(() => pour(paul, avant)[0])
  dit(accord?.title === 'Nouvel accord' && accord.channelId === 'accords' && accord.sound === 'default' && accord.priority === 'high',
    `un accord, lui, sonne toujours, dans son canal (« ${accord?.title} », ${accord?.channelId})`)
}
{
  // Celle qui a déjà trié aujourd'hui sait où en est la liste — et, sur une
  // liste gratuite, ne pourrait rien rattraper de plus.
  const gid = await listeADeux('Avance du jour')
  await voter(alice.page, gid, PRENOMS[0], 2)
  const avant = messages.length
  for (const p of PRENOMS.slice(1, 30)) await voter(paul.page, gid, p)
  await silence()
  dit(pour(alice, avant).length === 0, 'Alice a déjà trié aujourd’hui : l’avance de Paul (28 de plus) ne lui est pas dite')
}
{
  // L'écart se franchit aussi d'un seul geste (une famille écartée d'un coup).
  const gid = await listeADeux('Avance d’un geste')
  for (const p of PRENOMS.slice(0, 23)) await voter(paul.page, gid, p)
  const avant = messages.length
  await voter(paul.page, gid, 'Louna', 0, { balayage: 'loun', variantes: ['Lounah', 'Lounna', 'Lounia'] })
  const m = await jusqua(() => pour(alice, avant)[0])
  dit(m?.body === 'Paul a jugé 27 prénoms de plus que vous. Les accords vous attendent.',
    `de 23 à 27 d’un seul geste : le palier de 25 est franchi, et l’écart dit est le vrai (« ${m?.body} »)`)
}
{
  // À trois : l'avance se dit à celui qu'elle concerne, pas aux autres. Mamie
  // entre ici par le lien de ceux qui décident ; Alice a trié aujourd'hui.
  const gid = await listeADeux('Avance à trois')
  const code = (await api(paul.page, `/api/groupes/${gid}`)).j?.groupe?.code_invitation
  await poster(mamie.page, '/api/groupes/rejoindre', { code })
  await voter(alice.page, gid, PRENOMS[0], 2)
  await pause(800)
  const avant = messages.length
  for (const p of PRENOMS.slice(1, 27)) await voter(paul.page, gid, p)
  const m = await jusqua(() => pour(mamie, avant)[0])
  await silence()
  dit(m?.body === 'Paul a jugé 25 prénoms de plus que vous. Les accords vous attendent.'
      && pour(alice, avant).length === 0 && pour(paul, avant).length === 0,
    `à trois : Mamie, qui n’a pas trié, l’apprend (« ${m?.body} ») ; Alice, qui a trié aujourd’hui, ne reçoit pas le message de Mamie`)
}
{
  // Qui ne décide pas n'a rien à rattraper. Mamie entre ici en lecture seule
  // (le code des observateurs) : elle n'a jamais trié, et Paul prend 26
  // prénoms d'avance sur elle comme sur Alice. Alice l'apprend ; pas Mamie.
  const gid = await listeADeux('Avance observée')
  const code = (await poster(paul.page, `/api/groupes/${gid}/observateurs`)).j?.code
  const entree = await poster(mamie.page, '/api/groupes/rejoindre', { code })
  await pause(800)
  const avant = messages.length
  for (const p of PRENOMS.slice(0, 26)) await voter(paul.page, gid, p)
  const m = await jusqua(() => pour(alice, avant)[0])
  await silence()
  dit(entree.j?.role === 'observateur' && /a jugé 25 prénoms de plus que vous/.test(m?.body ?? '') && pour(mamie, avant).length === 0,
    `Mamie observe (${entree.j?.role}) : l’avance de Paul est dite à Alice, qui décide — pas à elle`)
}

// =================== 5. JAMAIS UN PRÉNOM ====================================
{
  const tout = JSON.stringify(messages)
  const fuites = PRENOMS.concat(['Louna', 'Lounah']).filter(p => new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`, 'u').test(tout))
  dit(messages.length >= 9 && fuites.length === 0,
    `aucun des ${messages.length} messages ne porte un prénom jugé ou commenté${fuites.length ? ` — ${fuites.join(', ')}` : ''}`)
  const canaux = [...new Set(messages.map(m => m.channelId))].sort()
  dit(canaux.join(',') === 'accords,activite', `deux canaux, pas un de plus : ${canaux.join(', ')}`)
}

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
expo.close(); stripe.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
