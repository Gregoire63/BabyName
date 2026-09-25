export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  // Attention : la colonne de date des votes s'appelle vote_le, pas cree_le.
  return q(
    // Le code d'invitation fait entrer comme membre qui DECIDE : un
    // observateur (lecture seule) ne le recoit pas, sinon il le transmettrait
    // et ferait entrer n'importe qui avec plus de droits que lui.
    `select g.id, g.nom,
            case when m.role <> 'observateur' then g.code_invitation end as code_invitation,
            g.nb_vetos_max, g.favoris_visibles,
            g.quota_swipe_jour, g.filtres, g.cree_le,
            (select count(*)::int from membres m2 where m2.groupe_id = g.id)   as nb_membres,
            (select count(*)::int from votes v where v.groupe_id = g.id
               and v.user_id = $1)                                             as mes_votes,
            (select count(*)::int from votes v where v.groupe_id = g.id)       as tous_votes,
            (select count(*)::int from v_matchs x where x.groupe_id = g.id)    as nb_communs,
            (select max(v.vote_le) from votes v where v.groupe_id = g.id)      as derniere_activite
       from groupes g join membres m on m.groupe_id = g.id
      where m.user_id = $1
      order by coalesce((select max(v.vote_le) from votes v where v.groupe_id = g.id),
                        g.cree_le) desc`, [uid])
})
