import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    quasiJamais: 'quasi jamais',
    unSur: '1 sur {n}',
    sur_bebe: '1 bébé sur {n}',
    sur_fille: '1 fille sur {n}',
    sur_garcon: '1 garçon sur {n}'
  },
  en: {
    quasiJamais: 'almost never',
    unSur: '1 in {n}',
    sur_bebe: '1 baby in {n}',
    sur_fille: '1 girl in {n}',
    sur_garcon: '1 boy in {n}'
  }
} satisfies Textes
