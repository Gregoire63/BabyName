export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  // Tous ceux qui décident : l'autre parent entre par le lien d'invitation
  // (rôle « invite ») et doit pouvoir renommer la liste. Un observateur, non.
  if (moi.role === 'observateur') throw createError({ statusCode: 403, statusMessage: 'reserve_aux_decideurs' })
  const { nom } = await readBody<{ nom?: string }>(e) ?? {}
  const n = (nom ?? '').trim().slice(0, 60)
  if (!n) throw createError({ statusCode: 400, statusMessage: 'nom_vide' })
  await ecrire(`update groupes set nom = ?2 where id = ?1`, [gid, n])
  return { ok: true, nom: n }
})
