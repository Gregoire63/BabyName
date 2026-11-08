/**
 * Ce que scripts/seo.mjs (pages françaises) et scripts/seo-langues.mjs (pages
 * dans les autres langues) doivent voir de la même façon : les adresses des
 * pages d'accueil de l'app dans chaque langue, et la règle qui décide qu'une
 * fiche de prénom a sa version anglaise. Les liens hreflang vont par paires :
 * si les deux scripts en jugeaient différemment, une page pointerait vers une
 * traduction qui n'existe pas (Google ignore alors toute la paire).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Les pages qui présentent l'app, une par langue de l'app (useLangue.ts →
 * LANGUES). La française existe depuis le début, sous son adresse à elle ;
 * c'est aussi le x-default : l'app est française, son catalogue aussi.
 */
export const ACCUEILS = [
  { code: 'fr', chemin: '/choisir-un-prenom-a-deux/', nom: 'Français', intl: 'fr-FR' },
  { code: 'en', chemin: '/en/', nom: 'English', intl: 'en-GB' },
  { code: 'de', chemin: '/de/', nom: 'Deutsch', intl: 'de-DE' },
  { code: 'nl', chemin: '/nl/', nom: 'Nederlands', intl: 'nl-NL' },
  { code: 'sv', chemin: '/sv/', nom: 'Svenska', intl: 'sv-SE' },
  { code: 'nb', chemin: '/nb/', nom: 'Norsk', intl: 'nb-NO' },
  { code: 'pl', chemin: '/pl/', nom: 'Polski', intl: 'pl-PL' },
  { code: 'lv', chemin: '/lv/', nom: 'Latviešu', intl: 'lv-LV' }
]
export const alternatesAccueil = () => [
  ...ACCUEILS.map(a => ({ hreflang: a.code, chemin: a.chemin })),
  { hreflang: 'x-default', chemin: ACCUEILS[0].chemin }
]
/** Les <link rel="alternate">, une ligne chacun. */
export const liensAlternate = (site, alternates) => alternates
  .map(a => `<link rel="alternate" hreflang="${a.hreflang}" href="${site}${a.chemin}">`).join('\n')

/**
 * Les significations en anglais : { slug: sens }, le slug de la fiche
 * française (la graphie la plus donnée porte la page). Une fiche anglaise
 * n'existe QUE si son prénom a un sens anglais : sans lui, elle ne serait
 * qu'une page de chiffres, déjà donnée en français.
 */
export const SENS_EN_FICHIER = 'scripts/donnees/sens-en.json'
export function chargerSensEn(racine) {
  const f = resolve(racine, SENS_EN_FICHIER)
  if (!existsSync(f)) return {}
  const brut = JSON.parse(readFileSync(f, 'utf8'))
  const sens = {}
  for (const [slug, s] of Object.entries(brut)) if (typeof s === 'string' && s.trim()) sens[slug] = s.trim()
  return sens
}
/** La section anglaise ne parle que des prénoms donnés en France : pas de
 *  fiche anglaise pour un prénom « d'ailleurs » (hf), absent des naissances. */
export const aFicheEn = (tete, sensEn) => Boolean(tete && tete.slug && !tete.hf && sensEn[tete.slug])
export const EN_NOMS = '/en/french-names/'
export const cheminFicheEn = slug => `${EN_NOMS}${slug}/`

/**
 * La section anglaise des prénoms (EN_NOMS : fiches, listes, portail) est-elle
 * présentée à Google ? NON depuis le 08/11/2026.
 *
 * Le 19/10, les impressions Google sont tombées en un jour de 540-960 à une
 * quinzaine, puis à 3-7 en novembre. Sans action manuelle, pages toujours
 * indexées, le site ne sortait même plus sur sa propre marque : c'est tout le
 * domaine qui a été rétrogradé. La section anglaise (2 399 fiches mises en
 * ligne d'un coup le 12/10, traduites des fiches françaises) est le contenu le
 * plus « fait à la chaîne » du site.
 *
 * Ses pages restent en ligne et liées (noindex, follow), hors du sitemap, et
 * plus aucun hreflang entre une fiche française et sa version anglaise, des
 * deux côtés : annoncer une page en noindex est une erreur pour Google. Les
 * pages qui présentent l'app dans chaque langue (ACCUEILS) restent indexées.
 * Pour rouvrir : true, quand Google sera revenu.
 */
export const EN_INDEXEE = false
