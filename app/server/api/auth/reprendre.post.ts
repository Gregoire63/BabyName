/**
 * Reprise d'un compte par son ANCIENNE cle d'acces.
 *
 * Les nouveaux comptes n'en ont plus (passkey ou lien par e-mail) ; les
 * anciens la gardent tant qu'ils ne la desactivent pas dans « Mon compte ».
 *
 * L'espace des cles (30^12) rend la devinette sans espoir ; la limite par IP
 * n'est la que pour qu'un script ne fasse pas travailler la base pour rien.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'reprendre', ipDe(e), 30, 900)
  const { cle } = await readBody<{ cle?: string }>(e) ?? {}
  const norme = normaliserCle(cle ?? '')
  if (norme.length < 8) throw createError({ statusCode: 400, statusMessage: 'cle_invalide' })

  const u = await q1<{ id: string; pseudo: string; gen: number }>(
    `update utilisateurs set vu_le = ${MAINTENANT} where cle_acces_hash = ?1
     returning id, pseudo, session_gen as gen`, [hacherCle(norme)])
  if (!u) throw createError({ statusCode: 403, statusMessage: 'cle_inconnue' })

  poserSession(e, u.id, u.gen)
  return { utilisateur: { id: u.id, pseudo: u.pseudo } }
})
