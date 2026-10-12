import type { Textes, Parametres } from '../composables/useLangue'

/**
 * Les traits sont écrits pour « vous ». Pour quelqu'un d'autre (PanneauPortrait),
 * on passe `qui` : en français, la phrase est reprise telle quelle, son début
 * remplacé (« Vous » → « Alice », « Vos » → « Les oui d'Alice ») ; en anglais,
 * chaque phrase a sa forme à la troisième personne.
 */
const autre = (p: Parametres, s: string) => p.qui
  ? s.replace(/^Vous /, `${p.qui} `).replace(/^Vos /, `Les oui de ${p.qui} `)
  : s
const origines = (p: Parametres, et: string) => p.o2 ? `${p.o1} ${et} ${p.o2}` : `${p.o1}`

export default {
  fr: {
    origine: (p) => autre(p, `Vos oui penchent ${p.o2 ? 'vers les origines' : "vers l'origine"} ${origines(p, 'et')}, nettement plus que ce qu'on vous a montré.`),
    court: (p) => autre(p, `Vous dites oui plus court : ${p.oui} syllabes en moyenne, contre ${p.vu} pour ce que vous avez vu.`),
    long: (p) => autre(p, `Vous dites oui plus long : ${p.oui} syllabes en moyenne, contre ${p.vu} pour ce que vous avez vu.`),
    rare: (p) => autre(p, `Vous allez vers ce qui s'entend peu (originalité ${p.oui} contre ${p.vu} en moyenne vue).`),
    courant: (p) => autre(p, `Vous allez vers ce qui se porte (originalité ${p.oui} contre ${p.vu} en moyenne vue).`),
    ancien: (p) => autre(p, `Vos oui ont eu leur heure vers ${p.an}, ${p.ampleur} avant le reste de votre liste.`),
    recent: (p) => autre(p, `Vos oui sont plus récents que le reste de votre liste : leur sommet est vers ${p.an}, ${p.ampleur} après.`),
    voyelle: (p) => autre(p, `${p.pct} % de vos oui finissent sur une voyelle : c'est une préférence d'oreille, elle ne se voit pas à l'écrit.`),
    consonne: (p) => autre(p, `Vos oui finissent sur une consonne (${p.pct} %) : des prénoms qui s'arrêtent net plutôt qu'ils ne s'ouvrent.`),
    ampleur_generation: 'une génération',
    ampleur_decennie: 'une bonne décennie',
    ampleur_annees: 'quelques années',
    axe_longueur: 'la longueur',
    axe_rarete: 'la rareté',
    axe_epoque: "l'époque",
    unite_longueur: '{n} syllabes',
    unite_rarete: "{n}/100 d'originalité",
    unite_epoque: 'un sommet vers {n}',
    divergence: 'Vous divergez surtout sur {axe} : {a} à {va}, {b} à {vb}.',
    explication: "Ce n'est peut-être pas {prenom} : c'est {axe}. {qui} garde des prénoms à {m} en moyenne, {prenom} est à {x}."
  },
  en: {
    origine: (p) => p.qui
      ? `${p.qui}’s yeses lean towards ${origines(p, 'and')} ${p.o2 ? 'origins' : 'origin'}, far more than what they were shown.`
      : `Your yeses lean towards ${origines(p, 'and')} ${p.o2 ? 'origins' : 'origin'}, far more than what you were shown.`,
    court: (p) => p.qui
      ? `${p.qui} says yes to shorter names: ${p.oui} syllables on average, against ${p.vu} for what they’ve seen.`
      : `You say yes to shorter names: ${p.oui} syllables on average, against ${p.vu} for what you’ve seen.`,
    long: (p) => p.qui
      ? `${p.qui} says yes to longer names: ${p.oui} syllables on average, against ${p.vu} for what they’ve seen.`
      : `You say yes to longer names: ${p.oui} syllables on average, against ${p.vu} for what you’ve seen.`,
    rare: (p) => `${p.qui ? `${p.qui} leans` : 'You lean'} towards names you rarely hear (originality ${p.oui} against ${p.vu} on average among those seen).`,
    courant: (p) => `${p.qui ? `${p.qui} leans` : 'You lean'} towards names that are in fashion (originality ${p.oui} against ${p.vu} on average among those seen).`,
    ancien: (p) => `${p.qui ? `${p.qui}’s` : 'Your'} yeses had their heyday around ${p.an}, ${p.ampleur} before the rest of your list.`,
    recent: (p) => `${p.qui ? `${p.qui}’s` : 'Your'} yeses are more recent than the rest of your list: they peak around ${p.an}, ${p.ampleur} later.`,
    voyelle: (p) => `${p.pct}% of ${p.qui ? `${p.qui}’s` : 'your'} yeses end in a vowel: it’s a preference of the ear, invisible on paper.`,
    consonne: (p) => `${p.qui ? `${p.qui}’s` : 'Your'} yeses end in a consonant (${p.pct}%): names that stop short rather than open out.`,
    ampleur_generation: 'a generation',
    ampleur_decennie: 'a good decade',
    ampleur_annees: 'a few years',
    axe_longueur: 'the length',
    axe_rarete: 'the rarity',
    axe_epoque: 'the era',
    unite_longueur: '{n} syllables',
    unite_rarete: '{n}/100 for originality',
    unite_epoque: 'a peak around {n}',
    divergence: 'You differ most on {axe}: {a} with {va}, {b} with {vb}.',
    explication: 'Maybe it isn’t {prenom}: it’s {axe}. {qui} keeps names with {m} on average; {prenom} has {x}.'
  }
} satisfies Textes
