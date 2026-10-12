/**
 * LES PRÉNOMS QUI ONT DÉJÀ ÉTÉ DES TEMPÊTES.
 *
 * Une petite icône d'orage sur la carte ; la toucher ouvre une feuille qui
 * raconte la tempête (FeuilleTempete), et la fiche du prénom le redit. Irma,
 * Hugo ou Garance ne s'entendent plus tout à fait comme avant dans certaines
 * régions : mieux vaut le savoir en choisissant qu'à la première rentrée.
 *
 * Seulement celles qui ont MARQUÉ LA FRANCE. Une icône sur un prénom sur deux
 * ne dirait plus rien, et Louis porterait un orage (une tempête de 2024, un
 * mort, que personne n'a retenue). La règle :
 *  - en métropole, les tempêtes nommées qui ont fait au moins trois morts,
 *    privé au moins 250 000 foyers d'électricité, ou inondé des communes par
 *    dizaines (catastrophe naturelle reconnue) ;
 *  - outre-mer, depuis 1980, les ouragans et cyclones qui ont fait au moins
 *    trois morts, ou des dégâts à l'échelle d'une île : des milliers de
 *    sans-abri, des centaines de maisons détruites, les récoltes ou l'eau
 *    perdues, des centaines de millions d'euros ;
 *  - ailleurs, les quatre que tout le monde a vus aux informations.
 *
 * Écartés, et pourquoi :
 *  - deux morts ou moins, sans dégâts à grande échelle : Mathis (2023), Amy
 *    (2025), Franklin (2022), Gaël (2009), Lisa (1982), Rafael (2012), et
 *    toutes celles à un mort (Louis, Amélie, Benjamin, Ciara, Carmen…) ;
 *  - un rôle seulement indirect : Leslie (crues de l'Aude, 2018), Elisa et
 *    Ivo, venues grossir des crues déjà là ;
 *  - un autre nom que le prénom : le cyclone Clotilda (La Réunion, 1987)
 *    n'est pas Clotilde ; Wasa–Arthur (Polynésie, 1991) n'a reçu « Arthur »
 *    qu'après coup ; Tomas (Futuna, 2010) n'a pas de bilan chiffré, et
 *    aurait marqué tous les Thomas ;
 *  - avant 1980 (Inez 1966, David 1979) : hors de la mémoire des parents ;
 *  - les ouragans lointains peu connus ici (Matthew, Harvey, Helene, Ian,
 *    Laura, Michael, Camille…) ;
 *  - les noms absents du catalogue, qui ne peuvent rien marquer : Xynthia,
 *    Lothar, Kyrill, Chido, Belal…
 *
 * LA CORRESPONDANCE SE FAIT À L'OREILLE. Une classe n'entend pas
 * l'orthographe (voir `fgp` dans useCatalogue) : Eléanore se dit comme la
 * tempête Eleanor, Erika comme le cyclone Erica, Ugo comme Hugo. Chaque
 * tempête marque donc tout son groupe de prononciation, et le détail dit
 * « se prononce comme » quand l'orthographe diffère. Les accents ne comptent
 * pas (Ciarán et Ciaran, Melissa et Mélissa).
 *
 * LE TEXTE de chaque tempête (date, lieu, bilan, récit) est dans
 * app/textes/utilTempetes.ts, en français et en anglais, sous `<nom><année>_…`
 * (martin1999_bilan) : `quandTempete`, `ouTempete`, `bilanTempete` et
 * `recitTempete` le donnent dans la langue affichée.
 *
 * Chiffres vérifiés début octobre 2026, `source` en lien sous chaque détail.
 * Dans le doute entre deux bilans, on donne la fourchette, ou « au moins ».
 * Le ton reste celui d'un bulletin : le bilan une fois, puis ce qui a marqué
 * (une forêt, une rosace, un record), pas le détail des victimes. `retire` :
 * le nom a été rayé des listes de l'Atlantique après elle (liste du NHC).
 */

