/**
 * Le code a 6 chiffres de l'e-mail, tape dans l'app : connexion, inscription,
 * ou adresse ajoutee a un compte (`but: 'verification'`).
 *
 * Un million de valeurs : sans frein, un script les essaierait toutes. Trois
 * freins s'empilent : cinq essais par lien (au-dela, il faut un nouvel
 * e-mail), dix par adresse et par quart d'heure, trente par IP.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'code-ip', ipDe(e), 30, 600)
  const { email: brut, code, but } = await readBody<{ email?: string; code?: string; but?: string }>(e) ?? {}
  const email = emailValide(brut)
  await limiter(e, 'code-email', email, 10, 900)

  // Le compte de démonstration des stores : pas d'e-mail, un code fixe
  // (utils/demo.ts). Les deux freins ci-dessus valent pour lui aussi.
  if (but !== 'verification' && estAdresseDemo(email)) {
    if (!codeDemoJuste(email, code)) throw createError({ statusCode: 400, statusMessage: 'code_faux' })
    const u = await ouvrirCompteInscrit(email, 'Démo')
    await oublierEssais('code-email', email)
    poserSession(e, u.id, u.gen)
    return { but: 'connexion', utilisateur: { id: u.id, pseudo: u.pseudo } }
  }

  if (but === 'verification') {
    const moi = await exigerCompte(e)
    const r = await consommerCode(email, 'verification', String(code ?? ''))
    if (!r.ok) throw createError({ statusCode: 400, statusMessage: `code_${r.raison}`, data: { restants: r.restants } })
    if (r.user_id !== moi.id) throw createError({ statusCode: 400, statusMessage: 'code_aucun' })
    await enregistrerEmail(moi.id, email)
    await oublierEssais('code-email', email)
    return { but: 'verification', email }
  }

  // Connexion ou inscription, sans distinguer : une inscription sur une adresse
  // qui a déjà un compte a reçu un code de CONNEXION (inscription.post.ts), et
  // l'écran qui l'attend ne le sait pas — il ne doit pas le savoir.
  const r = await consommerCode(email, ['connexion', 'inscription'], String(code ?? ''))
  if (!r.ok) throw createError({ statusCode: 400, statusMessage: `code_${r.raison}`, data: { restants: r.restants } })
  if (r.but === 'inscription') {
    const u = await ouvrirCompteInscrit(email, r.pseudo ?? '')
    await oublierEssais('code-email', email)
    poserSession(e, u.id, u.gen)
    return { but: 'inscription', nouveau: u.nouveau, utilisateur: { id: u.id, pseudo: u.pseudo } }
  }
  const u = await q1<{ id: string; pseudo: string; gen: number }>(
    `update utilisateurs set vu_le = ${MAINTENANT} where id = ?1 and email = ?2
     returning id, pseudo, session_gen as gen`, [r.user_id, email])
  if (!u) throw createError({ statusCode: 400, statusMessage: 'code_aucun' })
  await oublierEssais('code-email', email)
  poserSession(e, u.id, u.gen)
  return { but: 'connexion', utilisateur: { id: u.id, pseudo: u.pseudo } }
})
