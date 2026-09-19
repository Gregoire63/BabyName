export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, texte } = await readBody<{ prenom?: string; texte?: string }>(e) ?? {}
  const t = (texte ?? '').trim()
  if (!prenom || !t) throw createError({ statusCode: 400, statusMessage: 'champs_manquants' })
  if (t.length > 500) throw createError({ statusCode: 400, statusMessage: 'texte_trop_long' })
  await q(`insert into commentaires (groupe_id, user_id, prenom, texte) values ($1,$2,$3,$4)`,
    [gid, moi.user_id, prenom, t])
  return { ok: true }
})
