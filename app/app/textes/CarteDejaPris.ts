import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titre: 'Déjà pris',
    intro: 'Celui de la cousine, du fils des amis : il sort du tri pour toute la liste.',
    puce_pris: 'déjà pris',
    puce_veto: 'veto',
    graphies: (p) => `+ ${p.n} graphie${Number(p.n) > 1 ? 's' : ''}`,
    nePasserontPlus: (p) => Number(p.n)
      ? `${p.nom} et ${Number(p.n) > 1 ? `ses ${p.n} graphies` : 'sa graphie'} ne passeront plus.`
      : `${p.nom} ne passera plus.`,
    dejaRetire: '{nom} est déjà retiré du jeu.',
    plein: 'Cette liste a déjà deux cents prénoms « déjà pris ».',
    tropDEssais: 'Beaucoup de prénoms d’un coup : réessayez dans un moment.',
    echec: 'Rien n’a pu être enregistré. Réessayez.',
    revient: '{nom} revient dans le tri.',
    ajoutAria: 'Ajouter un prénom déjà pris',
    ajoutPlaceholder: 'Ajouter un prénom : Louise, Mathéo…',
    suggestionsAria: 'Prénoms qui correspondent',
    aucunCatalogue: 'Aucun prénom du catalogue ni de la liste ne correspond.',
    avecGraphies: (p) => `Avec ${Number(p.n) > 1 ? 'ses graphies' : 'sa graphie'} :`,
    noteAria: 'Qui le porte ? (facultatif, visible de toute la liste)',
    notePlaceholder: 'Qui le porte ? (facultatif)',
    ajouter: 'Ajouter',
    prisAria: 'Prénoms déjà pris',
    vous: 'vous',
    ancienMembre: 'un ancien membre',
    confirmerAria: 'Confirmer : remettre {nom} en jeu',
    remettreAria: 'Remettre {nom} en jeu',
    confirmer: 'Confirmer',
    retirer: 'Retirer',
    aucun: 'Aucun pour l’instant.'
  },
  en: {
    titre: 'Already taken',
    intro: 'Your cousin’s, your friends’ son’s: it’s taken out of the sorting for the whole list.',
    puce_pris: 'already taken',
    puce_veto: 'veto',
    graphies: (p) => `+ ${p.n} spelling${p.n === 1 ? '' : 's'}`,
    nePasserontPlus: (p) => Number(p.n)
      ? `${p.nom} and ${p.n === 1 ? 'its other spelling' : `its ${p.n} other spellings`} won’t come up again.`
      : `${p.nom} won’t come up again.`,
    dejaRetire: '{nom} is already out of play.',
    plein: 'This list already has two hundred “already taken” names.',
    tropDEssais: 'Lots of names at once: try again in a moment.',
    echec: 'Nothing could be saved. Try again.',
    revient: '{nom} is back in the sorting.',
    ajoutAria: 'Add an already-taken name',
    ajoutPlaceholder: 'Add a name: Louise, Mathéo…',
    suggestionsAria: 'Matching names',
    aucunCatalogue: 'No name in the catalogue or the list matches.',
    avecGraphies: (p) => `With ${p.n === 1 ? 'its other spelling' : 'its other spellings'}:`,
    noteAria: 'Who has this name? (optional, visible to the whole list)',
    notePlaceholder: 'Who has this name? (optional)',
    ajouter: 'Add',
    prisAria: 'Already-taken names',
    vous: 'you',
    ancienMembre: 'a former member',
    confirmerAria: 'Confirm: put {nom} back in play',
    remettreAria: 'Put {nom} back in play',
    confirmer: 'Confirm',
    retirer: 'Remove',
    aucun: 'None yet.'
  }
} satisfies Textes
