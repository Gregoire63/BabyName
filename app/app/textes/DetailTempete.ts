import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    retire: 'Nom rayé des listes : plus aucune tempête de l’Atlantique ne s’appellera {nom}.',
    enSavoirPlus: 'En savoir plus sur {site}',
    nouvelOnglet: ' : {nom}, nouvel onglet'
  },
  en: {
    retire: 'Name retired: no Atlantic storm will ever be called {nom} again.',
    enSavoirPlus: 'Read more on {site}',
    nouvelOnglet: ': {nom}, new tab'
  }
} satisfies Textes
