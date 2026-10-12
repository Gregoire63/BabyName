import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    onglet_swipe: 'Swipe',
    onglet_classement: 'Classement',
    onglet_reglages: 'La liste',
    navigation: 'Navigation dans la liste',
    accueil: 'Accueil',
    nouveaux: (p) => `${p.onglet}, ${Number(p.n) > 1 ? `${p.n} nouveaux accords` : '1 nouvel accord'}`,
    quelquun: 'Quelqu’un',
    attente: 'Paiement reçu, on débloque la liste…',
    ok: 'C’est débloqué, pour vous et pour tout le monde sur cette liste.',
    partenaire: '{qui} vient de débloquer la liste : swipes illimités pour vous aussi.',
    doublon: '{qui} avait débloqué la liste juste avant vous. Votre paiement est remboursé automatiquement, en entier (quelques jours sur votre relevé).',
    avance: '{qui} avait débloqué la liste juste avant vous. Votre achat n’est pas perdu : il débloquera une autre de vos listes.',
    lentApp: 'L’achat est passé, mais la confirmation tarde. Elle se fera d’elle-même à la prochaine ouverture de l’app : rien n’est perdu.',
    cadeau: (p) => `C’est débloqué${p.de ? `, un cadeau de ${p.de}` : ', un beau cadeau'}, pour vous et pour tout le monde sur cette liste.`,
    lent: 'Le paiement est passé, mais la confirmation tarde. Rechargez la page dans une minute ; si rien ne change, écrivez-nous, rien n’est perdu.'
  },
  en: {
    onglet_swipe: 'Swipe',
    onglet_classement: 'Ranking',
    onglet_reglages: 'The list',
    navigation: 'List navigation',
    accueil: 'Home',
    nouveaux: (p) => `${p.onglet}, ${p.n} new ${p.n === 1 ? 'match' : 'matches'}`,
    quelquun: 'Someone',
    attente: 'Payment received, unlocking the list…',
    ok: 'It’s unlocked, for you and for everyone on this list.',
    partenaire: '{qui} has just unlocked the list: unlimited swipes for you too.',
    doublon: '{qui} had unlocked the list just before you. Your payment is refunded automatically, in full (allow a few days for it to show on your statement).',
    avance: '{qui} had unlocked the list just before you. Your purchase isn’t lost: it will unlock another of your lists.',
    lentApp: 'The purchase went through, but the confirmation is taking a while. It will complete on its own the next time you open the app: nothing is lost.',
    cadeau: (p) => `It’s unlocked${p.de ? `, a gift from ${p.de}` : ', a lovely gift'}, for you and for everyone on this list.`,
    lent: 'The payment went through, but the confirmation is taking a while. Reload the page in a minute; if nothing changes, write to us. Nothing is lost.'
  }
} satisfies Textes
