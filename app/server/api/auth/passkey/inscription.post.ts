import { verifyRegistrationResponse } from '@simplewebauthn/server'

/**
 * Enregistrer la passkey que le telephone vient de creer.
 *
 * Seule la cle PUBLIQUE est gardee : elle verifie une signature, elle n'en
 * produit aucune. La base volee, elle n'ouvre rien.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  const { reponse } = await readBody<{ reponse?: any }>(e) ?? {}
  const defi = lireDefi(e, 'inscription')
  if (!defi || defi.u !== moi.id) throw createError({ statusCode: 400, statusMessage: 'defi_expire' })
  if (!reponse || typeof reponse !== 'object') throw createError({ statusCode: 400, statusMessage: 'reponse_manquante' })

  const rp = partieConfiante(e)
  let v: Awaited<ReturnType<typeof verifyRegistrationResponse>>
  try {
    v = await verifyRegistrationResponse({
      response: reponse, expectedChallenge: defi.c,
      expectedOrigin: rp.origines, expectedRPID: rp.rpIDs,
      requireUserVerification: false
    })
  } catch (err: any) {
    console.warn('[passkey] inscription refusee :', String(err?.message ?? err).slice(0, 160))
    throw createError({ statusCode: 400, statusMessage: 'passkey_refusee' })
  }
  if (!v.verified) throw createError({ statusCode: 400, statusMessage: 'passkey_refusee' })

  const { credential, credentialBackedUp, aaguid } = v.registrationInfo
  const nom = nomPasskey(aaguid, getHeader(e, 'user-agent') ?? '')
  await q(`insert into passkeys (id, user_id, cle_publique, compteur, transports, nom, synchronisee)
           values ($1, $2, $3, $4, $5, $6, $7) on conflict (id) do nothing`,
    [credential.id, moi.id, Buffer.from(credential.publicKey).toString('base64url'),
     credential.counter, credential.transports ?? [], nom, credentialBackedUp])
  // Une porte de plus sur le compte : son adresse, s'il en a une, l'apprend.
  if (moi.email) await prevenir(alertePasskey({ a: moi.email, pseudo: moi.pseudo, nom }))
  return { ok: true, passkey: { id: credential.id, nom, synchronisee: credentialBackedUp } }
})
