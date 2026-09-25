/** Retirer l'adresse du compte. Les liens en attente pour elle meurent aussi. */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  await q(`update utilisateurs set email = null, email_verifie_le = null where id = $1`, [moi.id])
  await q(`delete from liens_connexion where user_id = $1`, [moi.id])
  return { ok: true }
})
