import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    autres: 'Environ {n} autres {prenom} dans sa classe.',
    probable: 'Il y aura très probablement un autre {prenom} dans sa classe.',
    chance: "Une chance sur {n} qu'il ne soit pas le seul de sa classe.",
    classeSur: 'Une classe sur {n} en compte deux. La sienne, probablement pas.',
    seul: 'Il sera le seul de son école, et sans doute de sa ville.',
    monte: 'il monte encore (+{n} %/an)',
    recule: 'il recule ({n} %/an)',
    graphies: (p) => `il s'écrit aussi autrement${p.noms ? ` (${p.noms})` : ''}, et la classe entend pareil`
  },
  en: {
    autres: 'About {n} other children called {prenom} in their class.',
    probable: 'There will very probably be another {prenom} in their class.',
    chance: 'A 1 in {n} chance they won’t be the only one in their class.',
    classeSur: 'One class in {n} has two. Theirs probably won’t.',
    seul: 'They’ll be the only one in their school, and probably in their town.',
    monte: 'it is still rising (+{n}%/year)',
    recule: 'it is falling ({n}%/year)',
    graphies: (p) => `it is also spelt other ways${p.noms ? ` (${p.noms})` : ''}, and the class hears the same name`
  }
} satisfies Textes
