/**
 * Le code a 6 chiffres de l'e-mail, tape dans l'app.
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

  if (but === 'verification') {
    const moi = await exigerCompte(e)
    const r = await consommerCode(email, 'verification', String(code ?? ''))
    if (!r.ok) throw createError({ statusCode: 400, statusMessage: `code_${r.raison}`, data: { restants: r.restants } })
    if (r.user_id !== moi.id) throw createError({ statusCode: 400, statusMessage: 'code_aucun' })
    await enregistrerEmail(moi.id, email)
    await oublierEssais('code-email', email)
    return { but: 'verification', email }
  }

  const r = await consommerCode(email, 'connexion', String(code ?? ''))
  if (!r.ok) throw createError({ statusCode: 400, statusMessage: `code_${r.raison}`, data: { restants: r.restants } })
  const u = await q1<{ id: string; pseudo: string; gen: number }>(
    `update utilisateurs set vu_le = now() where id = $1 and email = $2
     returning id, pseudo, session_gen as gen`, [r.user_id, email])
  if (!u) throw createError({ statusCode: 400, statusMessage: 'code_aucun' })
  await oublierEssais('code-email', email)
  poserSession(e, u.id, u.gen)
  return { but: 'connexion', utilisateur: { id: u.id, pseudo: u.pseudo } }
})
