/**
 * « Déjà pris » : retirer un prénom du jeu POUR TOUTE LA LISTE, en le disant.
 *
 * Le prénom de la cousine, du fils des amis, du collègue qu'on ne supporte
 * pas. Ce n'est pas un secret : toute la liste voit le prénom, qui l'a ajouté
 * et sa note, et chaque décideur peut l'en retirer. D'où l'absence de quota —
 * la transparence tient lieu de limite (la borne du trigger ne protège que la
 * base).
 *
 * Comme un veto, il emporte ses graphies : une ligne chacune, rattachées à la
 * tête. Une graphie déjà retirée est ignorée, pas refusée.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role === 'observateur') {
    throw createError({ statusCode: 403, statusMessage: 'observateur_lecture_seule' })
  }
  await limiter(e, 'exclusion', moi.user_id, 120, 3600)
  const { prenom, motif, variantes } =
    await readBody<{ prenom?: string; motif?: unknown; variantes?: unknown }>(e) ?? {}
  const tete = prenomValide(prenom)
  const autres = prenomsValides(variantes, GRAPHIES_MAX).filter(v => v !== tete)
  try {
    await lot([
      [`insert into deja_pris (groupe_id, prenom, tete, user_id, motif) values (?1, ?2, ?2, ?3, ?4)`,
        [gid, tete, moi.user_id, noteLibre(motif)]],
      [`insert or ignore into deja_pris (groupe_id, prenom, tete, user_id)
        select ?1, value, ?2, ?3 from json_each(?4)`,
        [gid, tete, moi.user_id, JSON.stringify(autres)]]
    ])
  } catch (err: any) {
    if (String(err?.message).includes('deja_pris_plein')) {
      throw createError({ statusCode: 409, statusMessage: 'deja_pris_plein' })
    }
    // Déjà là — lui-même ou comme graphie d'un autre.
    if (estDoublon(err)) throw createError({ statusCode: 409, statusMessage: 'deja_pris' })
    throw err
  }
  return { ok: true }
})
