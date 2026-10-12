import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titreOffre: 'Ce que vos oui disent de vous',
    offreDebut: 'Une époque, une longueur, des origines qui reviennent, et',
    offreFort: 'là où vous n\'êtes pas d\'accord',
    offreFin: '.',
    exemple: '« Vos oui ont eu leur heure vers 1948, une génération avant le reste de votre liste. »',
    voirOuvre: 'Voir ce que ça ouvre',
    encore: 'Encore {n} oui',
    tropTot: (p) => `Un portrait sur ${p.n} prénom${Number(p.n) > 1 ? 's' : ''} gardés ne dirait rien de vrai : il dirait ce que le hasard a laissé passer. À partir de ${p.min}, les écarts tiennent.`,
    continuer: 'Continuer à trier',
    vous: 'Vous',
    surMoi: 'Sur {oui} oui, parmi {juges} prénoms jugés.',
    rienMoi: 'Vos oui ressemblent à ce qu\'on vous a montré : pas de penchant marqué. Ce n\'est pas un défaut : ça veut dire que vos filtres font déjà le travail.',
    surAutre: 'Sur {oui} oui parmi les prénoms que vous avez jugés tous les deux.',
    rienAutre: 'Rien de marqué de son côté.',
    pasAssez: 'Pas encore assez de prénoms jugés par vous deux pour en dire quelque chose d\'honnête.',
    coince: 'Là où ça coince',
    seRegle: 'Ça ne se règle pas en votant plus : ça se règle en le sachant.'
  },
  en: {
    titreOffre: 'What your yeses say about you',
    offreDebut: 'An era, a length, origins that keep coming back, and',
    offreFort: 'where you disagree',
    offreFin: '.',
    exemple: '“Your yeses had their heyday around 1948, a generation before the rest of your list.”',
    voirOuvre: 'See what it unlocks',
    encore: (p) => `${p.n} more ${p.n === 1 ? 'yes' : 'yeses'} to go`,
    tropTot: (p) => `A portrait based on ${p.n} ${p.n === 1 ? 'name' : 'names'} kept wouldn’t say anything true: it would only say what chance let through. From ${p.min} on, the differences hold up.`,
    continuer: 'Keep swiping',
    vous: 'You',
    surMoi: 'Based on {oui} yeses, out of {juges} names judged.',
    rienMoi: 'Your yeses look like what you were shown: no marked leaning. That’s not a flaw: it means your filters are already doing the work.',
    surAutre: 'Based on {oui} yeses among the names you have both judged.',
    rienAutre: 'Nothing marked on their side.',
    pasAssez: 'Not enough names judged by both of you yet to say anything honest.',
    coince: 'Where it sticks',
    seRegle: 'Voting more won’t settle it: knowing it will.'
  }
} satisfies Textes
