/**
 * Les pages legales. Elles se lisent en chaine (les conditions renvoient aux
 * mentions, qui renvoient a la confidentialite…) et s'ouvrent depuis
 * n'importe ou : leur place dans l'historique et le sens du glissement en
 * dependent (middleware/legal.global.ts, middleware/glisse.global.ts).
 */
export const PAGES_LEGALES = ['/confidentialite', '/conditions', '/mentions-legales', '/accessibilite']

export const estPageLegale = (chemin: string) =>
  PAGES_LEGALES.includes(chemin.replace(/\/+$/, '') || '/')
