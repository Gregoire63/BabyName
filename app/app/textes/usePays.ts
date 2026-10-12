import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    et: ' et ',
    vosPays: 'vos {n} pays',
    auQuebec: 'au Québec',
    auxEtatsUnis: 'aux États-Unis',
    enPays: 'en {nom}'
  },
  en: {
    et: ' and ',
    vosPays: 'your {n} countries',
    auQuebec: 'in Quebec',
    auxEtatsUnis: 'in the United States',
    enPays: 'in {nom}'
  }
} satisfies Textes
