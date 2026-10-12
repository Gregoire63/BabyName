import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titre: 'Chercher un prénom',
    champ: 'Chercher un prénom dans le catalogue',
    aide: 'Tout le catalogue, sans vos filtres.',
    aucun: 'Aucun prénom ne correspond.',
    resultats: 'Résultats',
    choisir: (p) => `${p.nom}${p.rare ? ', rare' : ''} : mettre en première carte${p.etat ? ` (déjà jugé : ${p.etat})` : ''}`,
    naissances: '{n} naissances en trois ans',
    rare: 'rare',
    dejaPris: 'Déjà pris',
    veto: 'Veto',
    vote0: 'Non',
    vote1: 'Neutre',
    vote2: 'Oui'
  },
  en: {
    titre: 'Search for a name',
    champ: 'Search for a name in the catalogue',
    aide: 'The whole catalogue, without your filters.',
    aucun: 'No name matches.',
    resultats: 'Results',
    choisir: (p) => `${p.nom}${p.rare ? ', rare' : ''}: put as first card${p.etat ? ` (already judged: ${p.etat})` : ''}`,
    naissances: '{n} births in three years',
    rare: 'rare',
    dejaPris: 'Already taken',
    veto: 'Veto',
    vote0: 'No',
    vote1: 'Neutral',
    vote2: 'Yes'
  }
} satisfies Textes
