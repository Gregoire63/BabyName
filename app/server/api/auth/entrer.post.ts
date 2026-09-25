/**
 * Creation d'un compte : un pseudo suffit.
 *
 * Plus de cle d'acces a noter : on revient par une passkey ou par un lien
 * recu par e-mail, que l'app propose juste apres (et dans « Mon compte »).
 *
 * Limitee par adresse IP : un compte se cree sans rien prouver, c'est ce qui
 * rend l'app agreable — et ce qui la rendrait facile a remplir de comptes
 * vides par un script.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'entrer', ipDe(e), 12, 3600)
  const { pseudo } = await readBody<{ pseudo?: string }>(e) ?? {}
  const p = pseudoValide(pseudo)

  const u = await q1<{ id: string }>(
    `insert into utilisateurs (pseudo) values (?1) returning id`, [p])
  if (!u) throw createError({ statusCode: 500, statusMessage: 'creation_impossible' })

  poserSession(e, u.id, 0)
  return { utilisateur: { id: u.id, pseudo: p } }
})
