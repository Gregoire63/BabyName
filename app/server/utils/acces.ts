import { randomInt } from 'node:crypto'

/**
 * Le code qui fait entrer dans une liste, et le prénom sous lequel on y
 * apparaît.
 *
 * (La clé d'accès des premiers comptes vivait ici. Plus personne ne s'en
 * servait : elle est partie avec la migration 0007. Un compte naît d'une
 * adresse e-mail prouvée, et revient par elle ou par une passkey.)
 */

/** Un code d'invitation neuf (voir shared/utils/codes.ts). */
export function nouveauCodeInvitation(): string {
  let c = ''
  for (let i = 0; i < LONGUEUR_CODE; i++) c += ALPHABET_CODE[randomInt(ALPHABET_CODE.length)]
  return c
}

export function pseudoValide(brut: unknown): string {
  const p = String(brut ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (p.length < 2) throw createError({ statusCode: 400, statusMessage: 'pseudo_trop_court' })
  return p
}
