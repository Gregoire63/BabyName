export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  await exigerMembre(e, gid)
  return q(
    `select prenom, nb_votes, score, nb_oui, nb_neutres
       from v_matchs where groupe_id = $1
      order by score desc, nb_oui desc`, [gid])
})
