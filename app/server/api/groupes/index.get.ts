export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const [listes, communs] = await Promise.all([
    q(
      // Le code d'invitation fait entrer comme membre qui DECIDE : un
      // observateur (lecture seule) ne le recoit pas, sinon il le transmettrait
      // et ferait entrer n'importe qui avec plus de droits que lui.
      // L'id sort en texte, comme le rendait Postgres (bigint) : l'accueil le
      // compare a la liste courante, gardee en texte.
      // Les compteurs viennent des bulletins (une ligne par membre) : `nb` et
      // `maj_le`, sans relire un seul vote. La derniere activite ignore un
      // bulletin vide (un vote refuse par le quota en cree un).
      `select cast(g.id as text) as id, g.nom,
              case when m.role <> 'observateur' then g.code_invitation end as code_invitation,
              g.nb_vetos_max, g.favoris_visibles,
              g.quota_swipe_jour, g.filtres, g.cree_le,
              (g.paye_le is not null) as paye, m.role,
              (select count(*) from membres m2 where m2.groupe_id = g.id) as nb_membres,
              coalesce((select b.nb from bulletins b
                         where b.groupe_id = g.id and b.user_id = ?1), 0) as mes_votes,
              coalesce((select sum(b.nb) from bulletins b where b.groupe_id = g.id), 0) as tous_votes,
              0 as nb_communs,
              (select max(b.maj_le) from bulletins b
                where b.groupe_id = g.id and b.nb > 0) as derniere_activite
         from groupes g join membres m on m.groupe_id = g.id
        where m.user_id = ?1
        order by coalesce(derniere_activite, g.cree_le) desc`, [uid]),
    // Les accords se comptent dans le Worker, sur les positifs des decideurs
    // (voir server/utils/votes.ts) : quelques lignes lues par liste.
    nbCommunsParListe(uid)
  ])
  for (const l of listes) l.nb_communs = communs.get(Number(l.id)) ?? 0
  return listes
})
