/**
 * La caisse, de bout en bout, contre un faux Stripe local.
 *
 * C'est le seul chemin de l'application ou une erreur coute de l'argent — et
 * c'etait le seul qu'aucun essai ne touchait. Ce qui se verifie ici :
 *   - la session demandee a Stripe porte la bonne liste et le bon prix ;
 *   - le webhook refuse tout ce qui n'est pas signe, ou trop vieux ;
 *   - un prelevement en attente ne debloque pas, sa confirmation si ;
 *   - un code promo a 100 % debloque (et marque la liste offerte) ;
 *   - la rotation du secret ne rejette pas les paiements ;
 *   - le retour du navigateur debloque meme SANS webhook, et jamais la
 *     liste d'un autre.
 *
 * Le serveur est lance avec essai-caisse.env (cles bidon, API sur 3199).
 */
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { lancer, onglet, BASE } from './navigateur.mjs'

const WHSEC = process.env.NUXT_STRIPE_WEBHOOK_SECRET
if (!WHSEC) { console.error('Lancer via relance.sh : essai-caisse.env n’a pas été chargé.'); process.exit(2) }

const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

// ------------------------------------------------------------ faux Stripe --
const sessions = new Map()
const recus = []
const versionsLues = []
let n = 0
const stripe = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const url = new URL(req.url, 'http://x')
  const repondre = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    const f = new URLSearchParams(corps)
    recus.push({ auth: req.headers.authorization, version: req.headers['stripe-version'], f })
    const id = `cs_test_essai${++n}`
    const s = {
      id, object: 'checkout.session', status: 'open', payment_status: 'unpaid',
      amount_total: 600, client_reference_id: f.get('client_reference_id'),
      metadata: { groupe_id: f.get('metadata[groupe_id]'), user_id: f.get('metadata[user_id]') },
      url: `http://127.0.0.1:3199/payer/${id}`
    }
    sessions.set(id, s)
    return repondre(200, s)
  }
  const m = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_[\w]+)$/)
  if (req.method === 'GET' && m) {
    if (req.headers.authorization !== 'Bearer sk_test_essai_local') return repondre(401, { error: { message: 'bad key' } })
    versionsLues.push(req.headers['stripe-version'])
    const s = sessions.get(m[1])
    return s ? repondre(200, s) : repondre(404, { error: { message: 'No such checkout.session' } })
  }
  repondre(404, { error: { message: 'inconnu' } })
})
await new Promise(r => stripe.listen(3199, '127.0.0.1', r))

// -------------------------------------------------------------- outillage --
const signer = (corps, { secret = WHSEC, age = 0, entete } = {}) => {
  const t = Math.floor(Date.now() / 1000) - age
  const v1 = createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex')
  return entete ? entete(t, v1) : `t=${t},v1=${v1}`
}
const webhook = async (ev, opts = {}) => {
  const corps = JSON.stringify(ev)
  const h = { 'content-type': 'application/json' }
  if (opts.signature !== false) h['stripe-signature'] = signer(corps, opts)
  const r = await fetch(`${BASE}/api/paiement/webhook`, { method: 'POST', headers: h, body: corps })
  return { status: r.status, j: await r.json().catch(() => null) }
}
const evenement = (type, s) => ({ id: `evt_${Math.random().toString(36).slice(2)}`, type, data: { object: s } })

const nav = await lancer()
const { page } = await onglet(nav)
const erreurs = []
page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
await page.locator('input.champ').fill('DEVG-REGX-2345')
await page.getByRole('button', { name: 'Entrer' }).click()
await page.waitForSelector('.bento', { timeout: 20000 })

const api = (chemin, init) => page.evaluate(async ([c, i]) => {
  const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
  return { status: r.status, j: await r.json().catch(() => null) }
}, [chemin, init])
const nouvelleListe = async nom => (await api('/api/groupes', { method: 'POST', body: JSON.stringify({ nom }) })).j
const etat = async gid => (await api(`/api/groupes/${gid}`)).j?.groupe

// ============ 1. La session demandée à Stripe ============================
const A = await nouvelleListe('Caisse A')
const ouv = await api(`/api/groupes/${A.id}/paiement`, { method: 'POST' })
dit(ouv.status === 200 && /\/payer\/cs_test_essai/.test(ouv.j?.url ?? ''),
    `la caisse renvoie l’URL de la page de paiement de Stripe (${ouv.j?.url})`)
const f = recus.at(-1)?.f
dit(f?.get('mode') === 'payment' && f?.get('line_items[0][price]') === 'price_essai_local'
    && f?.get('line_items[0][quantity]') === '1',
    'un seul article, au prix configuré, en paiement unique')
dit(f?.get('metadata[groupe_id]') === String(A.id) && f?.get('client_reference_id') === String(A.id),
    'la session porte la liste — c’est ce que le webhook relira')
dit((f?.get('success_url') ?? '').includes(`/g/${A.id}/`) && (f?.get('success_url') ?? '').includes('session_id={CHECKOUT_SESSION_ID}'),
    'le retour de Stripe rapporte l’identifiant de session, pour confirmer sans webhook')
dit(f?.get('allow_promotion_codes') === 'true', 'les codes promo sont acceptés (c’est ainsi qu’on offre une liste)')
dit(recus.at(-1)?.auth === 'Bearer sk_test_essai_local' && !JSON.stringify(ouv.j).includes('sk_'),
    'la clé secrète part chez Stripe depuis le serveur, jamais vers le navigateur')
