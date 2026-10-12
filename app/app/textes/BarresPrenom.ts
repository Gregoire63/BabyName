import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    resume: 'Naissances par an de {debut} à {fin}, arrondies à 5 par l’Insee : au plus {max}, et {dernier} en {fin}.'
  },
  en: {
    resume: 'Births per year from {debut} to {fin}, rounded to 5 by INSEE: at most {max}, and {dernier} in {fin}.'
  }
} satisfies Textes
