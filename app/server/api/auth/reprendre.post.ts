/**
 * Reprise d'un compte existant sur un autre appareil.
 *
 * Pas de limitation du nombre d'essais : l'espace des cles est de l'ordre de
 * 5 x 10^17. A dix tentatives par seconde il faudrait plus d'un milliard
 * d'annees. Limiter ici n'apporterait rien et ne servirait qu'a bloquer
 * quelqu'un qui recopie mal sa propre cle.
 */
export default defineEventHandler(async (e) => {
  const { cle } = await readBody<{ cle?: string }>(e) ?? {}
  const norme = normaliserCle(cle ?? '')
  if (norme.length < 8) throw createError({ statusCode: 400, statusMessage: 'cle_invalide' })

  const u = await q1<{ id: string; pseudo: string }>(
    `select id, pseudo from utilisateurs where cle_acces_hash = $1`, [hacherCle(norme)])
  if (!u) throw createError({ statusCode: 403, statusMessage: 'cle_inconnue' })

  await q(`update utilisateurs set vu_le = now() where id = $1`, [u.id])
  poserSession(e, u.id)
  return { utilisateur: u }
})
