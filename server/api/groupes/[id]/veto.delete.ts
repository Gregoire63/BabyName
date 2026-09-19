export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const prenom = String(getQuery(e).prenom ?? '')
  // On ne peut retirer que SON propre veto.
  const r = await q(`delete from vetos where groupe_id = $1 and prenom = $2 and user_id = $3
                     returning prenom`, [gid, prenom, moi.user_id])
  if (!r.length) throw createError({ statusCode: 403, statusMessage: 'pas_votre_veto' })
  return { ok: true }
})
