import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    court_confidentialite: 'Confidentialité',
    titre_confidentialite: 'Confidentialité',
    court_conditions: 'Conditions',
    titre_conditions: 'Conditions générales d’utilisation et de vente',
    court_mentions: 'Mentions légales',
    titre_mentions: 'Mentions légales',
    court_accessibilite: 'Accessibilité',
    titre_accessibilite: 'Déclaration d’accessibilité',
    enVigueur: 'En vigueur depuis le {date}.',
    lireTraduction: 'Lire la traduction anglaise'
  },
  en: {
    court_confidentialite: 'Privacy',
    titre_confidentialite: 'Privacy policy',
    court_conditions: 'Terms',
    titre_conditions: 'General terms and conditions of use and sale',
    court_mentions: 'Legal notice',
    titre_mentions: 'Legal notice',
    court_accessibilite: 'Accessibility',
    titre_accessibilite: 'Accessibility statement',
    enVigueur: 'In force since {date}.',
    lireTraduction: 'Read the English translation'
  }
} satisfies Textes
