export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const prenom = String(getQuery(e).prenom ?? '')
  // On ne peut retirer que SON propre veto — et il part avec ses graphies.
  // Un veto d'avant les graphies n'a pas de tête : il est la sienne.
  const r = await q<{ prenom: string }>(
    `delete from vetos where groupe_id = ?1 and user_id = ?3 and coalesce(tete, prenom) = ?2
     returning prenom`, [gid, prenom, moi.user_id])
  if (!r.length) throw createError({ statusCode: 403, statusMessage: 'pas_votre_veto' })
  return { ok: true, prenoms: r.map(x => x.prenom) }
})
