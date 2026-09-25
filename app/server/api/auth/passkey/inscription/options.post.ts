import { randomBytes } from 'node:crypto'
import { generateRegistrationOptions } from '@simplewebauthn/server'

/**
 * Creer une passkey pour le compte connecte : les options de la ceremonie.
 *
 * Passkey « decouvrable » (residentKey: required) : c'est elle qui permet de
 * se connecter sans rien taper — le telephone propose le compte de lui-meme.
 * Aucune attestation demandee : on ne trie pas les appareils, et une
 * attestation dirait au serveur de quel modele il s'agit.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  await limiter(e, 'passkey-inscription', moi.id, 20, 3600)
  const rp = partieConfiante(e)

  // L'identifiant WebAuthn du compte : cree a la premiere passkey, jamais
  // l'id du compte (voir le schema). `coalesce` : deux onglets en meme temps
  // ne doivent pas en creer deux.
  const handle = (await q1<{ h: string }>(
    `update utilisateurs set webauthn_id = coalesce(webauthn_id, $2)
      where id = $1 returning webauthn_id as h`,
    [moi.id, randomBytes(32).toString('base64url')]))!.h

  const existantes = await q<{ id: string; transports: string[] }>(
    `select id, transports from passkeys where user_id = $1`, [moi.id])

  const options = await generateRegistrationOptions({
    rpName: 'babyNames',
    rpID: rp.rpID,
    // Ce que le trousseau affichera : l'adresse si on en a une (elle
    // distingue deux comptes), sinon le nom.
    userName: moi.email || moi.pseudo,
    userDisplayName: moi.pseudo,
    userID: new Uint8Array(Buffer.from(handle, 'base64url')),
    attestationType: 'none',
    excludeCredentials: existantes.map(p => ({ id: p.id, transports: p.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' }
  })
  poserDefi(e, { c: options.challenge, b: 'inscription', u: moi.id })
  return options
})
