/**
 * Retirer un prénom qu'on a ajouté — tant que personne d'autre ne l'a jugé.
 *
 * Le cas à servir : la faute de frappe vue juste après (« Jeaninne »). Son
 * auteur la retire, et elle part avec ce qu'il y avait mis lui-même : son
 * vote, son favori, son veto, ses commentaires — sans la carte, ils ne
 * voudraient plus rien dire.
 *
 * Mais dès qu'un autre membre l'a jugée (un vote, un veto, un « déjà pris »,
 * un favori, un commentaire), la carte n'est plus seulement à son auteur :
 * la retirer effacerait l'avis d'un autre, ou le laisserait porter sur un
 * prénom que plus personne ne voit. Refusé (409 deja_juge). Pour l'écarter
 * de sa propre pile, il reste le veto, comme pour tout prénom.
 *
 * Seul l'auteur : une proposition se retire par celui qui l'a faite. Une
 * carte dont l'auteur est parti (compte effacé, liste quittée) ne se retire
 * plus — elle est à la liste.
 *
 * `seule=1` : un prénom DU CATALOGUE que son auteur avait proposé parce que
 * les filtres de la liste l'écartaient (VueGroupe, proposerHorsFiltres), et
 * qu'il reprend en disant non. La carte n'était qu'une mise en tête de pile :
 * le prénom reste au catalogue, et ce que l'auteur en a dit reste aussi — son
 * « non » est justement ce qui la retire. Même règle pour le reste : seul
 * l'auteur, et seulement si personne d'autre ne l'a jugé.
 *
 * Le prénom dans l'adresse (?prenom=), pas dans un corps : sur Cloudflare, un
 * DELETE avec un corps restait suspendu (remettre.post.ts).
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const prenom = String(getQuery(e).prenom ?? '')
  const ligne = await q1<{ user_id: string | null }>(
    `select user_id from prenoms_ajoutes where groupe_id = ?1 and prenom = ?2`, [gid, prenom])
  if (!ligne) throw createError({ statusCode: 404, statusMessage: 'pas_ajoute' })
  if (ligne.user_id !== moi.user_id) throw createError({ statusCode: 403, statusMessage: 'pas_l_auteur' })

  // La vérification et l'effacement en UNE instruction : un vote arrivé entre
  // les deux ne peut pas se retrouver sur une carte disparue.
  const parti = await q<{ prenom: string }>(
    `delete from prenoms_ajoutes
      where groupe_id = ?1 and prenom = ?2 and user_id = ?3
        and not exists (select 1 from bulletins b
                         where b.groupe_id = ?1 and b.user_id <> ?3
                           and (json_type(b.positifs, ?4) is not null or json_type(b.negatifs, ?4) is not null))
        and not exists (select 1 from vetos t where t.groupe_id = ?1 and t.prenom = ?2 and t.user_id <> ?3)
        and not exists (select 1 from deja_pris d where d.groupe_id = ?1 and d.prenom = ?2
                           and (d.user_id is null or d.user_id <> ?3))
        and not exists (select 1 from favoris f where f.groupe_id = ?1 and f.prenom = ?2 and f.user_id <> ?3)
        and not exists (select 1 from commentaires c where c.groupe_id = ?1 and c.prenom = ?2 and c.user_id <> ?3)
      returning prenom`, [gid, prenom, moi.user_id, cheminPrenom(prenom)])
  if (!parti.length) throw createError({ statusCode: 409, statusMessage: 'deja_juge' })
  if (getQuery(e).seule === '1') return { ok: true }

  // Ce que l'auteur y avait mis. Après coup, et seulement à lui : s'il
  // échouait, il resterait un vote sur un prénom que personne ne voit — sans
  // conséquence, aucun accord ne se fait à un seul.
  const liste = [prenom]
  await lot([
    [SQL_REMETTRE, [gid, moi.user_id, liste, { [prenom]: null }]],
    [`delete from favoris where groupe_id = ?1 and user_id = ?2 and prenom = ?3`, [gid, moi.user_id, prenom]],
    [`delete from vetos where groupe_id = ?1 and user_id = ?2 and prenom = ?3`, [gid, moi.user_id, prenom]],
    [`delete from deja_pris where groupe_id = ?1 and user_id = ?2 and prenom = ?3`, [gid, moi.user_id, prenom]],
    [`delete from commentaires where groupe_id = ?1 and user_id = ?2 and prenom = ?3`, [gid, moi.user_id, prenom]],
    [`delete from elo where groupe_id = ?1 and user_id = ?2 and prenom = ?3`, [gid, moi.user_id, prenom]]
  ])
  return { ok: true }
})
