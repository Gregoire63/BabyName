/** Même règle que les votes : un commentaire reste caché tant qu'on n'a pas
 *  voté soi-même sur ce prénom. Sinon il révélerait l'avis de l'autre. */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const prenom = prenomValide(String(getQuery(e).prenom ?? ''))
  return q(
    `select cast(c.id as text) as id, c.prenom, c.texte, c.ecrit_le, u.pseudo, c.user_id
       from commentaires c join utilisateurs u on u.id = c.user_id
      where c.groupe_id = ?1 and c.prenom = ?2
        and (c.user_id = ?3
             or exists (select 1 from bulletins b where b.groupe_id = ?1 and b.user_id = ?3
                          and (json_type(b.positifs, ?4) is not null or json_type(b.negatifs, ?4) is not null)))
      order by c.ecrit_le`, [gid, prenom, moi.user_id, cheminPrenom(prenom)])
})
