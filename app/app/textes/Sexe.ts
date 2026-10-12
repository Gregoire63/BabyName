import type { Textes } from '../composables/useLangue'

/** Le sexe d'un prénom (catalogue.json → `sexe`), tel que la fiche et les filtres le disent. */
export default {
  fr: { f: 'fille', m: 'garçon', fm: 'mixte' },
  en: { f: 'girl', m: 'boy', fm: 'unisex' }
} satisfies Textes
