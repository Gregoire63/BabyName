/**
 * Les apps des stores (iOS, Android) : le site, dans une coquille.
 *
 * L'app affiche ce site dans une vue web (dossier mobile/ du dépôt). On la
 * simule comme elle se présente — son agent utilisateur, et le pont natif
 * tenu par l'essai à la place du téléphone (ongletApp, navigateur.mjs).
 *
 *  0. Témoin : dans un navigateur, l'offre est là et la caisse répond — ce
 *     que la suite ne trouve pas dans l'app, elle saurait le trouver.
 *  1. Dans l'app, rien ne se vend et rien n'y mène : accueil, tri, fiche,
 *     fête d'un accord, mur du quota, classement, réglages, « Rejoindre »,
 *     /offrir. Android dit OÙ cela se débloque, d'une phrase sans lien ; iOS
 *     ne dit rien. (L'app iOS sait vendre par l'App Store — essai-apple —
 *     mais seulement si le serveur sait vérifier l'achat chez Apple. Celui de
 *     cet essai ne le sait pas : même avec un téléphone prêt à vendre, elle
 *     ne propose rien, ni ne mène ailleurs.)
 *  2. Le serveur le tient aussi : achat, cadeau, code cadeau — refusés depuis
 *     une app avant même de parler à Stripe.
 *  3. Une liste débloquée sur le site l'est dans l'app, au retour sur elle.
 *  4. Le pont : « prête » et ses couleurs, le thème qui change, le partage
 *     par la feuille du téléphone, « Télécharger mes données », le bouton
 *     « Retour » d'Android, la vibration d'un accord, un lien reçu pendant
 *     que l'app tourne.
 *  5. Les notifications : jamais demandées à l'ouverture ; un accord prévient
 *     l'AUTRE, sans le prénom ; une arrivée aussi ; refusées, coupées,
 *     déconnecté, jeton périmé : plus rien ne part.
 *  6. Les liens : l'invitation (/rejoindre/…) et le lien de connexion demandé
 *     DEPUIS l'app sont les deux seuls que l'app ouvre ; demandé depuis un
 *     navigateur, il reste au navigateur. Les deux fichiers .well-known.
 *  7. Le compte de démonstration des stores : un code fixe, pour lui seul.
 *
 * Le serveur est lancé avec essai-coquille.env (faux Expo sur 3198, faux
 * Stripe sur 3199).
 */
import { createServer } from 'node:http'
import { lancer, onglet, ongletApp, compteur, courrielPour, inscrire, BASE, entrerComme } from './navigateur.mjs'

if (!process.env.NUXT_PUSH_URL) { console.error('Lancer via relance.sh : essai-coquille.env n’a pas été chargé.'); process.exit(2) }

const { ok, ko, dit } = compteur()
const erreurs = []
const suivre = (page, qui) => page.on('pageerror', e => { erreurs.push(`${qui} : ${e.message}`); console.log('   [err]', qui, e.message) })
const pause = ms => new Promise(r => setTimeout(r, ms))
/** Attendre qu'une condition devienne vraie (les envois partent APRÈS la réponse). */
async function jusqua(f, delai = 6000) {
  const fin = Date.now() + delai
  for (;;) {
    const v = await f()
    if (v || Date.now() > fin) return v
    await pause(120)
  }
}

// ------------------------------------------------------- faux Expo (3198) --
// Le service d'acheminement des notifications : il note ce qu'on lui confie,
// et dit « périmé » des jetons qu'on lui désigne (app désinstallée).
const envois = []                 // chaque appel : { auth, messages }
const perimes = new Set()
const expo = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  const messages = JSON.parse(corps || '[]')
  envois.push({ auth: req.headers.authorization ?? null, messages })
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ data: messages.map(m => perimes.has(m.to)
    ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
    : { status: 'ok', id: `essai-${envois.length}` }) }))
})
await new Promise(r => expo.listen(3198, '127.0.0.1', r))
const messages = () => envois.flatMap(e => e.messages)

// ----------------------------------------------------- faux Stripe (3199) --
const caisse = []
const stripe = createServer(async (req, res) => {
  let corps = ''
  for await (const c of req) corps += c
  caisse.push({ chemin: req.url, f: new URLSearchParams(corps) })
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ id: `cs_test_essai${caisse.length}`, object: 'checkout.session', status: 'open',
    payment_status: 'unpaid', url: `http://127.0.0.1:3199/payer/cs_test_essai${caisse.length}` }))
})
await new Promise(r => stripe.listen(3199, '127.0.0.1', r))

// -------------------------------------------------------------- outillage --
const nav = await lancer()
const api = (page, chemin, init) => page.evaluate(async ([c, i]) => {
  const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json' } } : undefined)
  return { status: r.status, j: await r.json().catch(() => null), type: r.headers.get('content-type') }
}, [chemin, init])
const poster = (page, chemin, corps = {}) => api(page, chemin, { method: 'POST', body: JSON.stringify(corps) })
const dev = (page, corps) => poster(page, '/api/dev/base', corps)
const voter = (page, gid, prenom, valeur) => poster(page, `/api/groupes/${gid}/vote`, { prenom, valeur })
const appareils = async page => (await api(page, '/api/moi/donnees')).j?.appareils_prevenus ?? null
async function entrer(page, qui) {
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await entrerComme(page, qui)
  await page.waitForSelector('.bento', { timeout: 20000 })
}
const texte = async page => (await page.locator('body').innerText()).replace(/\s+/g, ' ')

/**
 * Ce qui, à l'écran, vend ou mène à une vente. « Essai gratuit » est le nom
 * de la liste d'essai : « gratuit » n'est donc pas cherché.
 */
const VENTE = /débloqu|\d\s*€|offrir|cadeau|achet|achat|payant|illimité|tarif|prix/i
const PHRASE_ANDROID = 'Swipes illimités : sur le site babynamed.fr.'
const ceQuiVend = (t, plateforme) => {
  const sans = plateforme === 'android' ? t.replace(PHRASE_ANDROID, '') : t
  return sans.match(VENTE)?.[0] ?? null
}

/** Une feuille ouverte (Feuille.vue). La fiche d'un prénom a la sienne : « .feuille ». */
const FEUILLE = '.feuille-corps'
const GRATUITE = 2      // « Essai gratuit » : 3 de départ puis 2 par jour (semence)
const PAYEE = 1         // « Notre liste » : Paul, Alice, Mamie qui observe
const CADEAU = 'BEBE2345CADE'

