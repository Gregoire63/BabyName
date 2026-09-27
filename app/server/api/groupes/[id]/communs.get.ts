/**
 * Les accords, et les cœurs de la famille dessus.
 *
 * Tout le calcul — accords, cœurs des observateurs, vote à l'aveugle,
 * commentaires comptés — vit dans server/utils/votes.ts (communsVisibles) :
 * c'est le seul endroit qui lit les votes des autres. Trois lectures pour
 * toute la liste, quel que soit le nombre de prénoms jugés.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  return communsVisibles(gid, moi.user_id)
})
