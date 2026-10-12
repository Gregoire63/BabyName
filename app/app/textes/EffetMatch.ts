import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    titre: 'Vous êtes d’accord',
    quiUn: '{nom} aussi.',
    quiPlusieurs: '{debut} et {fin} aussi.',
    continuer: 'Continuer à trier',
    voirAccords: 'Voir nos accords',
    prevenir: 'Me prévenir du prochain accord',
    essayer: 'Essayer {prenom} avec votre nom de famille',
    commentSonne: '{prenom} avec votre nom de famille : comment ça sonne ?',
    debloquee: 'liste débloquée',
    separent: (p) => Number(p.n) > 1
      ? `${p.n} prénoms vous séparent : voir pourquoi`
      : `${p.n} prénom vous sépare : voir pourquoi`
  },
  en: {
    titre: 'It’s a match',
    quiUn: '{nom} too.',
    quiPlusieurs: '{debut} and {fin} too.',
    continuer: 'Keep sorting',
    voirAccords: 'See our matches',
    prevenir: 'Notify me of the next match',
    essayer: 'Try {prenom} with your surname',
    commentSonne: '{prenom} with your surname: how does it sound?',
    debloquee: 'unlocked list',
    separent: (p) => Number(p.n) === 1
      ? `You disagree on ${p.n} name: see why`
      : `You disagree on ${p.n} names: see why`
  }
} satisfies Textes