// =================== 0. TÉMOIN : DANS UN NAVIGATEUR, TOUT SE VEND ===========
const paulWeb = await onglet(nav)
suivre(paulWeb.page, 'Paul (navigateur)')
await entrer(paulWeb.page, 'Paul')
dit(await paulWeb.page.locator('.carte.offrir').count() === 1 && VENTE.test(await texte(paulWeb.page)),
  'témoin, navigateur : l’accueil propose « Offrir babyNamed »')
await paulWeb.page.goto(`${BASE}/g/${GRATUITE}/reglages`, { waitUntil: 'networkidle' })
await paulWeb.page.waitForSelector('.carte.achat', { timeout: 20000 })
dit(/Débloquer cette liste/.test(await paulWeb.page.locator('.carte.achat').innerText())
    && await paulWeb.page.getByRole('heading', { name: 'Avec votre nom de famille' }).count() === 1,
  'témoin, navigateur : les réglages d’une liste gratuite montrent l’offre et ce qu’elle ouvre')
const caisseWeb = await poster(paulWeb.page, `/api/groupes/${GRATUITE}/paiement`, { consentement: true })
dit(caisseWeb.status === 200 && /\/payer\/cs_test_essai/.test(caisseWeb.j?.url ?? '') && caisse.length === 1,
  `témoin, navigateur : la caisse s’ouvre (HTTP ${caisseWeb.status})`)
await poster(paulWeb.page, `/api/groupes/${GRATUITE}/annuler-paiement`)
await paulWeb.page.goto(`${BASE}/?cadeau=${CADEAU}`, { waitUntil: 'networkidle' })
await paulWeb.page.waitForSelector(FEUILLE, { timeout: 20000 })
dit(/Un cadeau pour vous/.test(await paulWeb.page.locator(FEUILLE).innerText()),
  'témoin, navigateur : un lien cadeau ouvre la feuille du cadeau')
await paulWeb.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

// =================== L'APP ANDROID, PAUL ===================================
const android = await ongletApp(nav, 'android')
suivre(android.page, 'Paul (app Android)')
await entrer(android.page, 'Paul')
await pause(1200)

// --- 4. le pont, à l'ouverture
{
  const prets = android.natif.recus.filter(m => m.type === 'pret')
  const p = prets.at(-1)
  dit(prets.length >= 1 && p?.v === 1 && p.sombre === false && /^#[0-9a-f]{6}$/i.test(p.fond ?? ''),
    `à l’ouverture, la page dit « prête » au natif, avec ses couleurs (${JSON.stringify(p)})`)
  // La connexion dans l'app Android recharge la page pour de bon : la vue web
  // n'écrit le cookie de session sur le disque qu'à la fin d'un chargement.
  dit(prets.length === 2, `Android : entrer recharge la page pour de bon (${prets.length} « prête »)`)
  dit(android.natif.recus.some(m => m.type === 'push.etat') && !android.natif.recus.some(m => m.type === 'push.demander'),
    'les notifications : l’app relit où en est le téléphone, et ne DEMANDE rien à l’ouverture')
}

// --- 1. l'accueil
{
  const t = await texte(android.page)
  dit(!ceQuiVend(t, 'android') && await android.page.locator('.carte.offrir').count() === 0,
    `app : l’accueil ne propose ni « Offrir » ni rien qui se vende (${ceQuiVend(t, 'android') ?? 'rien'})`)
  dit(await android.page.locator('a[href^="/prenoms"], a[href^="/offrir"]').count() === 0
      && !/installer/i.test(t),
    'app : ni lien vers les pages publiques (elles vendent), ni bouton « Installer »')
}

// --- 5. un téléphone qui permet les notifications d'office (Android avant 13)
// n'est pas enregistré pour autant : il faut le geste.
{
  const vieux = await ongletApp(nav, 'android')
  suivre(vieux.page, 'Paul (vieil Android)')
  vieux.natif.permission = 'accordee'
  await entrer(vieux.page, 'Paul')
  await vieux.page.goto(`${BASE}/g/${GRATUITE}/reglages`, { waitUntil: 'networkidle' })
  const bouton = vieux.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' })
  await bouton.waitFor({ timeout: 20000 })
  await pause(700)
  dit((await appareils(vieux.page))?.length === 0,
    'un téléphone qui permet les notifications d’office n’est pas enregistré sans le geste')
  await bouton.click()
  await vieux.page.getByRole('button', { name: 'Ne plus me prévenir' }).waitFor({ timeout: 8000 })
  dit((await appareils(vieux.page))?.length === 1, 'le geste l’enregistre')
  await vieux.page.getByRole('button', { name: 'Ne plus me prévenir' }).click()
  await vieux.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' }).waitFor({ timeout: 8000 })
  await vieux.ctx.close()
}

// --- 1 et 5. les réglages d'une liste gratuite ; les notifications, sur un geste
await android.page.goto(`${BASE}/g/${GRATUITE}/reglages`, { waitUntil: 'networkidle' })
await android.page.getByRole('heading', { name: 'Notifications' }).waitFor({ timeout: 20000 })
{
  const t = await texte(android.page)
  dit(!ceQuiVend(t, 'android') && await android.page.locator('.carte.achat').count() === 0
      && await android.page.getByRole('heading', { name: 'Avec votre nom de famille' }).count() === 0
      && await android.page.locator('.deux-facons').count() === 0,
    `app : les réglages d’une liste gratuite n’ont ni offre, ni fonctions à débloquer (${ceQuiVend(t, 'android') ?? 'rien'})`)
  const bouton = android.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' })
  dit(await bouton.count() === 1 && (await appareils(android.page))?.length === 0,
    'les notifications se proposent dans les réglages ; tant qu’on n’a rien demandé, le serveur ne connaît aucun téléphone')
  await bouton.click()
  await android.page.getByRole('button', { name: 'Ne plus me prévenir' }).waitFor({ timeout: 8000 })
  const a = await appareils(android.page)
  dit(android.natif.recus.some(m => m.type === 'push.demander') && a?.length === 1 && a[0].plateforme === 'android',
    `le geste pose la question du téléphone, puis l’enregistre (${JSON.stringify(a)})`)
  dit(!JSON.stringify(a).includes('ExponentPushToken'),
    'l’export de mes données dit quels téléphones sont prévenus, sans le jeton')
}

// --- 4. le partage passe par la feuille du téléphone
{
  await android.page.getByRole('button', { name: 'Partager le lien' }).click()
  const m = await jusqua(() => android.natif.recus.find(x => x.type === 'partager'))
  dit(m?.url === `${BASE}/rejoindre/dec0de01` && typeof m.texte === 'string' && !!m.id,
    `« Partager le lien » passe par le natif, avec le lien d’invitation (${m?.url})`)
  await pause(400)
  dit(await android.page.getByRole('button', { name: 'Lien copié' }).count() === 0,
    'la feuille du téléphone a répondu : rien n’est copié à la place')
}

