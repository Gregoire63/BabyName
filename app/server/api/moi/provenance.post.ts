/**
 * La provenance d'un compte (voir migration 0008) : envoyée par le
 * navigateur juste après l'inscription, gardée une seule fois. Un compte de
 * plus de 24 heures n'en reçoit pas : un ancien utilisateur qui repasse par
 * une vidéo n'est pas une inscription venue de cette vidéo.
 */
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const corps = await readBody<{ provenance?: unknown }>(e).catch(() => null)
  const p = provenanceValide(corps?.provenance)
  if (!p) return { ok: false }
  const r = await ecrire(
    `update utilisateurs set provenance = ?2
      where id = ?1 and provenance is null and cree_le > ${decale('-1 day')}`, [uid, p])
  return { ok: true, pose: r.changes > 0 }
})
