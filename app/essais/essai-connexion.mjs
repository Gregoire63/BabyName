/**
 * Se connecter sans mot de passe — et ce qui protège les comptes.
 *
 *  1. Deux onglets, Inscription et Connexion. Nouveau compte : un prénom et
 *     on entre, plus de clé à recopier ; l'accueil rappelle d'une ligne de
 *     quoi retrouver le compte, et c'est de là qu'on crée une passkey
 *     (authentificateur virtuel de Chrome) ; déconnecté, on revient sur
 *     l'onglet Connexion et avec elle ; retirée, elle ne sert plus.
 *  2. Lien par e-mail : le code (faux, puis bon), le lien (une seule fois),
 *     la même réponse pour une adresse inconnue, cinq codes faux et le lien
 *     meurt.
 *  3. Ajouter une adresse depuis « Mon compte », puis désactiver l'ancienne
 *     clé : elle n'ouvre plus rien.
 *  4. « Déconnecter mes autres appareils ».
 *  5. Ce qui se devine ne se devine plus : codes d'invitation (format long,
 *     essais limités), comptes à la chaîne.
 *  6. Une requête venue d'un autre site est refusée ; un observateur ne voit
 *     pas les codes ; les tailles sont bornées ; les en-têtes sont posés.
 *
 * Limites à leur valeur de production : voir essai-connexion.env.
 */
import { lancer, onglet, compteur, BASE } from './navigateur.mjs'

const { ok, ko, dit } = compteur()
const nav = await lancer()
const erreurs = []
// WebAuthn refuse une adresse IP comme domaine : les passkeys vivent sur localhost.
const LOCAL = BASE.replace('127.0.0.1', 'localhost')

async function nouvel() {
  const { ctx, page } = await onglet(nav)
  page.on('pageerror', e => { erreurs.push(e.message); console.log('   [err]', e.message) })
  return { ctx, page }
}
const boite = () => fetch(`${BASE}/api/dev/courriels`).then(r => r.json())
const dernierPour = async (a) => (await boite()).find(c => c.a === a)
const api = (page, chemin, init) => page.evaluate(async ([c, i]) => {
  const r = await fetch(c, i ? { ...i, headers: { 'content-type': 'application/json', ...(i.headers ?? {}) } } : undefined)
  return { status: r.status, j: await r.json().catch(() => null), h: Object.fromEntries(r.headers) }
}, [chemin, init])

