/**
 * Les textes légaux : confidentialité, conditions, mentions, accessibilité.
 *
 * Dans l'app, ils s'ouvrent dans une feuille qui monte du bas
 * (FeuilleLegale, via useFeuilleLegale) : on les lit sans quitter l'écran où
 * l'on était. Ils restent aussi des pages, pour qui arrive par un lien direct
 * (un moteur, une facture, un e-mail) : leur place dans l'historique et le
 * sens du glissement en dépendent (middleware/legal.global.ts,
 * middleware/glisse.global.ts).
 *
 * Le texte de chacun vit dans components/legal/ : la page et la feuille
 * montrent le même.
 */
import { computed, ref } from 'vue'
import { t, langue, locale } from '~/composables/useLangue'

export interface DocLegal {
  chemin: string
  /** Le nom court, pour les liens du bas et les onglets de la feuille (traduit). */
  readonly court: string
  /** Le titre du texte (traduit). */
  readonly titre: string
  /** La date de la version en vigueur (VERSIONS_TEXTES), si le texte en a une. */
  version?: string
}

/**
 * Le nom et le titre sont lus à l'affichage, dans la langue du moment
 * (app/textes/pagesLegales.ts) : une constante calculée au chargement ne
 * changerait pas avec la langue.
 */
const docu = (cle: string, chemin: string, version?: string): DocLegal => ({
  chemin,
  version,
  get court() { return t(`pagesLegales.court_${cle}`) },
  get titre() { return t(`pagesLegales.titre_${cle}`) }
})

export const DOCS_LEGAUX: DocLegal[] = [
  docu('confidentialite', '/confidentialite', VERSIONS_TEXTES.confidentialite),
  docu('conditions', '/conditions', VERSIONS_TEXTES.conditions),
  docu('mentions', '/mentions-legales'),
  docu('accessibilite', '/accessibilite', VERSIONS_TEXTES.accessibilite)
]

export const PAGES_LEGALES = DOCS_LEGAUX.map(d => d.chemin)

const normaliser = (chemin: string) => chemin.replace(/\/+$/, '') || '/'

export const estPageLegale = (chemin: string) => PAGES_LEGALES.includes(normaliser(chemin))

export const docLegal = (chemin: string): DocLegal =>
  DOCS_LEGAUX.find(d => d.chemin === normaliser(chemin)) ?? DOCS_LEGAUX[0]!

/** « 27 septembre 2026 », dans la langue affichée (« En vigueur depuis le… »). */
export const dateDeVersion = (version?: string) => version
  ? new Date(`${version}T12:00:00`).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
  : ''

/**
 * LA LANGUE DES TEXTES. Le français fait seul foi : il est montré en
 * français ; dans toute autre langue, c'est la traduction anglaise
 * (components/legal/*En.vue) qui s'affiche, avec un lien vers l'original.
 * Ce choix vaut pour la page comme pour la feuille, le temps de la visite.
 */
const originalDemande = ref(false)
export const legalEnFrancais = computed(() => langue.value === 'fr' || originalDemande.value)
export function lireLegalEnFrancais(oui = true) { originalDemande.value = oui }
