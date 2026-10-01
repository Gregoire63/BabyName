/**
 * Offrir babyNamed : un code cadeau, de l'achat sans compte à la liste
 * débloquée chez quelqu'un d'autre — contre un faux Stripe local.
 *
 *  1. /offrir s'ouvre sans compte ; rien ne part sans la case d'accord ;
 *     la session demandée à Stripe est un CADEAU (code dans les métadonnées
 *     et sur la facture, rétractation tant qu'il n'a pas servi, pas de code
 *     promo, aucune liste visée).
 *  2. Le retour : « en cours » tant que ce n'est pas encaissé, puis le code,
 *     son échéance, le mot de l'offrant, les boutons pour le transmettre —
 *     le même code à chaque rechargement, avec ou sans webhook. Un cadeau ne
 *     débloque jamais de liste à l'achat.
 *  3. Le destinataire sans compte : le lien traverse la connexion (« Mamie Jo
 *     vous offre babyNamed »), la feuille du cadeau propose une liste neuve,
 *     les questions habituelles, et la liste arrive débloquée ; le même code
 *     ne sert pas deux fois.
 *  4. Un code tapé dans « Débloquer » débloque la liste où l'on est, et la
 *     carte le dit ; tapé dans « Rejoindre une liste », il ouvre le cadeau.
 *  5. Remboursé : le code s'annule, et la liste qu'il avait débloquée se
 *     re-verrouille. Un remboursement partiel ne touche à rien.
 *  6. Échu : il n'ouvre plus rien.
 *
 * Le serveur est lancé avec essai-cadeau.env (clés bidon, API sur 3199).
 */
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { lancer, onglet, compteur, inscrire, BASE, entrerComme } from './navigateur.mjs'

const WHSEC = process.env.NUXT_STRIPE_WEBHOOK_SECRET
if (!WHSEC) { console.error('Lancer via relance.sh : essai-cadeau.env n’a pas été chargé.'); process.exit(2) }
const AXE = (() => {
  try { return readFileSync(process.env.ESSAI_AXE || createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8') }
  catch { return null }
})()
const { ok, ko, dit } = compteur()

// ------------------------------------------------------------ faux Stripe --
const sessions = new Map()
const recus = []
let n = 0
const stripe = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const url = new URL(req.url, 'http://x')
  const repondre = (code, j) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (req.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
    const f = new URLSearchParams(corps)
    recus.push(f)
    const id = `cs_test_cadeau${++n}`
    const metadata = {}
    for (const [k, v] of f) { const m = k.match(/^metadata\[(\w+)\]$/); if (m) metadata[m[1]] = v }
    const s = { id, object: 'checkout.session', status: 'open', payment_status: 'unpaid', amount_total: 600,
                client_reference_id: f.get('client_reference_id'), metadata,
                url: `http://127.0.0.1:3199/payer/${id}` }
    sessions.set(id, s)
    return repondre(200, s)
  }
  const m = url.pathname.match(/^\/v1\/checkout\/sessions\/(cs_[\w]+)$/)
  if (req.method === 'GET' && m) {
    const s = sessions.get(m[1])
    return s ? repondre(200, s) : repondre(404, { error: { message: 'No such checkout.session' } })
  }
  if (url.pathname.startsWith('/payer/')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<p>Stripe</p>') }
  repondre(404, { error: { message: 'inconnu' } })
})
await new Promise(r => stripe.listen(3199, '127.0.0.1', r))

const signer = corps => {
  const t = Math.floor(Date.now() / 1000)
  return `t=${t},v1=${createHmac('sha256', WHSEC).update(`${t}.${corps}`).digest('hex')}`
}
const webhook = async (type, objet) => {
  const corps = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, type, data: { object: objet } })
  const r = await fetch(`${BASE}/api/paiement/webhook`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signer(corps) }, body: corps })
  return { status: r.status, j: await r.json().catch(() => null) }
}
const payer = (id, pi) => Object.assign(sessions.get(id), { status: 'complete', payment_status: 'paid', payment_intent: pi })

