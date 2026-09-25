import { verifyAuthenticationResponse } from '@simplewebauthn/server'

/**
 * Se connecter avec une passkey : la verification.
 *
 * Passkey inconnue (supprimee depuis « Mon compte », ou creee sur une base de
 * test) : 404, avec de quoi prevenir le trousseau pour qu'il cesse de la
 * proposer (voir connexion.vue, signal « unknownCredential »).
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'passkey-connexion', ipDe(e), 30, 600)
  const { reponse } = await readBody<{ reponse?: any }>(e) ?? {}
  if (!reponse || typeof reponse.id !== 'string' || reponse.id.length > 1400) {
    throw createError({ statusCode: 400, statusMessage: 'reponse_manquante' })
  }
  const defi = lireDefi(e, 'connexion')
  if (!defi) throw createError({ statusCode: 400, statusMessage: 'defi_expire' })

  const rp = partieConfiante(e)
  const pk = await q1<{ id: string; user_id: string; cle_publique: string; compteur: string | number;
                         transports: string[]; handle: string | null; gen: number; pseudo: string }>(
    `select p.id, p.user_id, p.cle_publique, p.compteur, p.transports,
            u.webauthn_id as handle, u.session_gen as gen, u.pseudo
       from passkeys p join utilisateurs u on u.id = p.user_id where p.id = $1`, [reponse.id])
  if (!pk) {
    throw createError({ statusCode: 404, statusMessage: 'passkey_inconnue',
                        data: { rpID: rp.rpID, credentialID: reponse.id } })
  }
  // La passkey dit a quel compte elle appartient : ce doit etre le sien.
  const handleRecu = reponse.response?.userHandle
  if (handleRecu && pk.handle && handleRecu !== pk.handle) {
    throw createError({ statusCode: 400, statusMessage: 'passkey_refusee' })
  }

  let v: Awaited<ReturnType<typeof verifyAuthenticationResponse>>
  try {
    v = await verifyAuthenticationResponse({
      response: reponse, expectedChallenge: defi.c,
      expectedOrigin: rp.origines, expectedRPID: rp.rpIDs,
      credential: {
        id: pk.id, publicKey: new Uint8Array(Buffer.from(pk.cle_publique, 'base64url')),
        counter: Number(pk.compteur), transports: pk.transports
      },
      requireUserVerification: false
    })
  } catch (err: any) {
    console.warn('[passkey] connexion refusee :', String(err?.message ?? err).slice(0, 160))
    throw createError({ statusCode: 400, statusMessage: 'passkey_refusee' })
  }
  if (!v.verified) throw createError({ statusCode: 400, statusMessage: 'passkey_refusee' })

  await q(`update passkeys set compteur = $2, utilisee_le = now(), synchronisee = $3 where id = $1`,
    [pk.id, v.authenticationInfo.newCounter, v.authenticationInfo.credentialBackedUp])
  await q(`update utilisateurs set vu_le = now() where id = $1`, [pk.user_id])
  poserSession(e, pk.user_id, pk.gen)
  return { utilisateur: { id: pk.user_id, pseudo: pk.pseudo } }
})
