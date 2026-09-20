/**
 * Annule mes votes sur un ou plusieurs prénoms : ils retournent dans la pile
 * à trier. Sert au « remettre » des prénoms écartés — sans quoi un balayage
 * de famille était définitif alors qu'il se déclenche en un seul geste.
 *
 * On ne touche qu'à MES votes : rien ne permet d'effacer celui d'un autre.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenoms } = await readBody<{ prenoms?: string[] }>(e) ?? {}
  const liste = (prenoms ?? []).filter(p => typeof p === 'string' && p).slice(0, 200)
  if (!liste.length) throw createError({ statusCode: 400, statusMessage: 'aucun_prenom' })

  await q(`delete from votes
            where groupe_id = $1 and user_id = $2 and prenom = any($3)`,
    [gid, moi.user_id, liste])
  // L'Elo et le classement manuel du prénom n'ont plus lieu d'être.
  await q(`delete from elo where groupe_id = $1 and user_id = $2 and prenom = any($3)`,
    [gid, moi.user_id, liste])
  return { ok: true, remis: liste.length }
})
