/**
 * Une provenance : un mot court, en minuscules (seo, tiktok, google,
 * outil-nom, cadeau…). Tout le reste est refusé : ce champ vient du
 * navigateur, il ne doit pas pouvoir porter une adresse ou un texte libre.
 */
export function provenanceValide(x: unknown): string | null {
  const s = typeof x === 'string' ? x.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,31}$/.test(s) ? s : null
}
