export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { a, b, gagnant } = await readBody<{ a?: string; b?: string; gagnant?: string | null }>(e) ?? {}
  if (!a || !b || a === b) throw createError({ statusCode: 400, statusMessage: 'duel_invalide' })
  if (gagnant != null && gagnant !== a && gagnant !== b) {
    throw createError({ statusCode: 400, statusMessage: 'gagnant_hors_duel' })
  }
  // Le trigger appliquer_elo() met les scores à jour.
  await q(`insert into duels (groupe_id, user_id, prenom_a, prenom_b, gagnant) values ($1,$2,$3,$4,$5)`,
    [gid, moi.user_id, a, b, gagnant ?? null])
  return { ok: true }
})
