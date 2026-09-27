/**
 * Les accords, et les cœurs de la famille dessus.
 *
 * Un observateur (les grands-parents) ne compte ni dans les accords ni dans
 * leur ordre : v_matchs l'exclut. Mais son « oui » sur un prénom que le couple
 * a déjà retenu est exactement ce qu'il a envie de dire — « celui-là, je
 * l'adore ». C'est `coeurs` : les observateurs qui ont dit oui à ce prénom.
 * Leur « non », lui, ne s'affiche pas ici : sur la courte liste du couple, un
 * refus de la famille serait un veto par la bande.
 *
 * Vote à l'aveugle, comme partout : on ne voit les cœurs des autres qu'après
 * avoir donné son propre avis sur ce prénom. Un parent l'a toujours donné
 * (c'est un accord) ; un observateur, pas forcément.
 *
 * `nb_commentaires` suit la même règle que commentaires.get.ts : la carte
 * repliée dit « 1 mot », sinon le mot de Mamie dort sous un prénom que
 * personne ne pense à déplier.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  return q(
    `select m.prenom, m.nb_votes, m.score, m.nb_oui, m.nb_neutres,
            (select json_group_array(json_object('pseudo', x.pseudo, 'moi', x.moi))
               from (select u.pseudo, (v.user_id = ?2) as moi
                       from votes v
                       join membres mb on mb.groupe_id = v.groupe_id and mb.user_id = v.user_id
                       join utilisateurs u on u.id = v.user_id
                      where v.groupe_id = m.groupe_id and v.prenom = m.prenom and v.valeur = 2
                        and mb.role = 'observateur'
                        and exists (select 1 from votes w where w.groupe_id = m.groupe_id
                                      and w.prenom = m.prenom and w.user_id = ?2)
                      order by v.vote_le) x) as coeurs,
            exists (select 1 from votes w where w.groupe_id = m.groupe_id and w.prenom = m.prenom
                      and w.user_id = ?2 and w.valeur = 2) as j_aime,
            (select count(*) from commentaires k
              where k.groupe_id = m.groupe_id and k.prenom = m.prenom
                and (k.user_id = ?2
                     or exists (select 1 from votes w where w.groupe_id = m.groupe_id
                                  and w.prenom = m.prenom and w.user_id = ?2))) as nb_commentaires
       from v_matchs m where m.groupe_id = ?1
      order by m.score desc, m.nb_oui desc`, [gid, moi.user_id])
})
