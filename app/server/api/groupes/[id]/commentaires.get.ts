/** Même règle que les votes : un commentaire reste caché tant qu'on n'a pas
 *  voté soi-même sur ce prénom. Sinon il révélerait l'avis de l'autre. */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const prenom = String(getQuery(e).prenom ?? '')
  if (!prenom) throw createError({ statusCode: 400, statusMessage: 'prenom_manquant' })
  return q(
    `select c.id, c.prenom, c.texte, c.ecrit_le, u.pseudo, c.user_id
       from commentaires c join utilisateurs u on u.id = c.user_id
      where c.groupe_id = $1 and c.prenom = $2
        and (c.user_id = $3
             or exists (select 1 from votes v where v.groupe_id=$1 and v.prenom=$2 and v.user_id=$3))
      order by c.ecrit_le`, [gid, prenom, moi.user_id])
})
