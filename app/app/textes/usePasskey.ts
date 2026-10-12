import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    dejaLa: 'Cet appareil a déjà une passkey pour ce compte.',
    domaine: 'Les passkeys ne marchent pas à cette adresse.',
    inconnue: 'Cette passkey n’est plus liée à aucun compte (elle a été retirée).',
    expire: 'Trop de temps a passé. Réessayez.',
    tropDEssais: 'Trop d’essais d’un coup. Réessayez dans quelques minutes.',
    creationRatee: 'La passkey n’a pas pu être créée. Réessayez dans un instant.',
    connexionRatee: 'La passkey n’a pas pu servir. Réessayez, ou recevez un lien par e-mail.'
  },
  en: {
    dejaLa: 'This device already has a passkey for this account.',
    domaine: 'Passkeys don’t work at this address.',
    inconnue: 'This passkey is no longer linked to any account (it was removed).',
    expire: 'Too much time has passed. Try again.',
    tropDEssais: 'Too many attempts at once. Try again in a few minutes.',
    creationRatee: 'The passkey couldn’t be created. Try again in a moment.',
    connexionRatee: 'The passkey couldn’t be used. Try again, or get a link by e-mail.'
  }
} satisfies Textes
