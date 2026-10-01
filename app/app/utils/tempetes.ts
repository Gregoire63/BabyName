/**
 * LES PRÉNOMS QUI ONT DÉJÀ ÉTÉ DES TEMPÊTES.
 *
 * Une petite icône d'orage sur la carte, le détail dans la fiche. Irma, Hugo
 * ou Garance ne s'entendent plus tout à fait comme avant dans certaines
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
 * tempête marque donc tout son groupe de prononciation, et la fiche dit « se
 * dit comme » quand l'orthographe diffère. Les accents ne comptent pas
 * (Ciarán et Ciaran, Melissa et Mélissa).
 *
 * Chiffres vérifiés début octobre 2026. La source principale suit chaque
 * entrée ; dans le doute entre deux bilans, on garde le plus bas, ou on dit
 * « au moins ».
 */

export type GenreTempete = 'tempête' | 'dépression' | 'tempête tropicale' | 'ouragan' | 'cyclone'

export interface Tempete {
  /** Le nom qu'elle a porté, avec ses accents (Ciarán). */
  nom: string
  genre: GenreTempete
  /** « janvier 2009 » */
  quand: string
  an: number
  /** Où elle a frappé (la France d'abord). */
  ou: string
  /** Une phrase : ce qu'elle a fait. */
  bilan: string
  zone: 'metropole' | 'outre-mer' | 'monde'
}

/**
 * Pour un même nom, la plus marquante d'abord : c'est elle que la carte
 * annonce (Martin : 1999 avant 1997).
 */
