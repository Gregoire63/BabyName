/**
 * Codes d'invitation — partagés entre l'app (saisie, lecture des liens) et le
 * serveur (création, vérification).
 *
 * Les premiers codes faisaient 8 caractères hexadécimaux : 4 milliards de
 * valeurs. Ça paraît beaucoup ; à cent essais par seconde, une liste parmi
 * mille se trouve en une demi-journée — et un code, c'est une porte
 * ouverte sur les votes d'un couple. Les nouveaux font 10 caractères pris
 * dans un alphabet sans I, L, O, U, 0 ni 1 (les caractères qu'on recopie de
 * travers) : 30^10, soit 590 000 milliards de valeurs. Les anciens restent
 * valables : des liens sont déjà partagés.
 *
 * Le serveur limite en plus le nombre d'essais (server/utils/limites.ts).
 */
export const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
export const LONGUEUR_CODE = 10

/** Le code tel qu'il est stocké, ou '' s'il ne peut pas en être un. */
export function normaliserCodeInvitation(brut: unknown): string {
  const s = String(brut ?? '').trim()
  if (/^[0-9a-f]{8}$/i.test(s)) return s.toLowerCase()          // ancien format
  const n = [...s.toUpperCase()].filter(c => ALPHABET_CODE.includes(c)).join('')
  return n.length === LONGUEUR_CODE ? n : ''
}

/** Nettoyage PENDANT la saisie : tout ce qui ne peut figurer dans aucun des
 *  deux formats disparaît (I, L, O, U, ponctuation, espaces). */
export function saisieCodeInvitation(brut: string): string {
  return brut.toUpperCase().replace(/[^0-9A-HJKMNP-TV-Z]/g, '').slice(0, LONGUEUR_CODE)
}

/** Lisible à voix haute : « K7QMX 3XPD9 ». L'ancien format reste tel quel. */
export function codeLisible(code: string | null | undefined): string {
  if (!code) return ''
  return code.length === LONGUEUR_CODE ? `${code.slice(0, 5)} ${code.slice(5)}` : code
}
