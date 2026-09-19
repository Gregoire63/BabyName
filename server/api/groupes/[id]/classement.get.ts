export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const [general, mien, manuel] = await Promise.all([
    q(`select prenom, note_generale, consensus, nb_classeurs
         from v_classement_general where groupe_id = $1
        order by note_generale desc nulls last limit 100`, [gid]),
    q(`select prenom, rang from v_rang_personnel where groupe_id=$1 and user_id=$2
        order by rang limit 100`, [gid, moi.user_id]),
    q(`select prenom, position from classement_manuel where groupe_id=$1 and user_id=$2
        order by position`, [gid, moi.user_id])
  ])
  return { general, mon_rang: mien, mon_top: manuel }
})
