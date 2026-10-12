import type { Textes } from '../composables/useLangue'

/** « qu’Alice » mais « que Paul ». */
const que = (nom: unknown) => /^[aeiouyhàâäéèêëîïôöùûü]/i.test(String(nom)) ? `qu’${nom}` : `que ${nom}`

export default {
  fr: {
    titreMoi: 'Ceux que vous n’avez pas aimés',
    titreEux: (p) => `Ceux ${que(p.nom)} n’a pas aimés`,
    titreAutres: 'Ceux que les autres n’ont pas aimés',
    aucun: 'Aucun désaccord',
    allerTrier: 'Aller trier',
    savoir: 'Savoir ce qui vous sépare sur chacun',
    prenom: 'prénom',
    prenoms: 'prénoms',
    vous: 'Vous',
    verdict0: 'Non',
    verdict1: 'Neutre',
    verdict2: 'Oui',
    avis: 'avis'
  },
  en: {
    titreMoi: 'The ones you didn’t like',
    titreEux: (p) => `The ones ${p.nom} didn’t like`,
    titreAutres: 'The ones the others didn’t like',
    aucun: 'No disagreements',
    allerTrier: 'Start swiping',
    savoir: 'Find out what divides you on each one',
    prenom: 'name',
    prenoms: 'names',
    vous: 'You',
    verdict0: 'No',
    verdict1: 'Neutral',
    verdict2: 'Yes',
    avis: 'opinion only'
  }
} satisfies Textes
