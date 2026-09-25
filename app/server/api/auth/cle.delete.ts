/**
 * Desactiver l'ancienne cle d'acces.
 *
 * Une fois une passkey ou une adresse e-mail en place, la cle n'est plus
 * qu'un secret de plus qui traine sur un bout de papier. On l'efface : seule
 * son empreinte etait gardee, il n'en reste plus rien.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  await ecrire(`update utilisateurs set cle_acces_hash = null where id = ?1`, [moi.id])
  return { ok: true }
})
