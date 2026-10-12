import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    hausse: 'en hausse',
    baisse: 'en baisse',
    stable: 'plutôt stable',
    resume: 'Naissances de {debut} à {fin} : {sens}, au plus haut en {pic}.'
  },
  en: {
    hausse: 'rising',
    baisse: 'falling',
    stable: 'fairly steady',
    resume: 'Births from {debut} to {fin}: {sens}, peaking in {pic}.'
  }
} satisfies Textes
