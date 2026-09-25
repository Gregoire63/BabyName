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
 *     liste d'un autre ;
 *   - pas de session sans l'accord a l'execution immediate, et cet accord
 *     part chez Stripe (metadonnees, facture) ;
 *   - un remboursement TOTAL ou un litige PERDU re-verrouille la liste ; un
 *     remboursement partiel ou un litige gagne, non.
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

const ouvrir = (gid, corps = { consentement: true }) =>
  api(`/api/groupes/${gid}/paiement`, { method: 'POST', body: JSON.stringify(corps) })

// ============ 0. Pas de caisse sans accord ================================
const A = await nouvelleListe('Caisse A')
const avantRefus = recus.length
let refus = await ouvrir(A.id, {})
dit(refus.status === 400 && refus.j?.statusMessage === 'consentement_requis' && recus.length === avantRefus,
    `sans l’accord à l’exécution immédiate : refusé, et Stripe n’est même pas appelé (HTTP ${refus.status})`)
refus = await ouvrir(A.id, { consentement: 'oui' })
dit(refus.status === 400, 'un accord qui n’est pas exactement « true » ne compte pas')

// ============ 1. La session demandée à Stripe ============================
const ouv = await ouvrir(A.id)
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
// Explicite dans les deux sens : le compte live a Managed Payments « activé
// par défaut ». Une session muette partait en MP — et, avec la facture, Stripe
// la refusait (constaté contre l'API live le 25/09/2026).
dit(process.env.NUXT_STRIPE_MANAGED_PAYMENTS ? mp === 'true' : mp === 'false',
    process.env.NUXT_STRIPE_MANAGED_PAYMENTS
      ? 'Managed Payments allumé par la variable : Stripe devient vendeur officiel'
      : 'Managed Payments explicitement éteint : le réglage par défaut du compte ne décide pas à notre place')

// L'accord, grave dans la session ET dans le paiement : c'est la preuve en
// cas de litige, lisible dans le Dashboard.
dit(/^\d{4}-\d{2}-\d{2}$/.test(f?.get('metadata[conditions_version]') ?? '')
    && !isNaN(Date.parse(f?.get('metadata[consentement_le]') ?? ''))
    && f?.get('metadata[execution_immediate]') === 'demandee'
    && f?.get('payment_intent_data[metadata][consentement_le]') === f?.get('metadata[consentement_le]'),
    `l’accord part chez Stripe, daté, avec la version des conditions (${f?.get('metadata[conditions_version]')})`)
dit(f?.get('locale') === 'fr', 'la page de paiement est en français, quel que soit le navigateur')
if (process.env.NUXT_STRIPE_MANAGED_PAYMENTS) {
  dit(f?.get('invoice_creation[enabled]') === null && f?.get('custom_text[submit][message]') === null
      && f?.get('branding_settings[display_name]') === null,
      'Managed Payments : ni facture, ni texte, ni habillage — il les refuse et envoie les siens')
} else {
  const pied = f?.get('invoice_creation[invoice_data][footer]') ?? ''
  dit(f?.get('invoice_creation[enabled]') === 'true', 'une facture est émise et envoyée par Stripe')
  dit(/L221-28 13°/.test(pied) && /renoncé/.test(pied),
      'la facture confirme la renonciation au droit de rétractation (support durable, art. L221-13)')
  dit(/293 B du CGI/.test(pied), 'et porte la mention de franchise de TVA (régime par défaut)')
  dit(/\/conditions/.test(pied), 'et renvoie aux conditions acceptées')
  dit(/rétractation/.test(f?.get('custom_text[submit][message]') ?? ''),
      'la page de paiement le rappelle au-dessus du bouton')
  dit(f?.get('branding_settings[display_name]') === 'babyNames', 'la page de paiement porte le nom de l’app')
  dit(f?.get('line_items[0][tax_rates][0]') === null, 'aucun taux de TVA appliqué en franchise')
}

// ============ 2. Le webhook ne croit que ce qui est signé =================
const sessA = { object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: 600,
                payment_intent: 'pi_essai_A',
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
  payment_intent: 'pi_essai_C', metadata: { groupe_id: String(C.id) } }),
  { entete: (t, v1) => `t=${t},v1=${v1},v1=${'0'.repeat(64)}` })
dit(r.status === 200 && (await etat(C.id))?.paye === true,
    'deux signatures pendant une rotation, la bonne en premier : accepté')

// ============ 5 bis. Remboursements et litiges ===========================
const charge = (pi, champs) => ({ object: 'charge', payment_intent: pi, ...champs })
r = await webhook(evenement('charge.refunded', charge('pi_essai_A', { refunded: false, amount_refunded: 200 })))
dit(r.status === 200 && (await etat(A.id))?.paye === true,
    'un remboursement PARTIEL (geste commercial) laisse la liste débloquée')
r = await webhook(evenement('charge.refunded', charge('pi_essai_A', { refunded: true, amount_refunded: 600 })))
dit(r.status === 200 && (await etat(A.id))?.paye === false,
    'un remboursement TOTAL annule la vente : la liste re-verrouillée')
r = await webhook(evenement('checkout.session.completed', sessA))
dit((await etat(A.id))?.paye === true, 'un nouveau paiement la redébloque ensuite, normalement')

r = await webhook(evenement('charge.dispute.closed', { object: 'dispute', payment_intent: 'pi_essai_C', status: 'won' }))
dit((await etat(C.id))?.paye === true, 'un litige GAGNÉ ne reprend rien')
r = await webhook(evenement('charge.dispute.closed', { object: 'dispute', payment_intent: 'pi_essai_C', status: 'lost' }))
dit(r.status === 200 && (await etat(C.id))?.paye === false, 'un litige PERDU re-verrouille la liste')
r = await webhook(evenement('charge.refunded', charge('pi_inconnu', { refunded: true })))
dit(r.status === 200 && (await etat(B.id))?.paye === true,
    'le remboursement d’un paiement inconnu ne touche à rien (et répond 200 : Stripe ne rejoue pas)')
r = await webhook(evenement('charge.refunded', { object: 'charge', refunded: true }), { signature: false })
dit(r.status === 400, 'un remboursement non signé est refusé comme le reste')
r = await webhook(evenement('customer.created', { object: 'customer' }))
dit(r.status === 200, 'un événement sans rapport : 200, ignoré')

// ============ 6. Le retour du navigateur, sans webhook ===================
const D = await nouvelleListe('Caisse D'), E = await nouvelleListe('Caisse E')
const oD = await ouvrir(D.id)
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
