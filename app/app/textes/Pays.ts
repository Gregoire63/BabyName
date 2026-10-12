import type { Textes } from '../composables/useLangue'

/**
 * Les pays de data/pays/index.json, dans la langue affichée (utils/nomPays) :
 * les sous-régions, que Intl ne connaît pas ; les groupes ; les notes.
 * Un pays simple (be, us…) n'est pas ici : Intl.DisplayNames le nomme.
 */
export default {
  fr: {
    'gb-eaw': 'Angleterre et pays de Galles',
    'gb-sct': 'Écosse',
    'gb-nir': 'Irlande du Nord',
    'ca-on': 'Ontario',
    'ca-bc': 'Colombie-Britannique',
    qc: 'Québec',
    groupe_francophonie: 'Francophonie',
    groupe_ameriquedunord: 'Amérique du Nord',
    groupe_europe: 'Europe',
    groupe_oceanie: 'Océanie',
    note_qc: 'filles et garçons confondus, accents ignorés',
    'note_ca-bc': 'dernières données publiées : 2021-2023',
    'note_gb-sct': 'accents non publiés',
    'note_gb-nir': 'accents non publiés',
    note_se: 'dernières données publiées : 2020-2022',
    note_no: 'liste partielle : prénoms portés par au moins 200 personnes',
    note_pl: 'premier prénom seulement',
    note_nz: 'quelques macrons perdus par la source',
    /** « en Belgique » hors français (le français garde ses prépositions, usePays.enPays). */
    dans: (p) => `en ${p.pays}`
  },
  en: {
    'gb-eaw': 'England and Wales',
    'gb-sct': 'Scotland',
    'gb-nir': 'Northern Ireland',
    'ca-on': 'Ontario',
    'ca-bc': 'British Columbia',
    qc: 'Quebec',
    groupe_francophonie: 'French-speaking',
    groupe_ameriquedunord: 'North America',
    groupe_europe: 'Europe',
    groupe_oceanie: 'Oceania',
    note_qc: 'girls and boys combined, accents ignored',
    'note_ca-bc': 'latest published data: 2021-2023',
    'note_gb-sct': 'accents not published',
    'note_gb-nir': 'accents not published',
    note_se: 'latest published data: 2020-2022',
    note_no: 'partial list: names held by at least 200 people',
    note_pl: 'first name only',
    note_nz: 'a few macrons lost by the source',
    dans: (p) => p.code === 'us' ? 'in the United States' : `in ${p.pays}`
  }
} satisfies Textes
