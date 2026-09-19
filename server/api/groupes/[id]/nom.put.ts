export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role !== 'parent') throw createError({ statusCode: 403, statusMessage: 'reserve_aux_parents' })
  const { nom } = await readBody<{ nom?: string }>(e) ?? {}
  const n = (nom ?? '').trim().slice(0, 60)
  if (!n) throw createError({ statusCode: 400, statusMessage: 'nom_vide' })
  await q(`update groupes set nom = $2 where id = $1`, [gid, n])
  return { ok: true, nom: n }
})
