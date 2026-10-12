import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    retard: (p) => `${p.n} ${Number(p.n) > 1 ? 'votes manquent' : 'vote manque'} à ${p.qui} : la liste reste incomplète tant que ${p.qui} n’a pas rattrapé.`
  },
  en: {
    retard: (p) => `${p.qui} is ${p.n} ${p.n === 1 ? 'vote' : 'votes'} behind: the list stays incomplete until ${p.qui} catches up.`
  }
} satisfies Textes
