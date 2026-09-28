export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  // Tous ceux qui décident (voir nom.put.ts) : un « invite » voyait ses
  // filtres appliqués, puis perdus au rechargement, sans un mot.
  if (moi.role === 'observateur') throw createError({ statusCode: 403, statusMessage: 'reserve_aux_decideurs' })
  const body = objetBorne(await readBody(e))
  await ecrire(`update groupes set filtres = ?2 where id = ?1`, [gid, JSON.stringify(body)])
  return { ok: true }
})