import { aTexte, langue, t } from '~/composables/useLangue'

export type GenreTempete = 'tempête' | 'dépression' | 'tempête tropicale' | 'ouragan' | 'cyclone'

export interface Tempete {
  /** Le nom qu'elle a porté, avec ses accents (Ciarán). */
  nom: string
  genre: GenreTempete
  an: number
  /** Nom rayé des listes après elle : plus aucune tempête de l'Atlantique ne le portera. */
  retire?: boolean
  zone: 'metropole' | 'outre-mer' | 'monde'
  /** Où en lire plus : le lien sous le détail, ouvert dans un nouvel onglet. */
  source: string
}

/**
 * Pour un même nom, la plus marquante d'abord : c'est elle que la carte
 * annonce (Martin : 1999 avant 1997).
 */
export const TEMPETES: readonly Tempete[] = [
  // --- Métropole ----------------------------------------------------------
  { nom: 'Martin', genre: 'tempête', an: 1999, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAtes_de_fin_d%C3%A9cembre_1999_en_Europe' },
  { nom: 'Klaus', genre: 'tempête', an: 2009, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Klaus' },
  { nom: 'Joachim', genre: 'tempête', an: 2011, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Joachim' },
  { nom: 'Egon', genre: 'tempête', an: 2017, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Egon' },
  { nom: 'Eleanor', genre: 'tempête', an: 2018, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Saison_des_temp%C3%AAtes_hivernales_en_Europe_(2017-2018)' },
  { nom: 'Miguel', genre: 'tempête', an: 2019, zone: 'metropole',
    source: 'https://www.europe1.fr/societe/tempete-miguel-trois-marins-de-la-snsm-morts-apres-un-chavirage-au-large-des-sables-dolonne-3903358' },
  { nom: 'Gloria', genre: 'tempête', an: 2020, zone: 'metropole',
    source: 'https://en.wikipedia.org/wiki/Storm_Gloria' },
  { nom: 'Alex', genre: 'tempête', an: 2020, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Alex' },
  { nom: 'Aurore', genre: 'tempête', an: 2021, zone: 'metropole',
    source: 'https://en.wikipedia.org/wiki/Storm_Aurore' },
  { nom: 'Ciarán', genre: 'tempête', an: 2023, zone: 'metropole',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Ciar%C3%A1n' },
  { nom: 'Monica', genre: 'dépression', an: 2024, zone: 'metropole',
    source: 'https://www.franceinfo.fr/environnement/evenements-meteorologiques-extremes/inondations-et-crues/depression-monica-quel-est-le-bilan-humain-des-intemperies-qui-ont-touche-le-sud-de-la-france_6421645.html' },
  { nom: 'Caetano', genre: 'tempête', an: 2024, zone: 'metropole',
    source: 'https://www.tendanceouest.com/actualite-424095-tempete-caetano-la-normandie-est-l-une-des-regions-les-plus-touchees-selon-enedis' },
  { nom: 'Nils', genre: 'tempête', an: 2026, zone: 'metropole',
    source: 'https://euronews.com/2026/02/13/storm-nils-caused-deaths-major-flooding-and-mass-power-cuts-in-france' },

  // --- Outre-mer, depuis 1980 -----------------------------------------------
  { nom: 'Hyacinthe', genre: 'cyclone', an: 1980, zone: 'outre-mer',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Hyacinthe' },
  { nom: 'Allen', genre: 'ouragan', an: 1980, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Allen' },
  { nom: 'Reva', genre: 'cyclone', an: 1983, zone: 'outre-mer',
    source: 'https://ladepeche.pf/2022/12/27/il-y-a-40-ans-six-cyclones-devastaient-tahiti-et-les-tuamotu/' },
  { nom: 'Raja', genre: 'cyclone', an: 1986, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Raja' },
  { nom: 'Anne', genre: 'cyclone', an: 1988, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Anne' },
  { nom: 'Hugo', genre: 'ouragan', an: 1989, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Hugo' },
  { nom: 'Cindy', genre: 'tempête tropicale', an: 1993, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Tropical_Storm_Cindy_(1993)' },
  { nom: 'Iris', genre: 'tempête tropicale', an: 1995, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Hurricane_Iris_(1995)' },
  { nom: 'Luis', genre: 'ouragan', an: 1995, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Luis' },
  { nom: 'Martin', genre: 'cyclone', an: 1997, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Martin_(1997)' },
  { nom: 'Alan', genre: 'cyclone', an: 1998, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Alan' },
  { nom: 'Lenny', genre: 'ouragan', an: 1999, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Lenny' },
  { nom: 'Dina', genre: 'cyclone', an: 2002, zone: 'outre-mer',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Dina' },
  { nom: 'Erica', genre: 'cyclone', an: 2003, zone: 'outre-mer',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Erica' },
  { nom: 'Dean', genre: 'ouragan', an: 2007, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Dean' },
  { nom: 'Oli', genre: 'cyclone', an: 2010, zone: 'outre-mer',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Oli_(2010)' },
  { nom: 'Irma', genre: 'ouragan', an: 2017, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Irma' },
  { nom: 'Maria', genre: 'ouragan', an: 2017, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Maria' },
  { nom: 'Fiona', genre: 'tempête tropicale', an: 2022, zone: 'outre-mer',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Fiona' },
  { nom: 'Garance', genre: 'cyclone', an: 2025, zone: 'outre-mer',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Garance' },

  // --- Ailleurs ------------------------------------------------------------
  { nom: 'Katrina', genre: 'ouragan', an: 2005, zone: 'monde',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Katrina' },
  { nom: 'Sandy', genre: 'ouragan', an: 2012, zone: 'monde',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Sandy' },
  { nom: 'Milton', genre: 'ouragan', an: 2024, zone: 'monde',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Milton' },
  { nom: 'Melissa', genre: 'ouragan', an: 2025, zone: 'monde',
    retire: true,
    source: 'https://en.wikipedia.org/wiki/Hurricane_Melissa' }
]

/** Sans accents ni majuscules : Ciarán et Ciaran, Melissa et Mélissa. */
const cle = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const PAR_NOM = new Map<string, Tempete[]>()
for (const t of TEMPETES) {
  const k = cle(t.nom)
  const deja = PAR_NOM.get(k)
  if (deja) deja.push(t); else PAR_NOM.set(k, [t])
}

/**
 * Les tempêtes d'un groupe de prononciation, à partir de toutes ses graphies
 * (null s'il n'y en a aucune). Appelé une fois par groupe au chargement du
 * catalogue : chaque membre reçoit le même tableau.
 */
export function tempetesDuGroupe(graphies: readonly string[]): Tempete[] | null {
  const trouvees = new Set<Tempete>()
  for (const l of graphies) for (const t of PAR_NOM.get(cle(l)) ?? []) trouvees.add(t)
  if (!trouvees.size) return null
  return TEMPETES.filter(t => trouvees.has(t))
}

/** Le prénom s'écrit-il comme la tempête (aux accents près) ? */
export const memeEcriture = (prenom: string, t: Tempete) => cle(prenom) === cle(t.nom)

/** Le genre, en clé de texte (utilTempetes.un_ouragan, le_ouragan…). */
const GENRE: Record<GenreTempete, string> = {
  'tempête': 'tempete', 'dépression': 'depression', 'tempête tropicale': 'tropicale',
  'ouragan': 'ouragan', 'cyclone': 'cyclone'
}
/** « d’un ouragan » (un), « l’ouragan » (le), « de l’ouragan » (du), « Ouragan » (titre). */
const article = (x: Tempete, forme: 'un' | 'le' | 'du' | 'titre') => t(`utilTempetes.${forme}_${GENRE[x.genre]}`)

/** Le texte d'une tempête, dans la langue affichée (app/textes/utilTempetes). */
const id = (x: Tempete) => `${cle(x.nom)}${x.an}`
/** « 24 janvier 2009 » ; le mois seul quand le jour n'est pas sûr. */
export const quandTempete = (x: Tempete) => t(`utilTempetes.${id(x)}_quand`)
/** Où elle a frappé (la France d'abord). */
export const ouTempete = (x: Tempete) => t(`utilTempetes.${id(x)}_ou`)
/** Le bilan, en une phrase : ce que l'on dit en premier. */
export const bilanTempete = (x: Tempete) => t(`utilTempetes.${id(x)}_bilan`)
/** Ce qu'on en retient de plus, pour qui ouvre le détail (null s'il n'y a rien). */
export function recitTempete(x: Tempete): string | null {
  const k = `utilTempetes.${id(x)}_recit`
  return aTexte(k) ? t(k) : null
}

/**
 * Ce que dit l'icône, en une ligne (lecteur d'écran, infobulle) :
 * « Nom d'un ouragan : Irma, 2017 », « Se dit comme la tempête Eleanor,
 * 2018 », « Nom de deux tempêtes : Martin, 1999 et 1997 ».
 */
export function resumeTempetes(prenom: string, tp: readonly Tempete[]): string {
  const x = tp[0]!
  if (tp.length > 1) return t('utilTempetes.plusieurs', { n: tp.length, nom: x.nom, ans: tp.map(y => y.an) })
  return memeEcriture(prenom, x)
    ? t('utilTempetes.nomDe', { de: article(x, 'un'), nom: x.nom, an: x.an })
    : t('utilTempetes.seDit', { le: article(x, 'le'), nom: x.nom, an: x.an })
}

/** « l'ouragan Irma », « la tempête Klaus » */
export const leNom = (x: Tempete) => t('utilTempetes.leNom', { le: article(x, 'le'), nom: x.nom })

/** « Ouragan Irma » */
export const titreTempete = (x: Tempete) => `${article(x, 'titre')} ${x.nom}`

/** Le titre de la feuille : « Ouragan Irma », ou « Deux tempêtes Martin ». */
export function titreFeuille(tp: readonly Tempete[]): string {
  if (tp.length === 1) return titreTempete(tp[0]!)
  const memeNom = tp.every(x => cle(x.nom) === cle(tp[0]!.nom))
  return t('utilTempetes.titreFeuille', { n: tp.length, nom: memeNom ? tp[0]!.nom : '' })
}

/** « Eléanore se prononce comme Eleanor, le nom de la tempête. » */
export const phraseOreille = (prenom: string, x: Tempete) =>
  t('utilTempetes.oreille', { prenom, nom: x.nom, du: article(x, 'du') })

/**
 * « il y a 9 ans » : de quoi juger si on s'en souvient encore. Insécables :
 * en fin de ligne, « ans » ne part pas seul à la suivante.
 */
export function ilYA(an: number, maintenant = new Date().getFullYear()): string {
  const n = maintenant - an
  return n <= 0 ? t('utilTempetes.cetteAnnee') : n === 1 ? t('utilTempetes.anDernier') : t('utilTempetes.ilYA', { n })
}

/**
 * Le site du lien, lisible : « Wikipédia », « Wikipédia (en anglais) »,
 * « europe1.fr ». La langue de Wikipédia n'est dite que si ce n'est pas
 * celle de l'écran.
 */
export function siteSource(url: string): string {
  let hote = ''
  try { hote = new URL(url).hostname } catch { return t('utilTempetes.siteSource') }
  if (hote.endsWith('wikipedia.org')) {
    const l = hote.split('.')[0]
    if (l === langue.value) return t('utilTempetes.wikipedia')
    return t(l === 'fr' ? 'utilTempetes.wikipediaFr' : 'utilTempetes.wikipediaEn')
  }
  return hote.replace(/^www\./, '')
}
