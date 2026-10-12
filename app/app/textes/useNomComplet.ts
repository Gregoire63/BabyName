import type { Textes } from '../composables/useLangue'

export default {
  fr: {
    hiatusCourt: 'deux voyelles se touchent',
    hiatus: '« {prenom} {nom} » : les deux voyelles se touchent, on entend une hésitation.',
    memeSonCourt: 'même son de part et d’autre, ça bute',
    memeSon: 'Le prénom finit et le nom commence par le même son : ça bute.',
    rimeCourt: 'le prénom et le nom riment',
    rime: 'Le prénom et le nom riment. Certains aiment, d\'autres l\'entendent comme une comptine.',
    tresCourtCourt: 'très court : {n} syllabes',
    tresCourt: 'Très court à dire : {n} syllabes en tout.',
    longCourt: 'long à dire : {n} syllabes',
    long: 'Long à dire : {n} syllabes en tout.',
    initialesCourt: 'initiales : {sigle}',
    initiales: 'Les initiales donnent {sigle}.',
    rienCourt: 'rien n’accroche',
    rien: 'Rien n\'accroche : {n} syllabes, l\'enchaînement est net.'
  },
  en: {
    hiatusCourt: 'two vowels run together',
    hiatus: '“{prenom} {nom}”: the two vowels run together, you hear a hesitation.',
    memeSonCourt: 'same sound on both sides, it trips',
    memeSon: 'The first name ends and the surname begins with the same sound: it trips.',
    rimeCourt: 'the first name and surname rhyme',
    rime: 'The first name and surname rhyme. Some like it, others hear a nursery rhyme.',
    tresCourtCourt: 'very short: {n} syllables',
    tresCourt: 'Very short to say: {n} syllables in all.',
    longCourt: 'long to say: {n} syllables',
    long: 'Long to say: {n} syllables in all.',
    initialesCourt: 'initials: {sigle}',
    initiales: 'The initials spell {sigle}.',
    rienCourt: 'nothing snags',
    rien: 'Nothing snags: {n} syllables, it flows cleanly.'
  }
} satisfies Textes