// --- 4. « Télécharger mes données » : une page n'y télécharge rien, le natif s'en charge
{
  await android.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await android.page.waitForSelector('.bento', { timeout: 20000 })
  await android.page.getByRole('button', { name: /^Mon compte/ }).click()
  await android.page.waitForSelector(FEUILLE, { timeout: 8000 })
  await android.page.getByRole('link', { name: 'Télécharger mes données' }).click()
  const m = await jusqua(() => android.natif.recus.find(x => x.type === 'fichier'))
  let contenu = null
  try { contenu = JSON.parse(m?.texte ?? '') } catch { /* pas du JSON */ }
  dit(/^babynamed-mes-donnees-\d{4}-\d{2}-\d{2}\.json$/.test(m?.nom ?? '') && m.mime === 'application/json'
      && Array.isArray(contenu?.appareils_prevenus) && new URL(android.page.url()).pathname === '/',
    `« Télécharger mes données » confie le fichier au natif (${m?.nom}), sans quitter l’écran`)

  // --- 4. le bouton « Retour » d'Android : la feuille, puis l'écran d'avant, puis la sortie
  await android.natif.dire({ type: 'retour' })
  await android.page.waitForSelector(FEUILLE, { state: 'detached', timeout: 8000 })
  dit(!android.natif.recus.some(x => x.type === 'quitter'), '« Retour », une feuille ouverte : elle se ferme, on reste dans l’app')
  await android.page.locator('a.carte.grande').click()          // la liste en cours
  await android.page.waitForURL(/\/g\/\d+\//, { timeout: 20000 })
  await android.page.waitForTimeout(900)
  await android.natif.dire({ type: 'retour' })
  await android.page.waitForURL(u => u.pathname === '/', { timeout: 10000 })
  await android.page.waitForSelector('.bento', { timeout: 20000 })
  await android.page.waitForTimeout(600)
  dit(!android.natif.recus.some(x => x.type === 'quitter'), '« Retour », dans une liste : on revient à l’accueil')
  await android.natif.dire({ type: 'retour' })
  dit(!!await jusqua(() => android.natif.recus.find(x => x.type === 'quitter')),
    '« Retour », à l’accueil : la page dit au natif de sortir de l’app')
}

// --- 5 et 6. Alice suit le lien d'invitation (navigateur) : Paul l'apprend
const aliceWeb = await onglet(nav)
suivre(aliceWeb.page, 'Alice (navigateur)')
await entrer(aliceWeb.page, 'Alice')
{
  const avant = messages().length
  await aliceWeb.page.goto(`${BASE}/rejoindre/dec0de01`, { waitUntil: 'networkidle' })
  await aliceWeb.page.waitForURL(new RegExp(`/g/${GRATUITE}/swipe`), { timeout: 20000 })
  dit(true, 'le lien d’invitation /rejoindre/<code> fait entrer dans la liste (navigateur)')
  const m = await jusqua(() => messages().slice(avant).find(x => x.to === android.natif.jeton))
  dit(m?.title === 'Essai gratuit' && m.body === 'Alice a rejoint votre liste.'
      && m.data?.chemin === `/g/${GRATUITE}/reglages` && m.channelId === 'accords',
    `une arrivée prévient ceux qui y étaient : « ${m?.title} — ${m?.body} » → ${m?.data?.chemin}`)
  const n = messages().length
  await aliceWeb.page.goto(`${BASE}/rejoindre/dec0de01`, { waitUntil: 'networkidle' })
  await aliceWeb.page.waitForURL(new RegExp(`/g/${GRATUITE}/swipe`), { timeout: 20000 })
  await pause(1200)
  dit(messages().length === n, 'repasser par le même lien n’est pas une arrivée : rien ne part')
  // Deux oui d'Alice, que Paul rejoindra depuis ses deux téléphones.
  const v1 = await voter(aliceWeb.page, GRATUITE, 'Louise', 2), v2 = await voter(aliceWeb.page, GRATUITE, 'Jeanne', 2)
  await pause(800)
  dit(v1.status === 200 && v2.status === 200 && messages().length === n,
    'un oui que personne n’a encore rejoint n’est pas un accord : rien ne part')
}

/** Jusqu'au mur : des « Oui », tant qu'il reste une carte. */
async function jusquAuMur(page) {
  let n = 0
  for (; n < 9; n++) {
    if (await page.locator('.vide h2').count()) break
    const oui = page.locator('button.rond.oui')
    if (!await oui.count()) break
    await oui.first().click()
    await page.waitForTimeout(900)
    const fete = page.locator('.fete')
    if (await fete.count()) await fete.getByRole('button', { name: 'Continuer à trier' }).click()
  }
  await page.waitForSelector('.vide h2', { timeout: 8000 })
  return n
}
/** La première carte demandée, sa fiche, puis le oui qui fait un accord. */
async function ficheEtFete(app, prenom, plateforme) {
  await app.page.goto(`${BASE}/g/${GRATUITE}/swipe?prenom=${prenom}`, { waitUntil: 'networkidle' })
  await app.page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 25000 })
  await app.page.waitForTimeout(600)
  const devant = (await app.page.locator('.carte.fiche:not(.derriere) .nom').innerText()).trim()
  const tri = await texte(app.page)
  dit(devant === prenom && !ceQuiVend(tri, plateforme),
    `app ${plateforme} : l’écran de tri ne vend rien (${devant} en première carte ; ${ceQuiVend(tri, plateforme) ?? 'rien'})`)
  await app.page.getByRole('button', { name: `Infos sur ${prenom}` }).click()
  await app.page.waitForSelector('.feuille', { timeout: 8000 })
  await app.page.waitForTimeout(700)
  const fiche = await texte(app.page)
  dit(!ceQuiVend(fiche, plateforme), `app ${plateforme} : la fiche d’un prénom non plus (${ceQuiVend(fiche, plateforme) ?? 'rien'})`)
  await app.page.getByRole('button', { name: 'Fermer' }).first().click()
  await app.page.waitForSelector('.feuille', { state: 'detached', timeout: 8000 })
  await app.page.locator('button.rond.oui').first().click()
  await app.page.waitForSelector('.fete', { timeout: 8000 })
  await app.page.waitForTimeout(700)
  const fete = (await app.page.locator('.fete').innerText()).replace(/\s+/g, ' ')
  dit(/vous êtes d’accord/i.test(fete) && fete.includes(prenom) && !ceQuiVend(fete, plateforme)
      && await app.page.locator('.fete .plus').count() === 0,
    `app ${plateforme} : la fête d’un accord, sur une liste gratuite, ne propose pas ce qui se débloque (${ceQuiVend(fete, plateforme) ?? 'rien'})`)
}

