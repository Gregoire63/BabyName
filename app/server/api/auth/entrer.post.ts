/**
 * Un compte d'un prénom, sans adresse : en DÉVELOPPEMENT seulement.
 *
 * Les essais et les outils de dev s'en servent pour créer des comptes à la
 * volée. En production la route répond 404 : un compte se crée par
 * inscription.post.ts, adresse e-mail prouvée.
 */
export default defineEventHandler(async (e) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  await limiter(e, 'entrer', ipDe(e), 12, 3600)
  const { pseudo } = await readBody<{ pseudo?: string }>(e) ?? {}
  const p = pseudoValide(pseudo)

  const u = await q1<{ id: string }>(
    `insert into utilisateurs (pseudo) values (?1) returning id`, [p])
  if (!u) throw createError({ statusCode: 500, statusMessage: 'creation_impossible' })

  poserSession(e, u.id, 0)
  return { utilisateur: { id: u.id, pseudo: p } }
})
