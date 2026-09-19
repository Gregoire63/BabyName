export default defineEventHandler(async (e) => {
  const id = userIdOuNull(e)
  if (!id) return { connecte: false }
  const u = await q1(`select id, email, pseudo from utilisateurs where id = $1`, [id])
  return u ? { connecte: true, utilisateur: u } : { connecte: false }
})
