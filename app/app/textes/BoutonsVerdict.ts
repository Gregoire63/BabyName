import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    non: 'Non', neutre: 'Neutre', oui: 'Oui',
    nonA: 'Non à {nom}', neutrePour: 'Neutre pour {nom}', ouiA: 'Oui à {nom}'
  },
  en: {
    non: 'No', neutre: 'Neutral', oui: 'Yes',
    nonA: 'No to {nom}', neutrePour: 'Neutral on {nom}', ouiA: 'Yes to {nom}'
  }
} satisfies Textes