// --- 1. Android : tri, fiche, fête, puis le mur
await ficheEtFete(android, 'Louise', 'android')
dit(await android.page.locator('.fete').getByRole('button', { name: 'Me prévenir du prochain accord' }).count() === 0,
  'téléphone déjà prévenu : la fête ne redemande pas les notifications')
dit(android.natif.recus.some(m => m.type === 'vibrer' && m.genre === 'succes'),
  'un accord se sent sous le doigt : la page le demande au natif (une page web n’a pas de vibreur sur iPhone)')
await android.page.locator('.fete').getByRole('button', { name: 'Continuer à trier' }).click()
await android.page.waitForSelector('.fete', { state: 'detached', timeout: 8000 })
{
  const n = await jusquAuMur(android.page)
  const mur = (await android.page.locator('.vide').innerText()).replace(/\s+/g, ' ')
  dit(/C’est tout pour aujourd’hui/.test(mur) && /demain matin/.test(mur),
    `le mur du quota tombe aussi dans l’app, après ${n} swipes, et dit que demain ça repart`)
  dit(mur.split(PHRASE_ANDROID).length === 2 && !ceQuiVend(mur, 'android'),
    `app Android : le mur dit OÙ cela se débloque, d’une phrase, et rien d’autre (${ceQuiVend(mur, 'android') ?? 'rien'})`)
  dit(await android.page.locator('.vide a, .vide button').count() === 0,
    'app Android : cette phrase n’est ni un lien ni un bouton')
  await android.page.waitForTimeout(900)
  dit(await android.page.locator(FEUILLE).count() === 0, 'app : bloqué devant le mur, aucune feuille d’offre ne s’ouvre')
}

// --- 1. le classement : pas de volet « Portrait » à débloquer
async function classement(app, plateforme) {
  await app.page.goto(`${BASE}/g/${GRATUITE}/classement`, { waitUntil: 'networkidle' })
  await app.page.waitForSelector('[role="tab"]', { timeout: 20000 })
  const onglets = await app.page.locator('.cadre [role="tablist"] [role="tab"]').allInnerTexts()
  let vend = null
  for (let i = 0; i < onglets.length; i++) {
    await app.page.locator('.cadre [role="tablist"] [role="tab"]').nth(i).click()
    await app.page.waitForTimeout(700)
    vend ??= ceQuiVend(await texte(app.page), plateforme)
  }
  dit(onglets.length >= 3 && !onglets.some(o => /portrait/i.test(o)) && !vend,
    `app ${plateforme} : le classement d’une liste gratuite — ${onglets.map(o => o.replace(/\s+/g, ' ').trim()).join(', ')} — sans rien à débloquer (${vend ?? 'rien'})`)
}
await classement(android, 'android')

// --- 1. « Rejoindre une liste » : un code cadeau ne s'y utilise pas
{
  await android.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await android.page.waitForSelector('.bento', { timeout: 20000 })
  await android.page.getByRole('button', { name: /Rejoindre une liste/ }).click()
  await android.page.waitForSelector(FEUILLE, { timeout: 8000 })
  const feuille = (await android.page.locator(FEUILLE).innerText()).replace(/\s+/g, ' ')
  dit(/Le code d’une liste\./.test(feuille) && !ceQuiVend(feuille, 'android'),
    'app : « Rejoindre une liste » ne parle que du code d’une liste')
  await android.page.locator(`${FEUILLE} input.code`).fill(CADEAU)
  await android.page.locator(FEUILLE).getByRole('button', { name: 'Entrer' }).click()
  const dit_ = android.page.getByRole('status').filter({ hasText: 'Un code cadeau s’utilise sur le site babynamed.fr' })
  await dit_.waitFor({ timeout: 8000 })
  await android.page.waitForSelector(FEUILLE, { state: 'detached', timeout: 8000 })
  dit(await android.page.locator(FEUILLE).count() === 0,
    'app : un code cadeau tapé quand même : on dit où il s’utilise, la feuille du cadeau ne s’ouvre pas')

  await android.page.goto(`${BASE}/?cadeau=${CADEAU}`, { waitUntil: 'networkidle' })
  await android.page.waitForSelector('.bento', { timeout: 20000 })
  await android.page.waitForTimeout(900)
  dit(await android.page.locator(FEUILLE).count() === 0
      && await android.page.getByRole('status').filter({ hasText: 'Un code cadeau s’utilise sur le site' }).count() === 1,
    'app : un lien cadeau ouvert dans l’app ne s’y utilise pas non plus')

  await android.page.goto(`${BASE}/offrir`, { waitUntil: 'networkidle' })
  await android.page.waitForSelector('.bento', { timeout: 20000 })
  dit(new URL(android.page.url()).pathname === '/', 'app : /offrir n’existe pas, on revient à l’accueil')
}

// =================== 2. LE SERVEUR LE TIENT AUSSI ==========================
{
  const avant = caisse.length
  const achat = await poster(android.page, `/api/groupes/${GRATUITE}/paiement`, { consentement: true })
  const offre = await poster(android.page, '/api/cadeaux/acheter', { consentement: true, de_la_part: 'Paul' })
  const usage = await poster(android.page, '/api/cadeaux/utiliser', { code: CADEAU, groupe: GRATUITE })
  dit([achat, offre, usage].every(r => r.status === 403 && r.j?.statusMessage === 'vente_fermee_dans_l_app'),
    `depuis une app, le serveur refuse l’achat d’une liste, l’achat d’un cadeau et l’usage d’un code (${achat.status}, ${offre.status}, ${usage.status})`)
  dit(caisse.length === avant, 'et Stripe n’est même pas appelé')
  const cadeau = (await api(paulWeb.page, `/api/cadeaux/verifier?code=${CADEAU}`)).j
  const liste = (await api(paulWeb.page, `/api/groupes/${GRATUITE}`)).j?.groupe
  dit(cadeau?.valide === true && liste?.paye === false, 'le code cadeau n’a pas servi, la liste est toujours gratuite')
}

