/**
 * L'ordre des accords, glissé à la main dans « Communs ».
 *
 * Le corps : `{ prenoms: [...] }`, du premier au dernier — l'ordre ENTIER des
 * accords visibles, pas un déplacement : deux gestes croisés des deux parents
 * donnent l'ordre du dernier, jamais un mélange des deux. Les prénoms qui ne
 * sont plus des accords n'y gênent pas (communsVisibles ne range que les
 * accords), ceux qui le deviennent ensuite suivent, marqués « nouveau ».
 *
 * Un observateur ne range pas : il donne son cœur, pas l'ordre du couple.
 */
const MAX_ORDRE = 500

export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role === 'observateur') {
    throw createError({ statusCode: 403, statusMessage: 'observateur_lecture_seule' })
  }
  await limiter(e, 'ordre_communs', moi.user_id, 600, 3600)
  const { prenoms } = await readBody<{ prenoms?: unknown }>(e) ?? {}
  if (!Array.isArray(prenoms)) throw createError({ statusCode: 400, statusMessage: 'prenoms_requis' })
  const ordre = prenomsValides(prenoms, MAX_ORDRE)
  await ecrire(`update groupes set ordre_communs = ?2 where id = ?1`,
    [gid, ordre.length ? JSON.stringify(ordre) : null])
  return { ok: true, n: ordre.length }
})
