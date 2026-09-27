/**
 * L'accord du nombre : « 0 jugé », « 1 jugé », « 2 jugés ». En français, zéro
 * prend le singulier.
 *
 *   {{ n }} {{ pluriel(n, 'jugé', 'jugés') }}
 */
export const pluriel = (n: number | null | undefined, un: string, plusieurs: string) =>
  (n ?? 0) > 1 ? plusieurs : un
