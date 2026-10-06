/**
 * Cet appareil ne veut plus être prévenu : notifications coupées dans l'app,
 * ou déconnexion. On oublie son jeton — le mien seulement : on ne retire pas
 * celui d'un autre compte en le devinant.
 */
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const corps = await readBody<{ jeton?: unknown }>(e).catch(() => null) ?? {}
  const jeton = jetonPushValide(corps.jeton)
  if (!jeton) throw createError({ statusCode: 400, statusMessage: 'appareil_invalide' })
  await ecrire(`delete from appareils where jeton = ?1 and user_id = ?2`, [jeton, uid])
  return { ok: true }
})
