import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    onglet: 'Classement',
    volets: 'Volets du classement',
    volet_communs: 'Communs',
    volet_revoir: 'À revoir',
    volet_choix: 'Mes choix',
    volet_portrait: 'Portrait',
    nbCommuns: (p) => `${p.n} prénom${Number(p.n) > 1 ? 's' : ''} en commun`,
    nbDesaccords: (p) => `${p.n} désaccord${Number(p.n) > 1 ? 's' : ''}`,
    aucunDesaccord: 'aucun désaccord',
    resumePortrait: 'ce que vos oui disent de vous',
    resumeChoix: 'tout ce que vous avez jugé'
  },
  en: {
    onglet: 'Ranking',
    volets: 'Ranking tabs',
    volet_communs: 'Shared',
    volet_revoir: 'To review',
    volet_choix: 'My picks',
    volet_portrait: 'Portrait',
    nbCommuns: (p) => `${p.n} name${p.n === 1 ? '' : 's'} in common`,
    nbDesaccords: (p) => `${p.n} disagreement${p.n === 1 ? '' : 's'}`,
    aucunDesaccord: 'no disagreements',
    resumePortrait: 'what your yeses say about you',
    resumeChoix: 'everything you’ve rated'
  }
} satisfies Textes
