export default defineEventHandler(async (e) => {
  const jeton = String(getQuery(e).jeton ?? '')
  if (!jeton) throw createError({ statusCode: 400, statusMessage: 'jeton_manquant' })

  // Usage unique : on marque le jeton consommé dans la requête qui le lit.
  const ligne = await q1<{ email: string }>(
    `update jetons_magiques set utilise_le = now()
      where jeton = $1 and utilise_le is null and expire_le > now()
      returning email`, [jeton])
  if (!ligne) return sendRedirect(e, '/connexion?erreur=lien_expire', 302)

  const u = await q1<{ id: string }>(
    `insert into utilisateurs (email, pseudo) values ($1, split_part($1, '@', 1))
       on conflict (email) do update set vu_le = now()
       returning id`, [ligne.email])

  poserSession(e, u!.id)
  return sendRedirect(e, '/', 302)
})
