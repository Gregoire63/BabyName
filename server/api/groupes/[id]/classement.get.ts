/**
 * Le classement personnel ne doit pas dépendre des duels : tant qu'on n'en a
 * joué aucun, la table elo est vide et l'onglet paraissait vide alors qu'on
 * avait déjà dit oui à trente prénoms. On renvoie donc aussi les oui et les
 * favoris, qui servent de podium de départ.
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
