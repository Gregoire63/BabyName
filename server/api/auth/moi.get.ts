export default defineEventHandler(async (e) => {
  const id = userIdOuNull(e)
  if (!id) return { connecte: false }
  const u = await q1(`select id, pseudo, cle_acces_hash is not null as a_une_cle from utilisateurs where id = $1`, [id])
  return u ? { connecte: true, utilisateur: u } : { connecte: false }
})
