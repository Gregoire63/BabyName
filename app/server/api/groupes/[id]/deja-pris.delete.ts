/**
 * Remettre un prénom « déjà pris » en jeu, avec ses graphies.
 *
 * N'importe quel décideur, pas seulement son auteur : la liste est commune,
 * et « ton neveu s'appelle Jules, et alors ? » est une conversation à avoir,
 * pas un verrou. Les votes déjà posés sur le prénom n'ont jamais été effacés :
 * il revient avec eux.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role === 'observateur') {
    throw createError({ statusCode: 403, statusMessage: 'observateur_lecture_seule' })
  }
  const tete = String(getQuery(e).prenom ?? '')
  const r = await q<{ prenom: string }>(
    `delete from deja_pris where groupe_id = ?1 and tete = ?2 returning prenom`, [gid, tete])
  if (!r.length) throw createError({ statusCode: 404, statusMessage: 'pas_deja_pris' })
  return { ok: true, prenoms: r.map(x => x.prenom) }
})
