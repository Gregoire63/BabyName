export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { code } = await readBody<{ code?: string }>(e) ?? {}
  const c = (code ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}$/.test(c)) throw createError({ statusCode: 400, statusMessage: 'code_invalide' })
  const g = await q1<{ id: number; nom: string }>(
    `select id, nom from groupes where code_invitation = $1`, [c])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  await q(`insert into membres (groupe_id, user_id, role, poids) values ($1, $2, 'invite', 1.0)
           on conflict do nothing`, [g.id, uid])
  return g
})
