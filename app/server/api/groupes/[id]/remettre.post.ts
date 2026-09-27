/**
 * Annule mes votes sur un ou plusieurs prénoms : ils retournent dans la pile
 * à trier. Sert au « remettre » des prénoms écartés — sans quoi un balayage
 * de famille était définitif alors qu'il se déclenche en un seul geste.
 *
 * On ne touche qu'à MES votes (mon bulletin) : rien ne permet d'effacer celui
 * d'un autre.
 *
 * Un POST, pas un DELETE avec un corps : sur Cloudflare, Nitro ne transmet le
 * corps que des POST, PUT et PATCH — le DELETE restait suspendu à attendre le
 * sien, et le Worker le coupait (500). Vu en faisant tourner l'app dans
 * workerd ; `nuxt dev`, sous Node, ne le montrait pas.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenoms } = await readBody<{ prenoms?: string[] }>(e) ?? {}
  const liste = prenomsValides(prenoms, 200)
  if (!liste.length) throw createError({ statusCode: 400, statusMessage: 'aucun_prenom' })

  await lot([
    [SQL_REMETTRE, [gid, moi.user_id, liste, Object.fromEntries(liste.map(p => [p, null]))]],
    // L'Elo et le classement manuel du prénom n'ont plus lieu d'être.
    [`delete from elo where groupe_id = ?1 and user_id = ?2 and prenom in ${DANS(3)}`,
      [gid, moi.user_id, liste]]
  ])
  return { ok: true, remis: liste.length }
})
