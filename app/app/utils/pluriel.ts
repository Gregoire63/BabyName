import { langue, locale } from '~/composables/useLangue'

/**
 * L'accord du nombre : « 0 jugé », « 1 jugé », « 2 jugés ». En français, zéro
 * prend le singulier ; ailleurs, la règle de la langue (anglais : « 0 names »).
 * Les deux formes viennent des textes de l'écran :
 *
 *   {{ n }} {{ pluriel(n, $t('X.juge'), $t('X.juges')) }}
 *
 * Deux formes ne suffisent pas partout (polonais, letton) : là, le texte est
 * une fonction du nombre (app/textes/_langues).
 */
export const pluriel = (n: number | null | undefined, un: string, plusieurs: string) => {
  const x = n ?? 0
  if (langue.value === 'fr') return x > 1 ? plusieurs : un
  return new Intl.PluralRules(locale.value).select(x) === 'one' ? un : plusieurs
}
