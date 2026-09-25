import { generateAuthenticationOptions } from '@simplewebauthn/server'

/**
 * Se connecter avec une passkey : le defi. Aucune liste de passkeys envoyee
 * (allowCredentials vide) : le telephone propose celles qu'il connait pour ce
 * site, sans que le serveur ait a savoir qui se presente.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'passkey-options', ipDe(e), 60, 600)
  const rp = partieConfiante(e)
  const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'preferred' })
  poserDefi(e, { c: options.challenge, b: 'connexion' })
  return options
})