// =================== L'APP iOS, PAUL (un second téléphone) =================
await dev(paulWeb.page, { action: 'nouvelle-journee' })
const ios = await ongletApp(nav, 'ios')
suivre(ios.page, 'Paul (app iOS)')
// Ce téléphone sait vendre : une app à jour, un produit connu de l'App Store.
// Le serveur, lui, n'a pas de quoi vérifier un achat chez Apple — l'app ne
// doit donc RIEN proposer : mieux vaut pas d'offre qu'une offre qui encaisse
// sans pouvoir débloquer.
ios.natif.achat.produits = { 'fr.babynamed.app.deblocage': '7,99 €' }
await entrer(ios.page, 'Paul')
await pause(1000)
dit(ios.natif.recus.filter(m => m.type === 'pret').length === 1,
  'iOS : entrer ne recharge pas la page (une seule « prête »)')
await ios.page.goto(`${BASE}/g/${GRATUITE}/reglages`, { waitUntil: 'networkidle' })
await ios.page.getByRole('heading', { name: 'Notifications' }).waitFor({ timeout: 20000 })
{
  const t = await texte(ios.page)
  dit(!ceQuiVend(t, 'ios') && await ios.page.locator('.carte.achat').count() === 0,
    `app iOS : les réglages d’une liste gratuite ne vendent rien (${ceQuiVend(t, 'ios') ?? 'rien'})`)
  dit(!ios.natif.recus.some(m => String(m.type).startsWith('achat.')),
    'app iOS : tant que le serveur ne sait pas vérifier un achat chez Apple, la page ne demande même pas son prix au téléphone')
  // --- 4. le thème choisi dans l'app part au natif (la barre d'état suit)
  const avant = ios.natif.recus.filter(m => m.type === 'theme').length
  await ios.page.locator('label.option', { hasText: 'Sombre' }).click()
  const sombre = await jusqua(() => ios.natif.recus.filter(m => m.type === 'theme')[avant])
  await ios.page.locator('label.option', { hasText: 'Système' }).click()
  const clair = await jusqua(() => ios.natif.recus.filter(m => m.type === 'theme')[avant + 1])
  dit(sombre?.sombre === true && /^#[0-9a-f]{6}$/i.test(sombre.fond ?? '') && clair?.sombre === false
      && sombre.fond !== clair.fond,
    `le thème choisi dans l’app est dit au natif, avec sa couleur de fond (${sombre?.fond} puis ${clair?.fond})`)
}
await ficheEtFete(ios, 'Jeanne', 'ios')
{
  // --- 5. c'est à la fête d'un accord qu'on propose d'être prévenu du suivant
  const bouton = ios.page.locator('.fete').getByRole('button', { name: 'Me prévenir du prochain accord' })
  dit(await bouton.count() === 1, 'téléphone jamais prévenu : la fête propose « Me prévenir du prochain accord »')
  await bouton.click()
  await bouton.waitFor({ state: 'detached', timeout: 8000 })
  const a = await appareils(ios.page)
  dit(a?.length === 2 && a.some(x => x.plateforme === 'ios') && a.some(x => x.plateforme === 'android'),
    `le geste enregistre ce second téléphone (${a?.map(x => x.plateforme).join(', ')})`)
  await ios.page.locator('.fete').getByRole('button', { name: 'Continuer à trier' }).click()
  await ios.page.waitForSelector('.fete', { state: 'detached', timeout: 8000 })
  await jusquAuMur(ios.page)
  const mur = (await ios.page.locator('.vide').innerText()).replace(/\s+/g, ' ')
  dit(/C’est tout pour aujourd’hui/.test(mur) && !ceQuiVend(mur, 'ios') && !/babynamed\.fr|site/i.test(mur)
      && await ios.page.locator('.vide a, .vide button').count() === 0,
    `app iOS : le mur ne dit rien d’un achat, ni où (${ceQuiVend(mur, 'ios') ?? 'rien'})`)
}
await classement(ios, 'ios')

// =================== 3. DÉBLOQUÉE SUR LE SITE, DÉBLOQUÉE DANS L'APP ========
{
  await ios.page.goto(`${BASE}/g/${GRATUITE}/swipe`, { waitUntil: 'networkidle' })
  await ios.page.waitForSelector('.vide h2', { timeout: 20000 })
  await pause(1700)                     // loin du dernier retour au premier plan
  // L'achat se fait sur le site (ici : l'outil de la base locale) pendant que
  // l'app est en arrière-plan ; au retour, le natif le dit.
  await dev(paulWeb.page, { action: 'debloquer', groupe: GRATUITE })
  await ios.natif.dire({ type: 'actif' })
  await ios.page.waitForSelector('.carte.fiche:not(.derriere) .nom', { timeout: 10000 })
  dit(await ios.page.locator('.vide').count() === 0,
    'une liste débloquée sur le site l’est dans l’app dès qu’on y revient : le mur tombe, les cartes reviennent')
  await ios.page.goto(`${BASE}/g/${GRATUITE}/classement`, { waitUntil: 'networkidle' })
  await ios.page.waitForSelector('[role="tab"]', { timeout: 20000 })
  const onglets = await ios.page.locator('.cadre [role="tablist"] [role="tab"]').allInnerTexts()
  await ios.page.goto(`${BASE}/g/${GRATUITE}/reglages`, { waitUntil: 'networkidle' })
  await ios.page.getByRole('heading', { name: 'Liste débloquée' }).waitFor({ timeout: 20000 })
  const t = await texte(ios.page)
  dit(onglets.some(o => /portrait/i.test(o)) && await ios.page.getByRole('heading', { name: 'Avec votre nom de famille' }).count() === 1,
    'et tout ce qu’elle ouvre y est : le portrait, le nom de famille')
  dit(!/offrir|cadeau|\d\s*€|achet|prix/i.test(t), 'sans y proposer d’offrir babyNamed pour autant')
}

