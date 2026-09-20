/**
 * Le classement personnel ne doit dépendre de rien d'autre que des choix déjà
 * faits : on renvoie aussi les oui et les favoris, qui servent de podium de
 * départ. Sans eux, quelqu'un qui a dit oui à trente prénoms voyait un podium
 * vide — ses choix existaient, on ne les montrait pas.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const [general, mien, manuel, oui, favoris] = await Promise.all([
    q(`select prenom, note_generale, consensus, nb_classeurs
         from v_classement_general where groupe_id = $1
        order by note_generale desc nulls last limit 100`, [gid]),
    q(`select prenom, rang from v_rang_personnel where groupe_id=$1 and user_id=$2
        order by rang limit 100`, [gid, moi.user_id]),
    q(`select prenom, position from classement_manuel where groupe_id=$1 and user_id=$2
        order by position`, [gid, moi.user_id]),
    q(`select prenom from votes
        where groupe_id=$1 and user_id=$2 and valeur=2
        order by vote_le desc limit 200`, [gid, moi.user_id]),
    q(`select prenom from favoris where groupe_id=$1 and user_id=$2`, [gid, moi.user_id])
  ])
  return {
    general,
    mon_rang: mien,
    mon_top: manuel,
    mes_oui: (oui as any[]).map(r => r.prenom),
    mes_favoris: (favoris as any[]).map(r => r.prenom)
  }
})
