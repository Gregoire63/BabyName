import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    legende: 'Thème de l’application',
    clair: 'Clair', clairAide: 'toujours clair',
    systeme: 'Système', systemeAide: 'comme le téléphone',
    sombre: 'Sombre', sombreAide: 'toujours sombre'
  },
  en: {
    legende: 'App theme',
    clair: 'Light', clairAide: 'always light',
    systeme: 'System', systemeAide: 'like the device',
    sombre: 'Dark', sombreAide: 'always dark'
  }
} satisfies Textes
