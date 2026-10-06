/**
 * Cet appareil veut être prévenu (app des stores) : on garde son jeton.
 *
 * Appelé par l'app à chaque ouverture, une fois les notifications permises.
 * Un jeton, un compte — le dernier connecté le reprend : un téléphone qui
 * change de mains ne reçoit plus les accords du compte d'avant.
 */
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  await limiter(e, 'appareil', uid, 30, 3600)
  const corps = await readBody<{ jeton?: unknown; plateforme?: unknown }>(e) ?? {}
  const jeton = jetonPushValide(corps.jeton)
  const plateforme = corps.plateforme === 'ios' || corps.plateforme === 'android' ? corps.plateforme : null
  if (!jeton || !plateforme) throw createError({ statusCode: 400, statusMessage: 'appareil_invalide' })
  await ecrire(
    `insert into appareils (jeton, user_id, plateforme) values (?1, ?2, ?3)
     on conflict (jeton) do update set user_id = excluded.user_id, plateforme = excluded.plateforme,
                                       vu_le = ${MAINTENANT}`, [jeton, uid, plateforme])
  return { ok: true }
})
