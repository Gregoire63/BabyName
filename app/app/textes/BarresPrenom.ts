import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    resume: 'Naissances par an de {debut} à {fin}, arrondies à 5 par l’Insee : au plus {max}, et {dernier} en {fin}.',
    resumeDecennies: 'Naissances par décennie de {debut} à {fin}, selon l’Insee : au plus {max}, dans les années {pic}.'
  },
  en: {
    resume: 'Births per year from {debut} to {fin}, rounded to 5 by INSEE: at most {max}, and {dernier} in {fin}.',
    resumeDecennies: 'Births per decade from {debut} to {fin}, according to INSEE: at most {max}, in the {pic}s.'
  }
} satisfies Textes
