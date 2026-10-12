/**
 * Les langues d'un compte (migration 0013, app/composables/useLangue.ts) :
 * celle des e-mails et des notifications. Le serveur ne lit pas les textes de
 * l'app ; les siens sont dans textesCourriel.ts et textesPush.ts.
 */
export const LANGUES_COMPTE = ['fr', 'en', 'de', 'nl', 'sv', 'nb', 'pl', 'lv'] as const
export type LangueCompte = typeof LANGUES_COMPTE[number]

/** Une langue reçue (corps d'une requête, colonne) : connue, ou le français. */
export function langueDe(x: unknown): LangueCompte {
  return (LANGUES_COMPTE as readonly string[]).includes(String(x)) ? x as LangueCompte : 'fr'
}

/** Une langue reçue, ou rien si elle n'est pas connue (pour ne rien écraser). */
export function langueOuRien(x: unknown): LangueCompte | null {
  return (LANGUES_COMPTE as readonly string[]).includes(String(x)) ? x as LangueCompte : null
}
