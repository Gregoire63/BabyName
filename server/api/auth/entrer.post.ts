/**
 * Creation d'un compte : un pseudo suffit. La cle d'acces n'est renvoyee
 * qu'ici, une seule fois — la base n'en garde que l'empreinte.
 */
export default defineEventHandler(async (e) => {
  const { pseudo } = await readBody<{ pseudo?: string }>(e) ?? {}
  const p = pseudoValide(pseudo)
  const { cle, hash } = nouvelleCle()

  const u = await q1<{ id: string }>(
    `insert into utilisateurs (pseudo, cle_acces_hash) values ($1, $2) returning id`,
    [p, hash])
  if (!u) throw createError({ statusCode: 500, statusMessage: 'creation_impossible' })

  poserSession(e, u.id)
  return { utilisateur: { id: u.id, pseudo: p }, cle }
})