export const TEMPETES: readonly Tempete[] = [
  // --- Métropole ----------------------------------------------------------
  // meteofrance.com/actualites/tempetes-de-1999-retour-sur-un-evenement-exceptionnel
  { nom: 'Martin', genre: 'tempête', quand: 'décembre 1999', an: 1999, zone: 'metropole',
    ou: 'moitié sud de la France',
    bilan: 'Avec Lothar, la veille : 92 morts et 3,6 millions de foyers privés d’électricité.' },
  // fr.wikipedia.org/wiki/Tempête_Klaus
  { nom: 'Klaus', genre: 'tempête', quand: 'janvier 2009', an: 2009, zone: 'metropole',
    ou: 'Sud-Ouest',
    bilan: '12 morts, 1,7 million de foyers privés d’électricité, 60 % de la forêt landaise à terre.' },
  // fr.wikipedia.org/wiki/Tempête_Joachim
  { nom: 'Joachim', genre: 'tempête', quand: 'décembre 2011', an: 2011, zone: 'metropole',
    ou: 'de la Bretagne à l’Alsace',
    bilan: '400 000 foyers privés d’électricité.' },
  // fr.wikipedia.org/wiki/Tempête_Egon
  { nom: 'Egon', genre: 'tempête', quand: 'janvier 2017', an: 2017, zone: 'metropole',
    ou: 'Normandie, Picardie, Nord',
    bilan: '330 000 foyers privés d’électricité ; la rosace de la cathédrale de Soissons détruite.' },
  // franceinfo.fr (tempête Eleanor : le bilan s'alourdit à 5 morts, 3 disparus)
  { nom: 'Eleanor', genre: 'tempête', quand: 'janvier 2018', an: 2018, zone: 'metropole',
    ou: 'Nord, Est, Alpes, Corse',
    bilan: '5 morts, des crues et des avalanches dans les Alpes.' },
  // europe1.fr (trois marins de la SNSM morts au large des Sables-d'Olonne)
  { nom: 'Miguel', genre: 'tempête', quand: 'juin 2019', an: 2019, zone: 'metropole',
    ou: 'Vendée',
    bilan: '4 morts aux Sables-d’Olonne, dont trois sauveteurs de la SNSM.' },
  // france3-regions (Gloria : 163 communes d'Occitanie en catastrophe naturelle)
  { nom: 'Gloria', genre: 'tempête', quand: 'janvier 2020', an: 2020, zone: 'metropole',
    ou: 'Pyrénées-Orientales, Aude',
    bilan: 'Des crues, 2 000 personnes évacuées, 163 communes reconnues en catastrophe naturelle.' },
  // fr.wikipedia.org/wiki/Tempête_Alex
  { nom: 'Alex', genre: 'tempête', quand: 'octobre 2020', an: 2020, zone: 'metropole',
    ou: 'Alpes-Maritimes',
    bilan: '11 morts et 8 disparus ; les vallées de la Roya et de la Vésubie dévastées.' },
  // en.wikipedia.org/wiki/Storm_Aurore
  { nom: 'Aurore', genre: 'tempête', quand: 'octobre 2021', an: 2021, zone: 'metropole',
    ou: 'Normandie, Bretagne, Île-de-France',
    bilan: '250 000 foyers privés d’électricité, des rafales à 175 km/h à Fécamp.' },
  // fr.wikipedia.org/wiki/Tempête_Ciarán
  { nom: 'Ciarán', genre: 'tempête', quand: 'novembre 2023', an: 2023, zone: 'metropole',
    ou: 'Bretagne, Normandie',
    bilan: '1,2 million de foyers privés d’électricité, des rafales à près de 200 km/h.' },
  // franceinfo.fr (dépression Monica : le bilan humain des intempéries)
  { nom: 'Monica', genre: 'dépression', quand: 'mars 2024', an: 2024, zone: 'metropole',
    ou: 'Gard',
    bilan: '6 morts dans des crues éclair.' },
  // tendanceouest.com (tempête Caetano, selon Enedis)
  { nom: 'Caetano', genre: 'tempête', quand: 'novembre 2024', an: 2024, zone: 'metropole',
    ou: 'Normandie, Nord, Île-de-France',
    bilan: '270 000 foyers privés d’électricité.' },
  // euronews.com/2026/02/13/storm-nils-… ; france3-regions (un troisième mort)
  { nom: 'Nils', genre: 'tempête', quand: 'février 2026', an: 2026, zone: 'metropole',
    ou: 'Nouvelle-Aquitaine, Occitanie',
    bilan: '3 morts, 900 000 foyers privés d’électricité, des crues en Gironde et en Lot-et-Garonne.' },

  // --- Outre-mer, depuis 1980 -----------------------------------------------
  // en.wikipedia.org/wiki/Cyclone_Hyacinthe
  { nom: 'Hyacinthe', genre: 'cyclone', quand: 'janvier 1980', an: 1980, zone: 'outre-mer',
    ou: 'La Réunion',
    bilan: '25 morts, 7 000 sans-abri, des pluies record.' },
  // fr.wikipedia.org/wiki/Ouragan_Allen
  { nom: 'Allen', genre: 'ouragan', quand: 'août 1980', an: 1980, zone: 'outre-mer',
    ou: 'Martinique, Guadeloupe',
    bilan: '1 mort, plus de 1 000 maisons détruites ou très endommagées en Martinique.' },
  // ladepeche.pf (il y a 40 ans, six cyclones dévastaient Tahiti et les Tuamotu)
  { nom: 'Reva', genre: 'cyclone', quand: 'mars 1983', an: 1983, zone: 'outre-mer',
    ou: 'Polynésie française',
    bilan: '3 à 5 morts, l’atoll de Mataiva détruit.' },
  // en.wikipedia.org/wiki/Cyclone_Raja
  { nom: 'Raja', genre: 'cyclone', quand: 'décembre 1986', an: 1986, zone: 'outre-mer',
    ou: 'Futuna',
    bilan: '1 mort, 80 % des cultures détruites.' },
  // en.wikipedia.org/wiki/Cyclone_Anne
  { nom: 'Anne', genre: 'cyclone', quand: 'janvier 1988', an: 1988, zone: 'outre-mer',
    ou: 'Nouvelle-Calédonie',
    bilan: '2 morts, presque toutes les cultures détruites.' },
  // fr.wikipedia.org/wiki/Ouragan_Hugo
  { nom: 'Hugo', genre: 'ouragan', quand: 'septembre 1989', an: 1989, zone: 'outre-mer',
    ou: 'Guadeloupe',
    bilan: '11 morts, 25 000 sans-abri, toute la récolte de bananes perdue.' },
  // en.wikipedia.org/wiki/Tropical_Storm_Cindy_(1993)
  { nom: 'Cindy', genre: 'tempête tropicale', quand: 'août 1993', an: 1993, zone: 'outre-mer',
    ou: 'Martinique',
    bilan: '2 morts, 3 000 sans-abri.' },
  // en.wikipedia.org/wiki/Hurricane_Iris_(1995)
  { nom: 'Iris', genre: 'tempête tropicale', quand: 'août 1995', an: 1995, zone: 'outre-mer',
    ou: 'Martinique, Guadeloupe',
    bilan: '3 à 5 morts, des coulées de boue en Martinique.' },
  // fr.wikipedia.org/wiki/Ouragan_Luis
  { nom: 'Luis', genre: 'ouragan', quand: 'septembre 1995', an: 1995, zone: 'outre-mer',
    ou: 'Saint-Martin, Saint-Barthélemy, Guadeloupe',
    bilan: '3 morts, la moitié des logements de Saint-Martin touchés.' },
  // en.wikipedia.org/wiki/Cyclone_Martin_(1997)
  { nom: 'Martin', genre: 'cyclone', quand: 'novembre 1997', an: 1997, zone: 'outre-mer',
    ou: 'Polynésie française',
    bilan: 'Au moins 8 morts, des atolls submergés.' },
  // en.wikipedia.org/wiki/Cyclone_Alan
  { nom: 'Alan', genre: 'cyclone', quand: 'avril 1998', an: 1998, zone: 'outre-mer',
    ou: 'Polynésie française',
    bilan: 'Au moins 8 morts, 750 maisons détruites.' },
  // nhc.noaa.gov/data/tcr/AL161999_Lenny.pdf
  { nom: 'Lenny', genre: 'ouragan', quand: 'novembre 1999', an: 1999, zone: 'outre-mer',
    ou: 'Guadeloupe, Martinique',
    bilan: '6 morts, la côte ouest de la Guadeloupe ravagée.' },
  // en.wikipedia.org/wiki/Cyclone_Dina
  { nom: 'Dina', genre: 'cyclone', quand: 'janvier 2002', an: 2002, zone: 'outre-mer',
    ou: 'La Réunion',
    bilan: 'Environ 200 millions d’euros de dégâts.' },
  // en.wikipedia.org/wiki/Cyclone_Erica
  { nom: 'Erica', genre: 'cyclone', quand: 'mars 2003', an: 2003, zone: 'outre-mer',
    ou: 'Nouvelle-Calédonie',
    bilan: '3 morts, un millier de sans-abri.' },
  // nhc.noaa.gov/data/tcr/AL042007_Dean.pdf
  { nom: 'Dean', genre: 'ouragan', quand: 'août 2007', an: 2007, zone: 'outre-mer',
    ou: 'Martinique, Guadeloupe',
    bilan: 'Toute la récolte de bananes de la Martinique perdue, 1 300 maisons détruites.' },
  // fr.wikipedia.org/wiki/Cyclone_Oli_(2010)
  { nom: 'Oli', genre: 'cyclone', quand: 'février 2010', an: 2010, zone: 'outre-mer',
    ou: 'Polynésie française',
    bilan: '1 mort, 400 maisons détruites.' },
  // fr.wikipedia.org/wiki/Ouragan_Irma
  { nom: 'Irma', genre: 'ouragan', quand: 'septembre 2017', an: 2017, zone: 'outre-mer',
    ou: 'Saint-Martin, Saint-Barthélemy',
    bilan: '11 morts, 85 % des maisons de Saint-Martin touchées.' },
  // nhc.noaa.gov/data/tcr/AL152017_Maria.pdf ; fr.wikipedia.org/wiki/Ouragan_Maria
  { nom: 'Maria', genre: 'ouragan', quand: 'septembre 2017', an: 2017, zone: 'outre-mer',
    ou: 'Guadeloupe',
    bilan: '2 morts et 2 disparus en Guadeloupe ; près de 3 000 morts à Porto Rico.' },
  // fr.wikipedia.org/wiki/Ouragan_Fiona
  { nom: 'Fiona', genre: 'tempête tropicale', quand: 'septembre 2022', an: 2022, zone: 'outre-mer',
    ou: 'Guadeloupe',
    bilan: '1 mort, 40 % des habitants privés d’eau.' },
  // en.wikipedia.org/wiki/Cyclone_Garance ; ici.fr (le bilan s'alourdit à cinq morts)
  { nom: 'Garance', genre: 'cyclone', quand: 'février 2025', an: 2025, zone: 'outre-mer',
    ou: 'La Réunion',
    bilan: '5 morts, le cyclone le plus coûteux de l’histoire de l’île (environ 900 millions d’euros).' },

  // --- Ailleurs ------------------------------------------------------------
  // nhc.noaa.gov/data/tcr/AL122005_Katrina.pdf
  { nom: 'Katrina', genre: 'ouragan', quand: 'août 2005', an: 2005, zone: 'monde',
    ou: 'Louisiane',
    bilan: 'Près de 1 400 morts, 80 % de La Nouvelle-Orléans sous l’eau.' },
  // nhc.noaa.gov/data/tcr/AL182012_Sandy.pdf
  { nom: 'Sandy', genre: 'ouragan', quand: 'octobre 2012', an: 2012, zone: 'monde',
    ou: 'Haïti, Cuba, New York',
    bilan: 'Plus de 230 morts ; le métro de New York inondé.' },
  // nhc.noaa.gov/data/tcr/AL142024_Milton.pdf
  { nom: 'Milton', genre: 'ouragan', quand: 'octobre 2024', an: 2024, zone: 'monde',
    ou: 'Floride',
    bilan: '42 morts, des évacuations massives.' },
  // nhc.noaa.gov/data/tcr/AL132025_Melissa.pdf ; wmo.int (retrait du nom Melissa)
  { nom: 'Melissa', genre: 'ouragan', quand: 'octobre 2025', an: 2025, zone: 'monde',
    ou: 'Jamaïque, Haïti',
    bilan: 'Catégorie 5, 93 morts ; son nom ne sera plus jamais donné à un ouragan.' }
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

const ARTICLE: Record<GenreTempete, { de: string; le: string }> = {
  'tempête': { de: 'd’une tempête', le: 'la tempête' },
  'dépression': { de: 'd’une dépression', le: 'la dépression' },
  'tempête tropicale': { de: 'd’une tempête tropicale', le: 'la tempête tropicale' },
  'ouragan': { de: 'd’un ouragan', le: 'l’ouragan' },
  'cyclone': { de: 'd’un cyclone', le: 'le cyclone' }
}

/**
 * Ce que dit l'icône, en une ligne (lecteur d'écran, infobulle) :
 * « Nom d'un ouragan : Irma, 2017 », « Se dit comme la tempête Eleanor,
 * 2018 », « Nom de deux tempêtes : Martin, 1999 et 1997 ».
 */
export function resumeTempetes(prenom: string, tp: readonly Tempete[]): string {
  const t = tp[0]!
  if (tp.length > 1) {
    const ans = tp.map(x => x.an)
    const nombre = tp.length === 2 ? 'deux' : String(tp.length)
    return `Nom de ${nombre} tempêtes : ${t.nom}, ${ans.slice(0, -1).join(', ')} et ${ans[ans.length - 1]}`
  }
  return memeEcriture(prenom, t)
    ? `Nom ${ARTICLE[t.genre].de} : ${t.nom}, ${t.an}`
    : `Se dit comme ${ARTICLE[t.genre].le} ${t.nom}, ${t.an}`
}

/** « Ouragan Irma » */
export const titreTempete = (t: Tempete) => `${t.genre[0]!.toUpperCase()}${t.genre.slice(1)} ${t.nom}`
