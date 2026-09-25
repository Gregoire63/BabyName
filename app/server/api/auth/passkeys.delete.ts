/**
 * Retirer une passkey (telephone perdu, trousseau abandonne).
 *
 * On renvoie celles qui restent : l'app le dit au trousseau du navigateur
 * (signal « allAcceptedCredentials »), qui peut cesser de proposer celle-ci.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  const id = String(getQuery(e).id ?? '')
  const r = await q(`delete from passkeys where id = ?1 and user_id = ?2 returning id`, [id, moi.id])
  if (!r.length) throw createError({ statusCode: 404, statusMessage: 'passkey_inconnue' })
  const restantes = await q<{ id: string }>(`select id from passkeys where user_id = ?1`, [moi.id])
  return { ok: true, restantes: restantes.map(p => p.id), rpID: partieConfiante(e).rpID, userID: moi.webauthn_id }
})
