export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role !== 'parent') throw createError({ statusCode: 403, statusMessage: 'reserve_aux_parents' })
  const body = objetBorne(await readBody(e))
  await ecrire(`update groupes set filtres = ?2 where id = ?1`, [gid, JSON.stringify(body)])
  return { ok: true }
})