dit(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/.test(recus.at(-1)?.version ?? ''),
    `la version de l’API est épinglée (${recus.at(-1)?.version}) : un clic dans le Dashboard ne change rien sous le code`)
dit(f?.get('payment_intent_data[metadata][groupe_id]') === String(A.id),
    'le paiement lui-même porte la liste — c’est ce que le Dashboard affiche au support')
const mp = f?.get('managed_payments[enabled]')
dit(process.env.NUXT_STRIPE_MANAGED_PAYMENTS ? mp === 'true' : mp === null,
    process.env.NUXT_STRIPE_MANAGED_PAYMENTS
      ? 'Managed Payments allumé par la variable : Stripe devient vendeur officiel'
      : 'Managed Payments éteint par défaut : rien n’est envoyé')

// ============ 2. Le webhook ne croit que ce qui est signé =================
const sessA = { object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: 600,
                client_reference_id: String(A.id), metadata: { groupe_id: String(A.id), user_id: null } }
let r = await webhook(evenement('checkout.session.completed', sessA), { signature: false })
dit(r.status === 400, `sans signature : refusé (HTTP ${r.status})`)
r = await webhook(evenement('checkout.session.completed', sessA), { secret: 'whsec_pas_le_bon' })
dit(r.status === 400, `signé avec un autre secret : refusé (HTTP ${r.status})`)
r = await webhook(evenement('checkout.session.completed', sessA), { age: 600 })
dit(r.status === 400, `signé il y a dix minutes (rejeu) : refusé (HTTP ${r.status})`)
dit((await etat(A.id))?.paye === false, 'et la liste est toujours bloquée')

// ============ 3. Un prélèvement : en attente, puis confirmé ===============
r = await webhook(evenement('checkout.session.completed', { ...sessA, payment_status: 'unpaid' }))
dit(r.status === 200 && (await etat(A.id))?.paye === false,
    'un prélèvement pas encore encaissé ne débloque pas')
r = await webhook(evenement('checkout.session.async_payment_succeeded', sessA))
const eA = await etat(A.id)
dit(r.status === 200 && eA?.paye === true, 'sa confirmation, arrivée plus tard, débloque')
dit(eA?.offert === false, 'et la liste est comptée comme vendue, pas offerte')
r = await webhook(evenement('checkout.session.completed', sessA))
dit(r.status === 200 && (await etat(A.id))?.paye === true, 'Stripe qui rejoue l’événement ne casse rien')

// ============ 4. Un code promo à 100 % ===================================
const B = await nouvelleListe('Caisse B')
r = await webhook(evenement('checkout.session.completed', {
  object: 'checkout.session', status: 'complete', payment_status: 'no_payment_required', amount_total: 0,
  client_reference_id: String(B.id), metadata: { groupe_id: String(B.id) } }))
const eB = await etat(B.id)
dit(eB?.paye === true, 'un code promo à 100 % débloque (avant : payé 0 €, rien reçu)')
dit(eB?.offert === true, 'et marque la liste comme offerte, pour ne pas fausser les ventes')

// ============ 5. La rotation du secret ====================================
const C = await nouvelleListe('Caisse C')
r = await webhook(evenement('checkout.session.completed', { ...sessA, client_reference_id: String(C.id),
  metadata: { groupe_id: String(C.id) } }),
  { entete: (t, v1) => `t=${t},v1=${v1},v1=${'0'.repeat(64)}` })
dit(r.status === 200 && (await etat(C.id))?.paye === true,
    'deux signatures pendant une rotation, la bonne en premier : accepté')

// ============ 6. Le retour du navigateur, sans webhook ===================
const D = await nouvelleListe('Caisse D'), E = await nouvelleListe('Caisse E')
const oD = await api(`/api/groupes/${D.id}/paiement`, { method: 'POST' })
const idD = oD.j.url.split('/').pop()
Object.assign(sessions.get(idD), { status: 'complete', payment_status: 'paid' })

r = await api(`/api/groupes/${E.id}/confirmer-paiement`, { method: 'POST', body: JSON.stringify({ session_id: idD }) })
dit(r.status === 403 && (await etat(E.id))?.paye === false,
    `une session payée pour D ne débloque pas E (HTTP ${r.status})`)
r = await api(`/api/groupes/${D.id}/confirmer-paiement`, { method: 'POST', body: JSON.stringify({ session_id: 'cs_inconnue' }) })
dit(r.status === 404, `une session inconnue de Stripe : refusée (HTTP ${r.status})`)
dit(versionsLues.length > 0 && versionsLues.every(v => v === recus.at(-1)?.version),
    'la relecture d’une session utilise la même version épinglée')

// Le vrai trajet : Stripe renvoie le navigateur sur l'app, aucun webhook.
await page.goto(`${BASE}/g/${D.id}/swipe?paye=1&session_id=${idD}`, { waitUntil: 'networkidle' })
await page.waitForSelector('.paiement', { timeout: 15000 }).catch(() => null)
await page.waitForTimeout(1500)
const bandeau = (await page.locator('.paiement').innerText().catch(() => '')).replace(/\s+/g, ' ')
dit(/débloqué/i.test(bandeau), `au retour, l’écran le dit : « ${bandeau.trim()} »`)
dit((await etat(D.id))?.paye === true, 'et la liste est débloquée — le webhook n’a jamais été appelé')
dit(!page.url().includes('session_id'), 'l’identifiant de session disparaît de la barre d’adresse')

console.log(`\n${ok.length} OK, ${ko.length} échecs`)
dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close(); stripe.close()
process.exit(ko.length ? 1 : 0)
