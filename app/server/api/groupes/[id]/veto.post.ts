export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  // Tout l'interet de l'observateur : il donne son avis sans pouvoir bloquer.
  if (moi.role === 'observateur') {
    throw createError({ statusCode: 403, statusMessage: 'observateur_sans_veto' })
  }
  const { prenom, motif } = await readBody<{ prenom?: string; motif?: string }>(e) ?? {}
  prenomValide(prenom)
  try {
    await ecrire(`insert into vetos (groupe_id, user_id, prenom, motif) values (?1, ?2, ?3, ?4)`,
      [gid, moi.user_id, prenom, (motif ?? '').slice(0, 200) || null])
  } catch (err: any) {
    if (String(err?.message).includes('quota_veto_atteint')) {
      throw createError({ statusCode: 409, statusMessage: 'quota_veto_atteint' })
    }
    if (estDoublon(err)) throw createError({ statusCode: 409, statusMessage: 'deja_veto' })
    throw err
  }
  return { ok: true }
})
