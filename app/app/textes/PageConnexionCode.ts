import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titrePage: 'Votre code',
    introuvable: 'Code introuvable',
    coupee: 'L’adresse s’est coupée en route. Rouvrez l’e-mail et touchez le code, ou tapez-le dans l’app.',
    allerConnexion: 'Aller à la connexion',
    votreCode: 'Votre code',
    copierAria: 'Copier le code {code}',
    copie: 'Code copié',
    copier: 'Copier le code',
    rate: 'La copie n’a pas marché ici. Sélectionnez le code, ou tapez-le dans l’app.',
    revenir: 'Revenez dans babyNamed et collez-le.'
  },
  en: {
    titrePage: 'Your code',
    introuvable: 'Code not found',
    coupee: 'The link got cut off on the way. Reopen the e-mail and tap the code, or type it in the app.',
    allerConnexion: 'Go to log in',
    votreCode: 'Your code',
    copierAria: 'Copy the code {code}',
    copie: 'Code copied',
    copier: 'Copy the code',
    rate: 'Copying didn’t work here. Select the code, or type it in the app.',
    revenir: 'Go back to babyNamed and paste it.'
  }
} satisfies Textes