// =================== 5. LES NOTIFICATIONS D'UN ACCORD ======================
// Alice, dans l'app iOS, refuse d'abord la question du téléphone.
const aliceApp = await ongletApp(nav, 'ios')
suivre(aliceApp.page, 'Alice (app iOS)')
aliceApp.natif.reponse = 'refusee'
await entrer(aliceApp.page, 'Alice')
await aliceApp.page.goto(`${BASE}/g/${PAYEE}/reglages`, { waitUntil: 'networkidle' })
await aliceApp.page.getByRole('heading', { name: 'Notifications' }).waitFor({ timeout: 20000 })
{
  await aliceApp.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' }).click()
  const reglages = aliceApp.page.getByRole('button', { name: 'Autoriser dans les réglages du téléphone' })
  await reglages.waitFor({ timeout: 8000 })
  dit((await appareils(aliceApp.page))?.length === 0,
    'refusé au téléphone : rien n’est enregistré, et le bouton mène aux réglages du téléphone')
  await reglages.click()
  dit(!!await jusqua(() => aliceApp.natif.recus.find(m => m.type === 'reglages')),
    'ce bouton demande au natif d’ouvrir les réglages')
  // Elle y autorise les notifications, puis revient dans l'app.
  aliceApp.natif.permission = aliceApp.natif.reponse = 'accordee'
  await pause(1700)
  await aliceApp.natif.dire({ type: 'actif' })
  await aliceApp.page.getByRole('button', { name: 'Ne plus me prévenir' }).waitFor({ timeout: 8000 })
  dit((await appareils(aliceApp.page))?.length === 1,
    'autorisées dans les réglages du téléphone : au retour dans l’app, il est enregistré sans rien redemander')
}
const jetonsDePaul = [android.natif.jeton, ios.natif.jeton]
{
  // Adèle : Alice a dit oui, Paul ne l'a pas jugée. Son oui fait l'accord.
  let n = messages().length
  await voter(paulWeb.page, PAYEE, 'Adèle', 2)
  const m = await jusqua(() => messages().slice(n).find(x => x.to === aliceApp.natif.jeton))
  dit(m?.title === 'Nouvel accord' && m.data?.chemin === `/g/${PAYEE}/communs` && m.channelId === 'accords' && m.sound === 'default',
    `un accord prévient l’autre : « ${m?.title} — ${m?.body} » → ${m?.data?.chemin}`)
  dit(!!m && !JSON.stringify(messages().slice(n)).includes('Adèle'),
    'sans le prénom : il s’afficherait sur un écran verrouillé')
  await pause(600)
  const partis = messages().slice(n)
  dit(partis.length === 1 && !partis.some(x => jetonsDePaul.includes(x.to)),
    'celui qui vient de voter n’est pas prévenu, sur aucun de ses téléphones ; qui n’a pas l’app non plus')

  n = messages().length
  await voter(paulWeb.page, PAYEE, 'Margot', 0)      // Alice oui, Paul non : pas un accord
  await voter(paulWeb.page, PAYEE, 'Adèle', 1)       // de oui à neutre : toujours le même accord
  await pause(1300)
  dit(messages().length === n, 'un non, ou un vote qui ne change rien à un accord déjà fait : rien ne part')
  await voter(paulWeb.page, PAYEE, 'Gaspard', 1)     // Alice oui, Paul neutre : un accord
  dit(!!await jusqua(() => messages().slice(n).find(x => x.to === aliceApp.natif.jeton)),
    'un neutre qui rejoint un oui fait un accord, et prévient')
  dit(envois.every(e => e.auth === null), 'sans jeton d’accès réglé, aucun en-tête d’autorisation ne part')
}
{
  // --- 4. la notification touchée : le natif donne le lien, l'app y va sans se recharger
  const prets = aliceApp.natif.recus.filter(m => m.type === 'pret').length
  await aliceApp.natif.dire({ type: 'lien', url: `${BASE}/g/${PAYEE}/communs` })
  await aliceApp.page.waitForURL(new RegExp(`/g/${PAYEE}/communs`), { timeout: 10000 })
  await aliceApp.page.waitForTimeout(800)
  dit(aliceApp.natif.recus.filter(m => m.type === 'pret').length === prets
      && /Adèle/.test(await texte(aliceApp.page)),
    'une notification touchée mène à l’écran des accords, sans recharger la page — le prénom est là')
  await aliceApp.natif.dire({ type: 'lien', url: 'https://ailleurs.exemple.test/g/1/reglages' })
  await aliceApp.page.waitForTimeout(600)
  dit(new URL(aliceApp.page.url()).pathname === `/g/${PAYEE}/communs`, 'un lien vers un autre site n’est pas suivi')
}
{
  // Couper dans l'app : le serveur oublie ce téléphone ; se reconnecter ne le rallume pas.
  await aliceApp.page.goto(`${BASE}/g/${PAYEE}/reglages`, { waitUntil: 'networkidle' })
  await aliceApp.page.getByRole('button', { name: 'Ne plus me prévenir' }).click()
  await aliceApp.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' }).waitFor({ timeout: 8000 })
  const n = messages().length
  await voter(paulWeb.page, PAYEE, 'Margot', 2)      // de non à oui : un accord
  await pause(1300)
  dit((await appareils(aliceApp.page))?.length === 0 && messages().length === n,
    '« Ne plus me prévenir » : le serveur oublie ce téléphone, un accord ne le prévient plus')
  await aliceApp.page.getByRole('button', { name: 'Passkeys, e-mail, mes données' }).click()
  await aliceApp.page.getByRole('button', { name: 'Se déconnecter' }).click()
  await aliceApp.page.waitForURL(/\/connexion/, { timeout: 15000 })
  await entrerComme(aliceApp.page, 'Alice')
  await aliceApp.page.waitForSelector('.bento', { timeout: 20000 })
  await aliceApp.page.goto(`${BASE}/g/${PAYEE}/reglages`, { waitUntil: 'networkidle' })
  const bouton = aliceApp.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' })
  await bouton.waitFor({ timeout: 20000 })
  await pause(600)
  dit((await appareils(aliceApp.page))?.length === 0,
    'se déconnecter puis revenir ne rallume pas des notifications qu’on avait coupées')
  await bouton.click()
  await aliceApp.page.getByRole('button', { name: 'Ne plus me prévenir' }).waitFor({ timeout: 8000 })
  dit((await appareils(aliceApp.page))?.length === 1, 'les rallumer d’un geste réenregistre le téléphone')
}
{
  // Dans l'autre sens : le oui d'Alice sur Lucien (Paul : oui) prévient les DEUX téléphones de Paul.
  const n = envois.length
  await voter(aliceApp.page, PAYEE, 'Lucien', 2)
  const e = await jusqua(() => envois[n])
  dit(e?.messages.length === 2 && jetonsDePaul.every(j => e.messages.some(m => m.to === j)),
    'un accord prévient tous les téléphones de l’autre, en un seul envoi')
}
{
  // « Déconnecter mes autres appareils », depuis l'iPhone de Paul : lui seul reste prévenu.
  await ios.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await ios.page.waitForSelector('.bento', { timeout: 20000 })
  await ios.page.getByRole('button', { name: /^Mon compte/ }).click()
  await ios.page.waitForSelector('.feuille-corps', { timeout: 8000 })
  await ios.page.getByRole('button', { name: 'Déconnecter mes autres appareils' }).click()
  await ios.page.getByRole('button', { name: 'Déconnecter les autres' }).click()
  await ios.page.getByRole('status').filter({ hasText: 'Tous vos autres appareils sont déconnectés' }).waitFor({ timeout: 8000 })
  const a = await jusqua(async () => { const x = await appareils(ios.page); return x?.length === 1 ? x : null })
  dit(a?.[0]?.plateforme === 'ios' && (await api(android.page, '/api/auth/moi')).j?.connecte === false,
    '« Déconnecter mes autres appareils » : l’autre téléphone est déconnecté et n’est plus prévenu ; celui-ci le reste')
  await ios.page.keyboard.press('Escape')
}
{
  // Un jeton que le service dit périmé (app désinstallée) est oublié.
  perimes.add(ios.natif.jeton)
  const n = envois.length
  await voter(aliceApp.page, PAYEE, 'Marius', 2)     // Paul : oui ; Alice passe de non à oui
  const e = await jusqua(() => envois[n])
  const reste = await jusqua(async () => { const x = await appareils(ios.page); return x?.length === 0 ? x : null })
  dit(e?.messages.length === 1 && e.messages[0].to === ios.natif.jeton && reste?.length === 0,
    'un téléphone que le service dit périmé est oublié après l’envoi')
}
{
  // Déconnecté : ce téléphone n'est plus prévenu pour ce compte.
  await aliceApp.page.getByRole('button', { name: 'Passkeys, e-mail, mes données' }).click()
  await aliceApp.page.getByRole('button', { name: 'Se déconnecter' }).click()
  await aliceApp.page.waitForURL(/\/connexion/, { timeout: 15000 })
  const n = envois.length
  const v = await voter(ios.page, PAYEE, 'Victor', 2)   // Alice : neutre ; Paul passe de neutre à oui
  await pause(1300)
  dit(v.status === 200 && envois.length === n, 'se déconnecter retire le téléphone : l’accord suivant ne lui parvient pas')
}

