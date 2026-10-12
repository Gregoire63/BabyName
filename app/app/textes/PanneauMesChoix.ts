import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titre2: 'Oui', desc2: 'Ceux qui vous plaisent.',
    titre1: 'Neutre', desc1: 'Ni oui ni non : ils restent en jeu.',
    titre0: 'Non', desc0: 'Écartés. Un autre avis peut les faire revenir.',
    verdict0: 'Non', verdict1: 'Neutre', verdict2: 'Oui',
    rienIci: 'Rien ici pour l’instant.',
    dejaPris: 'déjà pris',
    voirTout: 'Voir les {n}',
    ecartesGroupe: 'Écartés en groupe (même début de prénom)',
    remettre: 'Remettre les {n}',
    favoris: 'Favoris',
    favorisAide: 'Ceux que vous marquez « Favoris » sur la carte de tri, en plus de votre vote. Vous seul les voyez.',
    aucun: 'Aucun pour l’instant.',
    retirer: 'Retirer',
    veto: 'Veto',
    reste: 'Il vous en reste {n} sur {max}.',
    graphies: (p) => `+ ${p.n} graphie${Number(p.n) > 1 ? 's' : ''}`,
    versPris: (p) => `Déjà pris dans la liste${p.n ? ` (${p.n})` : ''} : visibles de tous, sans limite`
  },
  en: {
    titre2: 'Yes', desc2: 'The ones you like.',
    titre1: 'Neutral', desc1: 'Neither yes nor no: they stay in play.',
    titre0: 'No', desc0: 'Set aside. Someone else’s opinion can bring them back.',
    verdict0: 'No', verdict1: 'Neutral', verdict2: 'Yes',
    rienIci: 'Nothing here yet.',
    dejaPris: 'already taken',
    voirTout: 'See all {n}',
    ecartesGroupe: 'Set aside together (same start of name)',
    remettre: 'Put all {n} back',
    favoris: 'Favourites',
    favorisAide: 'The ones you mark as “Favourites” on the swipe card, on top of your vote. Only you can see them.',
    aucun: 'None yet.',
    retirer: 'Remove',
    veto: 'Veto',
    reste: 'You have {n} of {max} left.',
    graphies: (p) => `+ ${p.n} ${p.n === 1 ? 'spelling' : 'spellings'}`,
    versPris: (p) => `Already taken in the list${p.n ? ` (${p.n})` : ''}: visible to everyone, no limit`
  }
} satisfies Textes
