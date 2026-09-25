/**
 * Ce que le serveur accepte d'écrire.
 *
 * Les routes prenaient n'importe quelle chaîne comme prénom et n'importe quel
 * JSON comme filtres : rien n'empêchait d'écrire un mégaoctet par requête
 * dans la base, à répétition. Un prénom du catalogue tient en quelques
 * dizaines de caractères, des filtres en quelques centaines d'octets : on
 * borne largement au-dessus, et on refuse le reste.
 */
const PRENOM = /^[\p{L}](?:[\p{L}\p{M}'’ -]{0,58}[\p{L}\p{M}])?$/u

/** Un prénom plausible (lettres, tirets, apostrophes, espaces ; 60 au plus),
 *  pris tel quel : pas d'espace autour, c'est la clé d'un vote. */
export function prenomValide(brut: unknown): string {
  const p = typeof brut === 'string' ? brut : ''
  if (!PRENOM.test(p)) throw createError({ statusCode: 400, statusMessage: 'prenom_invalide' })
  return p
}

/** Une liste de prénoms : chacun valide, `max` au plus, doublons retirés. */
export function prenomsValides(brut: unknown, max: number): string[] {
  if (!Array.isArray(brut)) return []
  const out = new Set<string>()
  for (const x of brut.slice(0, max)) {
    if (typeof x === 'string' && PRENOM.test(x)) out.add(x)
  }
  return [...out]
}

/** Un objet JSON de taille raisonnable (les filtres d'une liste). */
export function objetBorne(brut: unknown, maxOctets = 4096): Record<string, unknown> {
  if (brut === undefined || brut === null) return {}
  if (typeof brut !== 'object' || Array.isArray(brut)) {
    throw createError({ statusCode: 400, statusMessage: 'objet_attendu' })
  }
  const texte = JSON.stringify(brut)
  if (Buffer.byteLength(texte) > maxOctets) {
    throw createError({ statusCode: 413, statusMessage: 'trop_volumineux' })
  }
  return brut as Record<string, unknown>
}

/** Une adresse e-mail, en minuscules. Volontairement permissif : c'est le
 *  lien reçu qui prouve l'adresse, pas une expression régulière. */
export function emailValide(brut: unknown): string {
  const e = typeof brut === 'string' ? brut.trim().toLowerCase() : ''
  if (e.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) {
    throw createError({ statusCode: 400, statusMessage: 'email_invalide' })
  }
  return e
}
