export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, motif } = await readBody<{ prenom?: string; motif?: string }>(e) ?? {}
  if (!prenom) throw createError({ statusCode: 400, statusMessage: 'prenom_manquant' })
  try {
    await q(`insert into vetos (groupe_id, user_id, prenom, motif) values ($1, $2, $3, $4)`,
      [gid, moi.user_id, prenom, (motif ?? '').slice(0, 200) || null])
  } catch (err: any) {
    if (String(err?.message).includes('quota_veto_atteint')) {
      throw createError({ statusCode: 409, statusMessage: 'quota_veto_atteint' })
    }
    if (err?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'deja_veto' })
    throw err
  }
  return { ok: true }
})
