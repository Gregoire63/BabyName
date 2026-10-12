import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titreIntrouvable: 'Page introuvable',
    titreErreur: 'Une erreur est survenue',
    oups: 'Oups',
    h1Introuvable: 'Cette page n’existe pas',
    texteIntrouvable: 'L’adresse est peut-être mal recopiée, ou la page a changé de place.',
    texteErreur: 'Ce n’est pas vous. Réessayez dans un instant ; si ça recommence, écrivez-nous à',
    point: '.',
    parcourir: 'Parcourir les prénoms',
    revenir: 'Revenir à l’accueil',
    ouvrir: 'Ouvrir l’app'
  },
  en: {
    titreIntrouvable: 'Page not found',
    titreErreur: 'Something went wrong',
    oups: 'Oops',
    h1Introuvable: 'This page doesn’t exist',
    texteIntrouvable: 'The address may have been mistyped, or the page has moved.',
    texteErreur: 'It’s not you. Try again in a moment; if it keeps happening, write to us at',
    point: '.',
    parcourir: 'Browse names',
    revenir: 'Back to home',
    ouvrir: 'Open the app'
  }
} satisfies Textes
