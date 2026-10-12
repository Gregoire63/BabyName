import type { Textes } from '../composables/useLangue'

const ordinalEn = (r: number) => {
  const d = r % 100
  if (d >= 11 && d <= 13) return `${r}th`
  return `${r}${['th', 'st', 'nd', 'rd'][r % 10] ?? 'th'}`
}

export default {
  fr: {
    titre: 'Dans le monde',
    source: 'Source : {titre}',
    titreSource: '{organisme} — {jeu}, {debut}-{fin}. Licence : {licence}.',
    rang: (p) => `${p.r === 1 ? '1er' : `${p.r}e`} prénom`,
    rang_f: (p) => `${p.r === 1 ? '1er' : `${p.r}e`} prénom de fille`,
    rang_m: (p) => `${p.r === 1 ? '1er' : `${p.r}e`} prénom de garçon`,
    naissances: (p) => `${p.n} bébés en 3 ans`,
    sur_bebe: '1 bébé sur {n}',
    sur_f: '1 fille sur {n}',
    sur_m: '1 garçon sur {n}',
    parAn: '{pct}/an',
    absents: 'Peu ou pas donné (sous le seuil de publication) : {liste}.',
    chargement: 'Chargement…',
    voirTout: (p) => `Voir dans les ${p.n} autres pays`
  },
  en: {
    titre: 'Around the world',
    source: 'Source: {titre}',
    titreSource: '{organisme} — {jeu}, {debut}-{fin}. Licence: {licence}.',
    rang: (p) => `${ordinalEn(Number(p.r))} most given name`,
    rang_f: (p) => `${ordinalEn(Number(p.r))} most given girls’ name`,
    rang_m: (p) => `${ordinalEn(Number(p.r))} most given boys’ name`,
    naissances: (p) => `${p.n} ${p.c === 1 ? 'baby' : 'babies'} in 3 years`,
    sur_bebe: '1 baby in {n}',
    sur_f: '1 girl in {n}',
    sur_m: '1 boy in {n}',
    parAn: '{pct}/year',
    absents: 'Rarely or never given (below the publication threshold): {liste}.',
    chargement: 'Loading…',
    voirTout: (p) => `See the ${p.n} other ${p.n === 1 ? 'country' : 'countries'}`
  }
} satisfies Textes