const nav = await lancer()
const erreurs = []
async function contexte() {
  const o = await onglet(nav)
  o.page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  return o
}
const api = (page, chemin, methode = 'GET', corps) => page.evaluate(async ([c, m, b]) => {
  const r = await fetch(c, { method: m, headers: { 'content-type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined })
  return { status: r.status, j: await r.json().catch(() => null) }
}, [chemin, methode, corps])
async function auditer(page, racine, nom) {
  if (!AXE) return
  await page.evaluate(AXE)
  const v = await page.evaluate(async sel => (await window.axe.run(sel ? document.querySelector(sel) : document,
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(x => x.id), racine)
  dit(v.length === 0, `${nom} : aucune violation WCAG A/AA${v.length ? ` (${v.join(', ')})` : ''}`)
}
/** Un cadeau acheté par l'API (sans compte) puis payé : son code lisible. */
async function cadeauPaye(page, pi, corps = {}) {
  const r = await api(page, '/api/cadeaux/acheter', 'POST', { consentement: true, ...corps })
  const id = r.j.url.split('/').pop()
  payer(id, pi)
  const s = await api(page, `/api/cadeaux/session?session_id=${id}`)
  return { id, code: s.j.code }
}

// ============ 1. Acheter, sans compte =====================================
const acheteur = await contexte()
const p = acheteur.page
await p.goto(`${BASE}/offrir`, { waitUntil: 'networkidle' })
await p.waitForSelector('h1', { timeout: 30000 })
const feuilleOffrir = p.locator('.feuille-corps')
await feuilleOffrir.waitFor({ timeout: 10000 })
dit(p.url().endsWith('/offrir') && (await p.locator('h1').innerText()).trim() === 'Offrir babyNamed'
    && (await feuilleOffrir.locator('h2').first().innerText()).trim() === 'Offrir babyNamed',
  'la page /offrir s’ouvre sans compte, sans passer par la connexion — le formulaire dans une feuille')
const bouton = feuilleOffrir.getByRole('button', { name: /^Offrir \(6/ })
// Jamais grisé : sans la case, le bouton la signale au lieu de payer.
dit(!await bouton.isDisabled() && await p.locator('.accord input[type="checkbox"]:checked').count() === 0,
  'le bouton n’est jamais grisé, et la case d’accord n’est jamais pré-cochée')
await auditer(p, null, 'La page Offrir')
const avantClic = recus.length
await bouton.click()
await p.waitForTimeout(600)
const signal = await p.evaluate(() => {
  const c = document.querySelector('.accord input[type="checkbox"]')
  return { focus: document.activeElement === c, invalide: c?.getAttribute('aria-invalid') === 'true',
           phrase: document.querySelector('#accord-offrir-requis')?.textContent?.trim() ?? '' }
})
dit(recus.length === avantClic && signal.focus && signal.invalide && /Cochez la case/.test(signal.phrase),
  `sans la case, rien ne part vers Stripe : la case est signalée et reçoit le focus (« ${signal.phrase} »)`)
const avant = recus.length
let r = await api(p, '/api/cadeaux/acheter', 'POST', { de_la_part: 'X' })
dit(r.status === 400 && r.j?.statusMessage === 'consentement_requis' && recus.length === avant,
  'sans l’accord, le serveur refuse — et Stripe n’est même pas appelé')

await p.getByPlaceholder('Mamie, Julie et Tom…').fill('Mamie Jo')
await p.getByPlaceholder('Pour choisir ensemble, sans vous fâcher.').fill('Pour vous deux, avec tout notre amour')
await p.locator('.accord input[type="checkbox"]').check()
await Promise.all([p.waitForURL(/127\.0\.0\.1:3199\/payer\/cs_test_cadeau/, { timeout: 15000 }), bouton.click()])
dit(true, 'la case cochée, « Offrir » mène à la page de paiement de Stripe')
const f = recus.at(-1)
const code1 = f.get('metadata[code]') ?? ''
dit(f.get('metadata[type]') === 'cadeau' && /^[A-HJKMNP-TV-Z2-9]{12}$/.test(code1),
  `la session est un cadeau, avec un code de 12 caractères (${code1})`)
dit(f.get('metadata[de_la_part]') === 'Mamie Jo' && /tout notre amour/.test(f.get('metadata[message]') ?? ''),
  'le nom et le mot de l’offrant partent avec')
dit(!f.get('client_reference_id') && !f.get('metadata[groupe_id]'), 'aucune liste n’est visée à l’achat')
dit(f.get('allow_promotion_codes') === 'false', 'pas de code promo : un cadeau gratuit serait un code à revendre')
dit((f.get('success_url') ?? '').includes('/offrir/merci?session_id={CHECKOUT_SESSION_ID}'),
  'le retour de Stripe rapporte la session, vers la page du code')
dit(f.get('line_items[0][price]') === 'price_essai_cadeau',
  'au prix du produit cadeau, pas de la liste : les cadeaux se lisent à part dans les ventes')
const pied = f.get('invoice_creation[invoice_data][footer]') ?? ''
dit(f.get('invoice_creation[invoice_data][custom_fields][0][value]') === `${code1.slice(0, 4)}-${code1.slice(4, 8)}-${code1.slice(8)}`,
  'le code est écrit sur la facture : l’acheteur qui ferme l’onglet ne le perd pas')
dit(/L221-18/.test(pied) && /L221-28 13°/.test(pied) && /tant qu’il n’a pas servi/i.test(pied),
  'la facture dit la rétractation tant qu’il n’a pas servi, et la renonciation à l’utilisation')
dit(/rétracter/.test(f.get('custom_text[submit][message]') ?? ''), 'la page de paiement le rappelle')
dit((f.get('payment_intent_data[description]') ?? '').includes('code cadeau'), 'le paiement se lit « code cadeau » au Dashboard')

// ============ 2. Le retour ================================================
const id1 = [...sessions.keys()].at(-1)
Object.assign(sessions.get(id1), { status: 'complete', payment_status: 'unpaid' })
await p.goto(`${BASE}/offrir/merci?session_id=${id1}`, { waitUntil: 'networkidle' })
await p.waitForSelector('.code', { timeout: 20000 })
dit(/encaissement/.test(await p.locator('#titre-code').innerText()),
  'un prélèvement pas encore encaissé : « paiement en cours d’encaissement »')
dit((await api(p, `/api/cadeaux/verifier?code=${code1}`)).j?.raison === 'cadeau_inconnu',
  'et le code ne vaut rien tant que l’argent n’est pas là')
payer(id1, 'pi_cadeau_1')
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.code', { timeout: 20000 })
const lu = (await p.locator('.code').innerText()).trim()
dit(lu === `${code1.slice(0, 4)}-${code1.slice(4, 8)}-${code1.slice(8)}`, `payé : le code s’affiche (${lu})`)
const carte = (await p.locator('.code-carte').innerText()).replace(/\s+/g, ' ')
const dans2ans = new Date(Date.now() + 730 * 86400e3).getFullYear()
dit(new RegExp(`Valable jusqu’au .*${dans2ans}`).test(carte), `avec son échéance, dans deux ans (${carte.match(/jusqu’au [^,]+/)?.[0]})`)
dit(/Mamie Jo vous offre babyNamed : « Pour vous deux/.test(carte), 'et ce que le destinataire lira')
for (const nom of ['Envoyer le lien', 'Copier le message et le lien', 'Copier le code seul']) {
  dit(await p.getByRole('button', { name: nom }).count() === 1, `bouton « ${nom} »`)
}
await auditer(p, null, 'La page du code')
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.code', { timeout: 20000 })
dit((await p.locator('.code').innerText()).trim() === lu, 'recharger redonne le même code')
r = await webhook('checkout.session.completed', sessions.get(id1))
dit(r.status === 200 && r.j?.cadeau === true, 'le webhook, arrivé après, ne casse rien')
const v1 = (await api(p, `/api/cadeaux/verifier?code=${code1}`)).j
dit(v1?.valide === true && v1.de_la_part === 'Mamie Jo', 'le code vaut, au nom de Mamie Jo')

// Un cadeau ne débloque jamais de liste à l'achat, même si la session en
// désignait une (défense : c'est le déblocage d'une liste qu'on vendrait).
const paul = await contexte()
await paul.page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
await entrerComme(paul.page, 'Paul')
await paul.page.waitForSelector('.bento', { timeout: 30000 })
r = await webhook('checkout.session.completed', { object: 'checkout.session', id: 'cs_test_faux', status: 'complete',
  payment_status: 'paid', client_reference_id: '3', metadata: { type: 'cadeau', groupe_id: '3' } })
dit(r.status === 200 && (await api(paul.page, '/api/groupes/3')).j?.groupe?.paye === false,
  'une session de cadeau qui désignerait une liste ne la débloque pas')

// ============ 3. Le destinataire, sans compte =============================
const lea = await contexte()
const q = lea.page
await q.goto(`${BASE}/?cadeau=${code1}`, { waitUntil: 'networkidle' })
await q.waitForURL(/\/connexion/, { timeout: 20000 })
dit(new URL(q.url()).searchParams.get('cadeau') === code1, 'le lien du cadeau traverse la connexion')
await q.waitForFunction(() => /Mamie Jo vous offre babyNamed/.test(document.body.innerText), null, { timeout: 10000 })
dit(true, 'la connexion dit qui l’attend : « Mamie Jo vous offre babyNamed »')
await inscrire(q, 'Léa', 'lea.cadeau@exemple.test')
const feuille = q.locator('.feuille-corps')
await q.waitForSelector('.feuille-corps .carte-cadeau', { timeout: 30000 })
const txtF = (await feuille.innerText()).replace(/\s+/g, ' ')
dit(/Mamie Jo vous offre babyNamed/.test(txtF) && /tout notre amour/.test(txtF),
  'sur l’accueil, la feuille du cadeau : de qui, et son mot')
const choix = feuille.locator('.choix')
dit(await choix.count() === 1 && /nouvelle liste/.test(await choix.innerText()),
  'pas encore de liste : le cadeau en propose une neuve')
await auditer(q, '.feuille-corps', 'La feuille du cadeau')
await choix.click()
await q.getByRole('button', { name: 'Passer, je filtrerai après' }).click()
await q.waitForURL(/\/g\/\d+\/swipe/, { timeout: 20000 })
const gidLea = q.url().match(/\/g\/(\d+)\//)[1]
await q.waitForSelector('.paiement', { timeout: 15000 })
dit(/débloqué, un cadeau de Mamie Jo/.test(await q.locator('.paiement').innerText()),
  'la liste s’ouvre, et le dit : « C’est débloqué, un cadeau de Mamie Jo »')
const gl = (await api(q, `/api/groupes/${gidLea}`)).j.groupe
dit(gl.paye === true && gl.offert === false && gl.cadeau === true && gl.cadeau_de === 'Mamie Jo',
  'en base : payée (par un cadeau, pas « offerte » par un code promo), au nom de Mamie Jo')
dit(await q.evaluate(() => localStorage.getItem('cadeau-en-attente')) === null,
  'le code gardé sur l’appareil le temps de la connexion est oublié')
await q.goto(`${BASE}/?cadeau=${code1}`, { waitUntil: 'networkidle' })
await q.waitForSelector('.feuille-corps', { timeout: 20000 })
dit(/déjà servi/.test(await q.locator('.feuille-corps').innerText()), 'le même lien, rouvert : « déjà servi »')
r = await api(q, '/api/cadeaux/utiliser', 'POST', { code: code1, nouvelle: true })
dit(r.status === 409 && r.j?.statusMessage === 'cadeau_utilise', 'et le serveur refuse une seconde liste')

// ============ 4. Un code tapé : « Débloquer », « Rejoindre » ================
const c2 = await cadeauPaye(paul.page, 'pi_cadeau_2', { de_la_part: 'Tata Rose' })
await paul.page.goto(`${BASE}/g/2/reglages`, { waitUntil: 'networkidle' })
await paul.page.getByRole('button', { name: /Voir le détail/ }).click()
const fd = paul.page.locator('.feuille-corps')
await fd.getByRole('button', { name: 'Vous avez un code cadeau ?' }).click()
await fd.getByRole('textbox', { name: 'Code cadeau' }).fill(c2.code.toLowerCase())
await fd.getByRole('button', { name: 'Utiliser' }).click()
await paul.page.waitForFunction(() => /un cadeau de Tata Rose/.test(document.querySelector('.feuille-corps')?.innerText ?? ''),
  null, { timeout: 10000 })
dit(true, 'dans « Débloquer », le code (même en minuscules) débloque la liste : « un cadeau de Tata Rose »')
await paul.page.waitForSelector('.feuille-corps', { state: 'detached', timeout: 8000 })
const achat = paul.page.locator('section[aria-labelledby="titre-achat"]')
await paul.page.waitForFunction(() => /Liste débloquée/.test(
  document.querySelector('section[aria-labelledby="titre-achat"]')?.textContent ?? ''), null, { timeout: 8000 })
const txtA = (await achat.innerText()).replace(/\s+/g, ' ')
dit(/Un cadeau de Tata Rose/.test(txtA) && /Offerte/.test(txtA), 'la carte de la liste le dit')
dit(await achat.getByRole('button', { name: /Offrir babyNamed/ }).count() === 1,
  'et propose d’offrir babyNamed à d’autres')

const c3 = await cadeauPaye(paul.page, 'pi_cadeau_3')
await paul.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await paul.page.waitForSelector('.bento', { timeout: 20000 })
const tuileOffrir = paul.page.getByRole('button', { name: /Offrir babyNamed/ })
dit(await tuileOffrir.count() === 1, 'l’accueil propose d’offrir')
await tuileOffrir.click()
await paul.page.locator('.feuille-corps h2', { hasText: 'Offrir babyNamed' }).waitFor({ timeout: 8000 })
dit(new URL(paul.page.url()).pathname === '/' && await paul.page.locator('.feuille-corps .accord').count() === 1,
  'la tuile ouvre la feuille « Offrir » sur place, sans quitter l’accueil')
await paul.page.keyboard.press('Escape')
await paul.page.waitForSelector('.feuille-corps', { state: 'detached', timeout: 8000 })
await paul.page.getByRole('button', { name: /Rejoindre une liste/ }).click()
const fr = paul.page.locator('.feuille-corps')
await fr.getByRole('textbox', { name: /code cadeau/ }).fill(c3.code)
await fr.getByRole('button', { name: 'Voir le cadeau' }).click()
await paul.page.waitForSelector('.feuille-corps .carte-cadeau', { timeout: 10000 })
const listesG = (await paul.page.locator('.feuille-corps .choix').allInnerTexts()).map(t => t.replace(/\s+/g, ' '))
dit(listesG.some(t => /Débloquer « Autre essai »/.test(t)) && !listesG.some(t => /Notre liste|Essai gratuit/.test(t)),
  `tapé dans « Rejoindre », le code ouvre le cadeau — seules les listes pas encore débloquées sont proposées`)
await paul.page.keyboard.press('Escape'); await paul.page.waitForTimeout(500)

// ============ 5. Remboursements ==========================================
const charge = (pi, champs) => ({ object: 'charge', payment_intent: pi, ...champs })
r = await webhook('charge.refunded', charge('pi_cadeau_2', { refunded: false, amount_refunded: 100 }))
dit((await api(paul.page, '/api/groupes/2')).j.groupe.paye === true, 'un remboursement partiel ne touche à rien')
r = await webhook('charge.refunded', charge('pi_cadeau_3', { refunded: true }))
dit(r.status === 200 && r.j?.cadeau_annule === true, 'un cadeau pas encore utilisé, remboursé : annulé')
dit((await api(paul.page, `/api/cadeaux/verifier?code=${c3.code}`)).j?.raison === 'cadeau_annule',
  'il n’ouvre plus rien')
r = await webhook('charge.refunded', charge('pi_cadeau_2', { refunded: true }))
dit(r.status === 200 && (await api(paul.page, '/api/groupes/2')).j.groupe.paye === false,
  'un cadeau utilisé, remboursé : la liste qu’il avait débloquée revient au gratuit')
r = await webhook('charge.dispute.closed', { object: 'dispute', payment_intent: 'pi_cadeau_1', status: 'lost' })
dit((await api(q, `/api/groupes/${gidLea}`)).j.groupe.paye === false, 'un litige perdu aussi')

// ============ 6. Échu =====================================================
const c4 = await cadeauPaye(paul.page, 'pi_cadeau_4')
await api(paul.page, '/api/dev/base', 'POST', { action: 'vieillir-cadeaux' })
r = await api(paul.page, '/api/cadeaux/utiliser', 'POST', { code: c4.code, groupe: 3 })
dit(r.status === 409 && r.j?.statusMessage === 'cadeau_expire', 'un code échu n’ouvre plus rien')

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close(); stripe.close()
console.log(`\n${ko.length ? 'ECHEC' : 'TOUT PASSE'} — ${ok.length} ok, ${ko.length} echecs`)
process.exit(ko.length ? 1 : 0)
