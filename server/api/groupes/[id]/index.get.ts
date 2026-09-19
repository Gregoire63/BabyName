export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const [groupe, membres, av, vetos, favoris] = await Promise.all([
    q1(`select id, nom, code_invitation, nb_vetos_max, favoris_visibles, quota_swipe_jour, filtres
          from groupes where id = $1`, [gid]),
    q(`select m.user_id, u.pseudo, m.role, m.poids from membres m
         join utilisateurs u on u.id = m.user_id where m.groupe_id = $1
        order by m.rejoint_le`, [gid]),
    avancement(gid),
    q(`select v.prenom, v.motif, u.pseudo from vetos v
         join utilisateurs u on u.id = v.user_id where v.groupe_id = $1`, [gid]),
    q(`select prenom from favoris where groupe_id = $1 and user_id = $2`, [gid, moi.user_id])
  ])
  return { groupe, membres, avancement: av, vetos, mes_favoris: favoris.map((f: any) => f.prenom), moi }
})
