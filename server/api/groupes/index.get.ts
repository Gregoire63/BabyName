export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  return q(
    `select g.id, g.nom, g.code_invitation, g.nb_vetos_max, g.favoris_visibles,
            g.quota_swipe_jour, g.filtres, g.cree_le,
            (select count(*)::int from membres m2 where m2.groupe_id = g.id)   as nb_membres,
            (select count(*)::int from votes v where v.groupe_id = g.id
               and v.user_id = $1)                                             as mes_votes,
            (select count(*)::int from votes v where v.groupe_id = g.id)       as tous_votes,
            (select count(*)::int from v_matchs x where x.groupe_id = g.id)    as nb_communs,
            (select max(v.cree_le) from votes v where v.groupe_id = g.id)      as derniere_activite
       from groupes g join membres m on m.groupe_id = g.id
      where m.user_id = $1
      order by coalesce((select max(v.cree_le) from votes v where v.groupe_id = g.id),
                        g.cree_le) desc`, [uid])
})
