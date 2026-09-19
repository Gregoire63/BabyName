export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { pseudo } = await readBody<{ pseudo?: string }>(e) ?? {}
  const p = (pseudo ?? '').trim().slice(0, 40)
  if (p.length < 1) throw createError({ statusCode: 400, statusMessage: 'pseudo_vide' })
  await q(`update utilisateurs set pseudo = $1 where id = $2`, [p, uid])
  return { ok: true, pseudo: p }
})
