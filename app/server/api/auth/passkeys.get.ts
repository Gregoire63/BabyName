/** Mes passkeys : de quoi les reconnaitre et les retirer. Jamais leur cle. */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  const liste = await q(
    `select id, nom, synchronisee, cree_le, utilisee_le from passkeys
      where user_id = $1 order by cree_le`, [moi.id])
  return { passkeys: liste, rpID: partieConfiante(e).rpID, userID: moi.webauthn_id }
})