async function entrerCle(page, cle, base = BASE) {
  await page.goto(`${base}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'J’ai déjà une clé' }).click()
  await page.locator('input.champ').fill(cle)
  await page.getByRole('button', { name: 'Entrer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
}
async function ouvrirCompte(page) {
  await page.getByRole('button', { name: /^Mon compte/ }).click()
  await page.waitForSelector('.feuille-corps', { timeout: 8000 })
  await page.waitForTimeout(400)
}
async function seDeconnecter(page) {
  await ouvrirCompte(page)
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(/\/connexion/, { timeout: 15000 })
}

// =================== 1. UN NOUVEAU COMPTE, UNE PASSKEY =====================
{
  const { ctx, page } = await nouvel()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
    hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })

  await page.goto(`${LOCAL}/connexion`, { waitUntil: 'networkidle' })
  const inscription = page.getByRole('tab', { name: 'Inscription' })
  const connexion = page.getByRole('tab', { name: 'Connexion' })
  dit(await page.getByRole('tab').count() === 2 && await inscription.getAttribute('aria-selected') === 'true',
    'la page ne propose que deux choses : Inscription (ouverte d’office) ou Connexion')
  await inscription.focus()
  await page.keyboard.press('ArrowRight')
  dit(await connexion.getAttribute('aria-selected') === 'true'
      && await page.evaluate(() => document.activeElement?.textContent?.trim()) === 'Connexion',
    'les flèches passent d’un onglet à l’autre (motif ARIA)')
  dit(await page.locator('input[type="email"]').count() === 1, 'Connexion : l’e-mail, tout de suite')
  await page.keyboard.press('ArrowLeft')
  await page.locator('input.champ').fill('Zoé')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
  // la page de connexion sort en fondu : on attend qu'il ne reste que l'accueil
  await page.waitForFunction(() => document.querySelectorAll('main').length === 1, null, { timeout: 5000 })
  const texte = await page.locator('main').innerText()
  dit(!/clé d’accès|XXXX-/i.test(texte), 'nouveau compte : plus aucune clé à recopier')
  dit(await page.locator('.proteger').count() === 1,
    'un prénom et on entre ; l’accueil rappelle d’une ligne de quoi retrouver le compte')

  await page.locator('.proteger').click()
  await page.waitForSelector('.feuille-corps', { timeout: 8000 })
  await page.getByRole('button', { name: 'Créer une passkey' }).click()
  await page.getByRole('button', { name: /^Retirer la passkey/ }).waitFor({ timeout: 15000 })
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId })
  dit(credentials.length === 1 && credentials[0].isResidentCredential && credentials[0].rpId === 'localhost',
    `une passkey découvrable, liée au domaine (${credentials[0]?.rpId})`)
  dit(!credentials[0]?.userHandle || !/[0-9a-f]{8}-[0-9a-f]{4}/.test(Buffer.from(credentials[0].userHandle, 'base64').toString()),
    'elle ne porte pas l’identifiant du compte')
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)
  dit(await page.locator('.proteger').count() === 0, 'protégé : l’accueil ne réclame plus rien')

  // L'onglet Connexion lance la demande « autofill » : le clavier du champ
  // e-mail propose la passkey. Un vrai téléphone attend qu'on la touche ;
  // l'authentificateur virtuel de Chrome, lui, la choisit tout seul — on
  // revient donc sans rien taper.
  await seDeconnecter(page)
  // Pas seulement « .bento » : pendant la transition de page, l'accueil qu'on
  // vient de quitter est encore dans le document — on lirait /api/auth/moi
  // avant la fin de la connexion.
  await page.waitForURL(u => !u.pathname.startsWith('/connexion'), { timeout: 20000 })
  await page.waitForSelector('.bento', { timeout: 20000 })
  let moi = (await api(page, '/api/auth/moi')).j
  dit(moi?.utilisateur?.pseudo === 'Zoé' && moi.utilisateur.passkeys === 1,
    'déconnecté, on revient avec la passkey que propose le champ e-mail, sans rien taper')

  // Le bouton, lui, doit marcher sans l'autofill (navigateurs qui ne l'ont
  // pas) : on le retire à ce contexte pour la suite.
  await ctx.addInitScript(() => {
    if (window.PublicKeyCredential) PublicKeyCredential.isConditionalMediationAvailable = async () => false
  })
  await page.reload({ waitUntil: 'networkidle' })     // l'app est une SPA : le script vaut au chargement
  await page.waitForSelector('.bento', { timeout: 20000 })
  await seDeconnecter(page)
  await page.waitForTimeout(800)
  dit(page.url().includes('/connexion')
      && await page.getByRole('tab', { name: 'Connexion' }).getAttribute('aria-selected') === 'true',
    'déconnecté, on revient sur l’onglet Connexion (pas sur une seconde inscription)')
  await page.getByRole('button', { name: 'Se connecter avec une passkey' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/connexion'), { timeout: 20000 })
  await page.waitForSelector('.bento', { timeout: 20000 })
  moi = (await api(page, '/api/auth/moi')).j
  dit(moi?.utilisateur?.pseudo === 'Zoé' && moi.utilisateur.passkeys === 1,
    'ou d’un geste, avec le bouton « Se connecter avec une passkey »')

  // La retirer depuis « Mon compte » : elle ne sert plus.
  const [avantRetrait] = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials
  await ouvrirCompte(page)
  await page.getByRole('button', { name: /^Retirer la passkey/ }).click()
  dit(/dernier moyen/i.test(await page.locator('.feuille-corps').innerText()),
    'retirer le dernier moyen de revenir est dit en toutes lettres')
  await page.locator('.feuille-corps').getByRole('button', { name: 'Retirer', exact: true }).click()
  await page.getByText('Passkey retirée').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  // Le navigateur est prévenu (API Signal) : le trousseau oublie la passkey.
  if (await page.evaluate(() => typeof PublicKeyCredential.signalAllAcceptedCredentials === 'function')) {
    const restantes = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials
    dit(restantes.length === 0, 'le trousseau est prévenu : la passkey retirée disparaît aussi de l’appareil')
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)
  dit(await page.locator('.proteger').count() === 1,
    'sans aucun moyen de revenir, l’accueil le signale')
  // Un trousseau qui n'aurait pas écouté la garde : le serveur la refuse.
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId })
  await cdp.send('WebAuthn.addCredential', { authenticatorId, credential: avantRetrait })
  await seDeconnecter(page)
  await page.getByRole('button', { name: 'Se connecter avec une passkey' }).click()
  await page.getByRole('alert').waitFor({ timeout: 10000 })
  dit(/plus liée à aucun compte/.test(await page.getByRole('alert').innerText()),
    'une passkey retirée n’ouvre plus rien, et on le dit')
  await ctx.close()
}

// =================== 2. LE LIEN ET LE CODE PAR E-MAIL ======================
{
  const { ctx, page } = await nouvel()
  await page.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Connexion' }).click()
  await page.locator('input[type="email"]').fill('audrey@exemple.test')
  dit(await page.locator('input[type="email"]').getAttribute('autocomplete') === 'username webauthn',
    'le champ propose aussi les passkeys du téléphone')
  await page.getByRole('button', { name: 'Recevoir un lien' }).click()
  await page.getByRole('status').filter({ hasText: 'audrey@exemple.test' }).waitFor({ timeout: 10000 })
  const m1 = await dernierPour('audrey@exemple.test')
  dit(!!m1 && /\/connexion\/lien#t=[A-Za-z0-9_-]{40,}$/.test(m1.lien) && /^\d{6}$/.test(m1.code),
    'l’e-mail porte un lien (jeton après le #) et un code à 6 chiffres')

  const faux = m1.code === '000000' ? '111111' : '000000'
  await page.locator('input[autocomplete="one-time-code"]').fill(faux)
  await page.getByRole('alert').waitFor({ timeout: 8000 })
  dit(/pas le bon code \(encore 4 essais\)/.test(await page.getByRole('alert').innerText()),
    'un code faux : on le dit, avec les essais restants')
  await page.locator('input[autocomplete="one-time-code"]').fill(m1.code)
  await page.waitForSelector('.bento', { timeout: 20000 })
  dit((await api(page, '/api/auth/moi')).j?.utilisateur?.pseudo === 'Audrey',
    'le bon code connecte (c’est ce qui sert dans l’app installée)')

  // Le lien, une seule fois.
  await seDeconnecter(page)
  await page.locator('input[type="email"]').fill('audrey@exemple.test')
  await page.getByRole('button', { name: 'Recevoir un lien' }).click()
  await page.getByRole('status').filter({ hasText: 'audrey@exemple.test' }).waitFor({ timeout: 10000 })
  const m2 = await dernierPour('audrey@exemple.test')
  await page.goto(m2.lien, { waitUntil: 'networkidle' })
  dit(page.url().endsWith('/connexion/lien'), `le jeton est effacé de l’adresse (${page.url().replace(BASE, '')})`)
  await page.getByRole('button', { name: 'Continuer' }).click()
  await page.waitForSelector('.bento', { timeout: 20000 })
  dit(true, 'le lien connecte, après un geste (pas au premier chargement : un robot de messagerie ne le brûle pas)')
  const { page: p2 } = await nouvel()
  await p2.goto(m2.lien, { waitUntil: 'networkidle' })
  await p2.getByRole('button', { name: 'Continuer' }).click()
  await p2.getByRole('heading', { name: 'Ce lien ne marche plus' }).waitFor({ timeout: 8000 })
  dit(true, 'le même lien une seconde fois : refusé')

  // Adresse inconnue : même réponse, rien ne part.
  const avant = (await boite()).length
  const inconnu = await api(p2, '/api/auth/lien', { method: 'POST', body: JSON.stringify({ email: 'personne@exemple.test' }) })
  dit(inconnu.status === 200 && inconnu.j?.ok === true && (await boite()).length === avant,
    'adresse inconnue : même réponse, aucun e-mail — on ne révèle pas qui a un compte')

  // Cinq codes faux : le lien meurt, même le bon code n'y fait plus rien.
  await api(p2, '/api/auth/lien', { method: 'POST', body: JSON.stringify({ email: 'audrey@exemple.test' }) })
  const m3 = await dernierPour('audrey@exemple.test')
  const autre = m3.code === '123456' ? '654321' : '123456'
  const statuts = []
  for (let i = 0; i < 5; i++) {
    statuts.push((await api(p2, '/api/auth/code', { method: 'POST',
      body: JSON.stringify({ email: 'audrey@exemple.test', code: autre }) })).j?.statusMessage)
  }
  const apres = await api(p2, '/api/auth/code', { method: 'POST',
    body: JSON.stringify({ email: 'audrey@exemple.test', code: m3.code }) })
  dit(statuts.at(-1) === 'code_epuise' && apres.status === 400,
    `cinq codes faux épuisent le lien ; le bon ne passe plus (${statuts.join(', ')} → ${apres.j?.statusMessage})`)
  await ctx.close()
}

// =================== 3. UNE ADRESSE, PUIS PLUS DE CLÉ ======================
{
  const { ctx, page } = await nouvel()
  await entrerCle(page, 'DEVG-REGX-2345')
  await ouvrirCompte(page)
  await page.getByRole('button', { name: 'Ajouter une adresse' }).click()
  await page.locator('.feuille-corps input[type="email"]').fill('greg@exemple.test')
  await page.getByRole('button', { name: 'Envoyer la confirmation' }).click()
  await page.getByRole('status').filter({ hasText: 'greg@exemple.test' }).waitFor({ timeout: 10000 })
  const avantConfirmation = (await api(page, '/api/auth/moi')).j?.utilisateur?.email
  const m = await dernierPour('greg@exemple.test')
  await page.locator('.feuille-corps input[autocomplete="one-time-code"]').fill(m.code)
  await page.getByText('Adresse confirmée').waitFor({ timeout: 10000 })
  const moi = (await api(page, '/api/auth/moi')).j?.utilisateur
  dit(!avantConfirmation && moi?.email === 'greg@exemple.test',
    'l’adresse n’est enregistrée qu’une fois prouvée (code reçu)')

  await page.getByRole('button', { name: 'Désactiver la clé' }).click()
  await page.locator('.feuille-corps').getByRole('button', { name: 'Désactiver la clé' }).last().click()
  await page.getByText('Clé d’accès désactivée').waitFor({ timeout: 8000 })
  const r = await fetch(`${BASE}/api/auth/reprendre`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cle: 'DEVG-REGX-2345' }) })
  dit(r.status === 403, 'l’ancienne clé désactivée n’ouvre plus rien')
  await ctx.close()
}

// =================== 4. DÉCONNECTER LES AUTRES APPAREILS ===================
{
  const tel = await nouvel(), tab = await nouvel()
  for (const x of [tel, tab]) await entrerCle(x.page, 'DEVA-DREY-2345')
  dit((await api(tab.page, '/api/auth/moi')).j?.connecte === true, 'Audrey est connectée sur deux appareils')
  await ouvrirCompte(tel.page)
  await tel.page.getByRole('button', { name: 'Déconnecter mes autres appareils' }).click()
  await tel.page.getByRole('button', { name: 'Déconnecter les autres' }).click()
  await tel.page.getByText('Tous vos autres appareils sont déconnectés').waitFor({ timeout: 8000 })
  const t = await api(tab.page, '/api/groupes')
  dit(t.status === 401 && (await api(tab.page, '/api/auth/moi')).j?.connecte === false,
    `la tablette est déconnectée (HTTP ${t.status})`)
  dit((await api(tel.page, '/api/auth/moi')).j?.connecte === true, 'le téléphone qui l’a demandé reste connecté')
  await tel.ctx.close(); await tab.ctx.close()
}

// L'ancienne adresse est prévenue quand on la remplace : un cookie volé ne
// suffit pas à s'installer en silence.
{
  const { ctx, page } = await nouvel()
  await entrerCle(page, 'DEVA-DREY-2345')
  await api(page, '/api/auth/email', { method: 'POST', body: JSON.stringify({ email: 'audrey.bis@exemple.test' }) })
  const m = await dernierPour('audrey.bis@exemple.test')
  const conf = await api(page, '/api/auth/code', { method: 'POST',
    body: JSON.stringify({ email: 'audrey.bis@exemple.test', code: m.code, but: 'verification' }) })
  const alerte = (await boite()).find(c => c.a === 'audrey@exemple.test' && /a changé/.test(c.sujet))
  dit(conf.status === 200 && !!alerte, 'remplacer l’adresse d’un compte prévient l’ancienne')
  await ctx.close()
}

// =================== 5. CE QUI SE DEVINE NE SE DEVINE PLUS =================
{
  const { ctx, page } = await nouvel()
  await entrerCle(page, 'DEVM-AMIE-2345')
  const liste = await api(page, '/api/groupes', { method: 'POST', body: JSON.stringify({ nom: 'Essai de code' }) })
  dit(/^[A-HJKMNP-TV-Z2-9]{10}$/.test(liste.j?.code_invitation ?? ''),
    `code d’invitation au format long : ${liste.j?.code_invitation} (30^10 valeurs)`)
  const statuts = []
  for (let i = 0; i < 11; i++) {
    statuts.push((await api(page, '/api/groupes/rejoindre',
      { method: 'POST', body: JSON.stringify({ code: `ZZZZZ${String(i).padStart(5, '2').replace(/[01]/g, '2')}` }) })).status)
  }
  dit(statuts.slice(0, 10).every(s => s === 404) && statuts[10] === 429,
    `dix codes faux, puis 429 : on ne balaie pas les codes (${statuts.join(',')})`)
  // Le code se tape aussi à voix haute, avec l'espace : « ABCDE FGHJK ».
  const { page: autre } = await nouvel()
  await entrerCle(autre, 'DEVA-DREY-2345')
  const lisible = `${liste.j.code_invitation.slice(0, 5)} ${liste.j.code_invitation.slice(5)}`.toLowerCase()
  const rej = await api(autre, '/api/groupes/rejoindre', { method: 'POST', body: JSON.stringify({ code: lisible }) })
  dit(rej.status === 200 && rej.j?.nom === 'Essai de code', 'le code lu à voix haute (espace, minuscules) passe')
  await ctx.close()

  // Des comptes à la chaîne depuis la même adresse : 12 par heure.
  const { page: p } = await nouvel()
  await p.goto(`${BASE}/connexion`, { waitUntil: 'networkidle' })
  const crees = []
  for (let i = 0; i < 13; i++) {
    crees.push((await api(p, '/api/auth/entrer', { method: 'POST', body: JSON.stringify({ pseudo: `Robot ${i}` }) })).status)
  }
  dit(crees.includes(429), `création de comptes en rafale : freinée (${crees.join(',')})`)
}

// =================== 6. ORIGINE, OBSERVATEUR, TAILLES, EN-TÊTES ============
{
  const { ctx, page } = await nouvel()
  await entrerCle(page, 'DEVM-AMIE-2345')        // Mamie : observatrice de « Notre liste »
  const listes = (await api(page, '/api/groupes')).j
  const notre = listes.find(l => l.nom === 'Notre liste')
  const detail = (await api(page, `/api/groupes/${notre.id}`)).j
  dit(notre.code_invitation === null && detail.groupe.code_invitation === null && detail.groupe.code_observateur === null,
    'un observateur ne reçoit aucun code d’invitation (il ne fait entrer personne)')
  dit((await api(page, `/api/groupes/${notre.id}/observateurs`, { method: 'POST' })).status === 403,
    'ni ne peut en créer un')

  const cookie = (await ctx.cookies()).find(c => c.name === 'pr_session')
  const depuis = (origine, site) => fetch(`${BASE}/api/auth/pseudo`, { method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `pr_session=${cookie.value}`,
               ...(origine ? { origin: origine } : {}), ...(site ? { 'sec-fetch-site': site } : {}) },
    body: JSON.stringify({ pseudo: 'Piratée' }) }).then(r => r.status)
  dit(await depuis('https://ailleurs.example') === 403 && await depuis(null, 'cross-site') === 403,
    'une requête venue d’un autre site est refusée, même avec le cookie')
  dit((await api(page, '/api/auth/moi')).j?.utilisateur?.pseudo === 'Mamie', 'et rien n’a changé')

  const gros = await api(page, `/api/groupes/${notre.id}/vote`,
    { method: 'POST', body: JSON.stringify({ prenom: 'A'.repeat(500), valeur: 2 }) })
  dit(gros.status === 400, `un « prénom » de 500 caractères est refusé (HTTP ${gros.status})`)
  const { page: g } = await nouvel()
  await entrerCle(g, 'DEVA-DREY-2345')
  const filtres = await api(g, `/api/groupes/${notre.id}/filtres`,
    { method: 'PUT', body: JSON.stringify({ x: 'y'.repeat(9000) }) })
  dit(filtres.status === 413, `des filtres de 9 Ko sont refusés (HTTP ${filtres.status})`)

  const r = await fetch(`${BASE}/connexion`)
  dit(r.headers.get('x-content-type-options') === 'nosniff' && /strict-origin/.test(r.headers.get('referrer-policy') ?? '')
      && !!r.headers.get('x-frame-options') && /camera=\(\)/.test(r.headers.get('permissions-policy') ?? ''),
    'en-têtes de sécurité posés (nosniff, referrer, cadre, permissions)')
  await ctx.close()
}

dit(erreurs.length === 0, `aucune erreur JS (${erreurs.length})`)
await nav.close()
console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
