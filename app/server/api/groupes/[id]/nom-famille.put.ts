/**
 * Le nom de famille de l'enfant, pour l'essai de sonorité.
 *
 * Réservé aux listes débloquées : c'est la donnée d'entrée d'une fonction
 * payante, et la stocker pour une liste qui n'y a pas accès n'aurait pas de
 * sens. Vide = on l'efface.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  await exigerMembre(e, gid)
  const { nom } = await readBody<{ nom?: string }>(e) ?? {}

  const g = await q1<{ paye: boolean }>(
    `select (paye_le is not null) as paye from groupes where id = ?1`, [gid])
  if (!g?.paye) throw createError({ statusCode: 402, statusMessage: 'liste_non_debloquee' })

  const propre = typeof nom === 'string' ? nom.trim().slice(0, 60) : ''
  await ecrire(`update groupes set nom_famille = ?2 where id = ?1`, [gid, propre || null])
  return { ok: true, nom_famille: propre || null }
})