// =================== 6. LES LIENS ==========================================
{
  const aasa = await fetch(`${BASE}/.well-known/apple-app-site-association`)
  const j = await aasa.json().catch(() => null)
  const chemins = j?.applinks?.details?.[0]?.components?.map(c => c['/']) ?? []
  dit(aasa.status === 200 && /json/.test(aasa.headers.get('content-type') ?? '')
      && j.applinks.details[0].appIDs[0] === 'ABCDE12345.fr.babynamed.app'
      && JSON.stringify(chemins) === JSON.stringify(['/rejoindre/*', '/connexion/app'])
      && j.webcredentials?.apps?.[0] === 'ABCDE12345.fr.babynamed.app',
    `iOS : l’app n’ouvre que l’invitation et le lien de connexion demandé depuis elle (${chemins.join(', ')})`)
  const liens = await fetch(`${BASE}/.well-known/assetlinks.json`)
  const a = await liens.json().catch(() => null)
  dit(liens.status === 200 && a?.[0]?.target?.package_name === 'fr.babynamed.app'
      && a[0].target.sha256_cert_fingerprints.length === 1
      && a[0].relation.includes('delegate_permission/common.handle_all_urls'),
    'Android : le site reconnaît l’app par son empreinte (une empreinte mal formée est écartée)')
}
{
  // Demandé DEPUIS l'app : le lien de l'e-mail est celui que l'app ouvre.
  const avant = Date.now() - 1000
  await aliceApp.page.getByLabel('Votre adresse e-mail').fill('alice@exemple.test')
  await aliceApp.page.getByRole('button', { name: 'Recevoir un lien' }).click()
  const m = await courrielPour('alice@exemple.test', { apres: avant })
  dit(/\/connexion\/app#t=/.test(m?.lien ?? ''), `lien de connexion demandé depuis l’app : ${m?.lien?.replace(/#t=.*/, '#t=…')}`)
  // La messagerie l'ouvre dans un navigateur (ou l'e-mail est lu ailleurs) : on
  // dit où l'on est, et comment entrer dans l'app. Rien n'est usé tant qu'on
  // n'a pas touché « Continuer ».
  {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
    const dehors = await ctx.newPage()
    await dehors.goto(m.lien, { waitUntil: 'networkidle' })
    await dehors.getByRole('heading', { name: 'Continuer dans ce navigateur ?' }).waitFor({ timeout: 10000 }).catch(() => {})
    const carte = (await dehors.locator('.carte.pile').innerText().catch(() => '')).replace(/\s+/g, ' ')
    dit(/Continuer dans ce navigateur \?/.test(carte) && /Pour entrer dans l’app, tapez-y le code reçu par e-mail\./.test(carte)
        && await dehors.getByRole('button', { name: 'Continuer' }).isEnabled(),
      `ouvert dans un navigateur, il le dit et renvoie au code : « ${carte.slice(0, 90)} »`)
    await ctx.close()
  }
  // L'app tourne : le natif lui passe le lien touché dans l'e-mail.
  const prets = aliceApp.natif.recus.filter(x => x.type === 'pret').length
  await aliceApp.natif.dire({ type: 'lien', url: m.lien })
  await aliceApp.page.getByRole('heading', { name: 'Continuer sur cet appareil ?' }).waitFor({ timeout: 10000 })
  dit(new URL(aliceApp.page.url()).pathname === '/connexion/app' && !aliceApp.page.url().includes('#t=')
      && !/tapez-y le code/.test(await aliceApp.page.locator('.carte.pile').innerText()),
    'l’app l’ouvre sans se recharger, et le jeton quitte aussitôt l’adresse')
  await aliceApp.page.getByRole('button', { name: 'Continuer' }).click()
  const plusTard = aliceApp.page.getByRole('button', { name: 'Plus tard' })
  await Promise.race([plusTard.waitFor({ timeout: 15000 }), aliceApp.page.waitForSelector('.bento', { timeout: 15000 })]).catch(() => {})
  if (await plusTard.count()) await plusTard.click()
  await aliceApp.page.waitForSelector('.bento', { timeout: 20000 })
  dit((await api(aliceApp.page, '/api/auth/moi')).j?.utilisateur?.pseudo === 'Alice'
      && aliceApp.natif.recus.filter(x => x.type === 'pret').length === prets,
    'et fait entrer dans le compte (iOS : sans rechargement)')
  // --- 5. revenue sur son téléphone, elle y est de nouveau prévenue, sans rien redemander
  const demandes = aliceApp.natif.recus.filter(x => x.type === 'push.demander').length
  const a = await jusqua(async () => { const x = await appareils(aliceApp.page); return x?.length === 1 ? x : null })
  dit(a?.length === 1 && aliceApp.natif.recus.filter(x => x.type === 'push.demander').length === demandes,
    'se reconnecter sur son téléphone y retrouve ses notifications, sans que rien soit redemandé')
  // … mais quelqu'un d'autre sur ce téléphone n'hérite pas de son geste.
  await aliceApp.page.goto(`${BASE}/g/${PAYEE}/reglages`, { waitUntil: 'networkidle' })
  await aliceApp.page.getByRole('button', { name: 'Passkeys, e-mail, mes données' }).click()
  await aliceApp.page.getByRole('button', { name: 'Se déconnecter' }).click()
  await aliceApp.page.waitForURL(/\/connexion/, { timeout: 15000 })
  await entrerComme(aliceApp.page, 'Mamie')
  await aliceApp.page.waitForSelector('.bento', { timeout: 20000 })
  await aliceApp.page.goto(`${BASE}/g/${PAYEE}/reglages`, { waitUntil: 'networkidle' })
  await aliceApp.page.getByRole('button', { name: 'Me prévenir d’un nouvel accord' }).waitFor({ timeout: 20000 })
  await pause(700)
  dit((await appareils(aliceApp.page))?.length === 0,
    'un autre compte sur le même téléphone n’hérite pas de ce geste : rien n’est enregistré pour lui')
}
{
  // Demandé depuis un NAVIGATEUR : le lien reste au navigateur, app installée ou non.
  const visiteur = await onglet(nav)
  suivre(visiteur.page, 'visiteur (navigateur)')
  await visiteur.page.goto(`${BASE}/connexion?mode=connexion`, { waitUntil: 'networkidle' })
  const avant = Date.now() - 1000
  await visiteur.page.getByLabel('Votre adresse e-mail').fill('alice@exemple.test')
  await visiteur.page.getByRole('button', { name: 'Recevoir un lien' }).click()
  const m = await courrielPour('alice@exemple.test', { apres: avant })
  dit(/\/connexion\/lien#t=/.test(m?.lien ?? ''),
    `demandé depuis un navigateur : ${m?.lien?.replace(/#t=.*/, '#t=…')}, que l’app ne réclame pas`)
  await visiteur.ctx.close()
}
{
  // Android : entrer par le lien recharge la page (le cookie doit atteindre le disque).
  await android.page.goto(`${BASE}/connexion?mode=connexion`, { waitUntil: 'networkidle' })
  const avant = Date.now() - 1000
  await android.page.getByLabel('Votre adresse e-mail').fill('alice@exemple.test')
  await android.page.getByRole('button', { name: 'Recevoir un lien' }).click()
  const m = await courrielPour('alice@exemple.test', { apres: avant })
  const prets = android.natif.recus.filter(x => x.type === 'pret').length
  await android.natif.dire({ type: 'lien', url: m.lien })
  await android.page.getByRole('button', { name: 'Continuer' }).click({ timeout: 10000 })
  await android.page.waitForSelector('.bento', { timeout: 20000 })
  await pause(800)
  dit(/\/connexion\/app#t=/.test(m?.lien ?? '') && android.natif.recus.filter(x => x.type === 'pret').length === prets + 1
      && (await api(android.page, '/api/auth/moi')).j?.utilisateur?.pseudo === 'Alice',
    'Android : entrer par le lien recharge la page pour de bon, et on est connecté')
}
{
  // Une invitation suivie sans compte : le code traverse l'inscription.
  const invitee = await onglet(nav)
  suivre(invitee.page, 'invitée (navigateur)')
  await invitee.page.goto(`${BASE}/rejoindre/dec0de02`, { waitUntil: 'networkidle' })
  await invitee.page.waitForURL(/\/connexion\?code=dec0de02/, { timeout: 15000 })
  dit(/Une liste vous a été partagée/.test(await texte(invitee.page)),
    'une invitation suivie sans compte mène à l’inscription, le code avec elle')
  await inscrire(invitee.page, 'Zoé', 'zoe@exemple.test')
  await invitee.page.waitForURL(/\/g\/3\/swipe/, { timeout: 20000 })
  dit(true, 'et, une fois inscrite, dans la liste')
  await invitee.page.goto(`${BASE}/rejoindre/pas-un-code`, { waitUntil: 'networkidle' })
  await invitee.page.waitForSelector('.bento', { timeout: 20000 })
  dit(new URL(invitee.page.url()).pathname === '/', 'un lien d’invitation sans code valable ramène à l’accueil')
  await invitee.ctx.close()
}

// =================== 7. LE COMPTE DE DÉMONSTRATION DES STORES ==============
{
  const store = await ongletApp(nav, 'ios')
  suivre(store.page, 'validation (app iOS)')
  await store.page.goto(`${BASE}/connexion?mode=connexion`, { waitUntil: 'networkidle' })
  const avant = Date.now() - 1000
  await store.page.getByLabel('Votre adresse e-mail').fill('demo@exemple.test')
  await store.page.getByRole('button', { name: 'Recevoir un lien' }).click()
  const champ = store.page.locator('input[autocomplete="one-time-code"]')
  await champ.waitFor({ timeout: 8000 })
  dit(!await courrielPour('demo@exemple.test', { apres: avant, delai: 1500 }),
    'compte de démonstration : l’écran est le même, aucun e-mail ne part')
  await champ.fill('000000')
  await store.page.getByRole('alert').waitFor({ timeout: 8000 })
  dit(/pas le bon code/.test(await store.page.getByRole('alert').innerText()), 'un code faux y est refusé')
  await champ.fill('424242')
  const plusTard = store.page.getByRole('button', { name: 'Plus tard' })
  await Promise.race([plusTard.waitFor({ timeout: 15000 }), store.page.waitForSelector('.bento', { timeout: 15000 })]).catch(() => {})
  if (await plusTard.count()) await plusTard.click()
  await store.page.waitForSelector('.bento', { timeout: 20000 })
  const moi = (await api(store.page, '/api/auth/moi')).j?.utilisateur
  dit(moi?.pseudo === 'Démo' && moi.email === 'demo@exemple.test', `son code fixe ouvre le compte de démonstration (${moi?.pseudo})`)
  const ailleurs = await poster(paulWeb.page, '/api/auth/code', { email: 'alice@exemple.test', code: '424242', but: 'connexion' })
  dit(ailleurs.status === 400, `ce code ne vaut pour aucune autre adresse (HTTP ${ailleurs.status})`)
  await store.ctx.close()
}

console.log('\n' + ok.length + ' OK, ' + ko.length + ' échec(s)')
if (erreurs.length) console.log('Erreurs de page :', erreurs)
await nav.close()
expo.close(); stripe.close()
process.exit(ko.length || erreurs.length ? 1 : 0)
