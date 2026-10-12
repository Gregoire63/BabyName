import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titre: 'Rejoindre une liste',
    aideCadeau: 'Le code d’une liste, ou un code cadeau.',
    aide: 'Le code d’une liste.',
    placeholder: 'Le code',
    ariaCadeau: 'Code d’invitation ou code cadeau',
    aria: 'Code d’invitation',
    tropDEssais: 'Trop d’essais : réessayez dans une heure, ou demandez le lien de la liste.',
    format: (p) => `Ce code n’a pas le bon format : 10 caractères (8 pour les listes plus anciennes${p.cadeau ? ', 12 pour un code cadeau' : ''}).`,
    inconnu: 'Code inconnu. Vérifiez-le, ou demandez le lien de la liste.',
    unInstant: 'Un instant…',
    voirCadeau: 'Voir le cadeau',
    entrer: 'Entrer'
  },
  en: {
    titre: 'Join a list',
    aideCadeau: 'A list’s code, or a gift code.',
    aide: 'A list’s code.',
    placeholder: 'The code',
    ariaCadeau: 'Invitation code or gift code',
    aria: 'Invitation code',
    tropDEssais: 'Too many attempts: try again in an hour, or ask for the list’s link.',
    format: (p) => `This code isn’t in the right format: 10 characters (8 for older lists${p.cadeau ? ', 12 for a gift code' : ''}).`,
    inconnu: 'Unknown code. Check it, or ask for the list’s link.',
    unInstant: 'One moment…',
    voirCadeau: 'See the gift',
    entrer: 'Join'
  }
} satisfies Textes
