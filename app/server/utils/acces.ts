import { createHash, randomInt } from 'node:crypto'

/**
 * Cle d'acces personnelle — ce qui remplace le lien magique.
 *
 * Pourquoi pas d'e-mail : pour une liste a deux, le code d'invitation fait
 * deja entrer dans le bon groupe ; l'e-mail ne servait qu'a retrouver son
 * compte sur un autre appareil. Une cle que l'on note quelque part fait le
 * meme travail sans fournisseur d'envoi, sans DNS et sans dossier spam.
 *
 * Alphabet sans I, L, O, U, 0 ni 1 : ce sont les caracteres qu'on recopie de
 * travers. 30^12 combinaisons, soit environ 5 x 10^17 — inutile de limiter
 * le nombre d'essais, il faudrait des millions d'annees pour en trouver une.
 *
 * Seule l'empreinte est stockee. La cle en clair n'existe qu'une fois, dans
 * la reponse a la creation : personne ne peut la relire en base, et si elle
 * est perdue on en genere une nouvelle depuis un appareil deja connecte.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
const LONGUEUR = 12

export function normaliserCle(brut: string): string {
  return [...String(brut ?? '').toUpperCase()].filter(c => ALPHABET.includes(c)).join('')
}

export function hacherCle(cleNormalisee: string): string {
  return createHash('sha256').update(cleNormalisee).digest('hex')
}

export function formaterCle(cleNormalisee: string): string {
  return (cleNormalisee.match(/.{1,4}/g) ?? []).join('-')
}

/** Renvoie la cle lisible (groupee par 4) et l'empreinte a stocker. */
export function nouvelleCle(): { cle: string; hash: string } {
  let brut = ''
  for (let i = 0; i < LONGUEUR; i++) brut += ALPHABET[randomInt(ALPHABET.length)]
  return { cle: formaterCle(brut), hash: hacherCle(brut) }
}

export function pseudoValide(brut: unknown): string {
  const p = String(brut ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  if (p.length < 2) throw createError({ statusCode: 400, statusMessage: 'pseudo_trop_court' })
  return p
}
