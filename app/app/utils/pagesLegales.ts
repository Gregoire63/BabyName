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
export interface DocLegal {
  chemin: string
  /** Le nom court, pour les liens du bas et les onglets de la feuille. */
  court: string
  titre: string
  /** La date de la version en vigueur (VERSIONS_TEXTES), si le texte en a une. */
  version?: string
}

export const DOCS_LEGAUX: DocLegal[] = [
  { chemin: '/confidentialite', court: 'Confidentialité', titre: 'Confidentialité',
    version: VERSIONS_TEXTES.confidentialite },
  { chemin: '/conditions', court: 'Conditions', titre: 'Conditions générales d’utilisation et de vente',
    version: VERSIONS_TEXTES.conditions },
  { chemin: '/mentions-legales', court: 'Mentions légales', titre: 'Mentions légales' },
  { chemin: '/accessibilite', court: 'Accessibilité', titre: 'Déclaration d’accessibilité',
    version: VERSIONS_TEXTES.accessibilite }
]

export const PAGES_LEGALES = DOCS_LEGAUX.map(d => d.chemin)

const normaliser = (chemin: string) => chemin.replace(/\/+$/, '') || '/'

export const estPageLegale = (chemin: string) => PAGES_LEGALES.includes(normaliser(chemin))

export const docLegal = (chemin: string): DocLegal =>
  DOCS_LEGAUX.find(d => d.chemin === normaliser(chemin)) ?? DOCS_LEGAUX[0]!

/** « En vigueur depuis le 27 septembre 2026 ». */
export const dateDeVersion = (version?: string) => version
  ? new Date(`${version}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : ''
