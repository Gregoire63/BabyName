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
 * Chiffres vérifiés début octobre 2026, `source` en lien sous chaque détail.
 * Dans le doute entre deux bilans, on donne la fourchette, ou « au moins ».
 * Le ton reste celui d'un bulletin : le bilan une fois, puis ce qui a marqué
 * (une forêt, une rosace, un record), pas le détail des victimes. `retire` :
 * le nom a été rayé des listes de l'Atlantique après elle (liste du NHC).
 */

export type GenreTempete = 'tempête' | 'dépression' | 'tempête tropicale' | 'ouragan' | 'cyclone'

export interface Tempete {
  /** Le nom qu'elle a porté, avec ses accents (Ciarán). */
  nom: string
  genre: GenreTempete
  /** « 24 janvier 2009 » ; le mois seul quand le jour n'est pas sûr. */
  quand: string
  an: number
  /** Où elle a frappé (la France d'abord). */
  ou: string
  /** Le bilan, en une phrase : ce que l'on dit en premier. */
  bilan: string
  /** Ce qu'on en retient de plus, pour qui ouvre le détail. */
  recit?: string
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
  { nom: 'Martin', genre: 'tempête', quand: '27 et 28 décembre 1999', an: 1999, zone: 'metropole',
    ou: 'moitié sud de la France',
    bilan: 'Avec Lothar, la veille : 92 morts et 3,6 millions de foyers privés d’électricité.',
    recit: 'Lothar avait balayé le nord ; Martin a suivi par le sud, avec des rafales à 198 km/h sur l’île d’Oléron et la mer montée de 1,5 à 2 m en Charente-Maritime.',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAtes_de_fin_d%C3%A9cembre_1999_en_Europe' },
  { nom: 'Klaus', genre: 'tempête', quand: '24 janvier 2009', an: 2009, zone: 'metropole',
    ou: 'Sud-Ouest',
    bilan: '12 morts, 1,7 million de foyers privés d’électricité.',
    recit: '60 % de la forêt des Landes à terre, environ 1,2 milliard d’euros de dégâts.',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Klaus' },
  { nom: 'Joachim', genre: 'tempête', quand: '15 et 16 décembre 2011', an: 2011, zone: 'metropole',
    ou: 'de la Bretagne à l’Alsace',
    bilan: '400 000 foyers privés d’électricité.',
    recit: 'De 180 à 250 millions d’euros de dégâts.',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Joachim' },
  { nom: 'Egon', genre: 'tempête', quand: '12 et 13 janvier 2017', an: 2017, zone: 'metropole',
    ou: 'Normandie, Picardie, Nord',
    bilan: '330 000 foyers privés d’électricité.',
    recit: 'La rosace de la cathédrale de Soissons, dans l’Aisne, détruite.',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Egon' },
  { nom: 'Eleanor', genre: 'tempête', quand: '3 et 4 janvier 2018', an: 2018, zone: 'metropole',
    ou: 'Nord, Est, Alpes, Corse',
    bilan: '5 morts, des crues et des avalanches dans les Alpes.',
    recit: '200 000 foyers privés d’électricité.',
    source: 'https://fr.wikipedia.org/wiki/Saison_des_temp%C3%AAtes_hivernales_en_Europe_(2017-2018)' },
  { nom: 'Miguel', genre: 'tempête', quand: '7 juin 2019', an: 2019, zone: 'metropole',
    ou: 'Vendée',
    bilan: '4 morts aux Sables-d’Olonne.',
    recit: 'Parmi eux, trois sauveteurs de la SNSM partis au secours d’un pêcheur.',
    source: 'https://www.europe1.fr/societe/tempete-miguel-trois-marins-de-la-snsm-morts-apres-un-chavirage-au-large-des-sables-dolonne-3903358' },
  { nom: 'Gloria', genre: 'tempête', quand: 'du 20 au 23 janvier 2020', an: 2020, zone: 'metropole',
    ou: 'Pyrénées-Orientales, Aude',
    bilan: 'Des crues, 2 000 personnes évacuées, 163 communes reconnues en catastrophe naturelle.',
    recit: 'Aucun mort en France ; plusieurs en Espagne.',
    source: 'https://en.wikipedia.org/wiki/Storm_Gloria' },
  { nom: 'Alex', genre: 'tempête', quand: '2 octobre 2020', an: 2020, zone: 'metropole',
    ou: 'Alpes-Maritimes',
    bilan: '11 morts et 8 disparus.',
    recit: 'Les vallées de la Roya, de la Vésubie et de la Tinée dévastées ; 70 communes reconnues en catastrophe naturelle.',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Alex' },
  { nom: 'Aurore', genre: 'tempête', quand: '20 et 21 octobre 2021', an: 2021, zone: 'metropole',
    ou: 'Normandie, Bretagne, Île-de-France',
    bilan: '250 000 foyers privés d’électricité.',
    recit: 'Des rafales à 175 km/h à Fécamp.',
    source: 'https://en.wikipedia.org/wiki/Storm_Aurore' },
  { nom: 'Ciarán', genre: 'tempête', quand: '1er et 2 novembre 2023', an: 2023, zone: 'metropole',
    ou: 'Bretagne, Normandie',
    bilan: '1,2 million de foyers privés d’électricité.',
    recit: 'Vigilance rouge dans le Finistère, les Côtes-d’Armor et la Manche, des rafales à près de 200 km/h ; avec Domingos, arrivée juste après, 1,3 milliard d’euros de dégâts.',
    source: 'https://fr.wikipedia.org/wiki/Temp%C3%AAte_Ciar%C3%A1n' },
  { nom: 'Monica', genre: 'dépression', quand: '9 et 10 mars 2024', an: 2024, zone: 'metropole',
    ou: 'Gard, Ardèche',
    bilan: '6 morts dans le Gard, dans des crues éclair.',
    source: 'https://www.franceinfo.fr/environnement/evenements-meteorologiques-extremes/inondations-et-crues/depression-monica-quel-est-le-bilan-humain-des-intemperies-qui-ont-touche-le-sud-de-la-france_6421645.html' },
  { nom: 'Caetano', genre: 'tempête', quand: '21 et 22 novembre 2024', an: 2024, zone: 'metropole',
    ou: 'Normandie, Nord, Île-de-France',
    bilan: '270 000 foyers privés d’électricité, la Normandie parmi les plus touchées.',
    source: 'https://www.tendanceouest.com/actualite-424095-tempete-caetano-la-normandie-est-l-une-des-regions-les-plus-touchees-selon-enedis' },
  { nom: 'Nils', genre: 'tempête', quand: '12 et 13 février 2026', an: 2026, zone: 'metropole',
    ou: 'Nouvelle-Aquitaine, Occitanie',
    bilan: '3 morts, 900 000 foyers privés d’électricité au plus fort.',
    recit: 'Vigilance rouge pour les crues en Gironde et en Lot-et-Garonne.',
    source: 'https://euronews.com/2026/02/13/storm-nils-caused-deaths-major-flooding-and-mass-power-cuts-in-france' },

  // --- Outre-mer, depuis 1980 -----------------------------------------------
  { nom: 'Hyacinthe', genre: 'cyclone', quand: 'janvier 1980', an: 1980, zone: 'outre-mer',
    ou: 'La Réunion',
    bilan: '25 morts, 7 000 sans-abri.',
    recit: 'Le cyclone le plus pluvieux jamais mesuré : 6 083 mm en quinze jours au cratère Commerson, un record mondial.',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Hyacinthe' },
  { nom: 'Allen', genre: 'ouragan', quand: '4 août 1980', an: 1980, zone: 'outre-mer',
    ou: 'Martinique, Guadeloupe',
    bilan: '1 mort en Guadeloupe, plus de 1 000 maisons détruites ou très endommagées en Martinique.',
    recit: 'Les vents les plus forts jamais mesurés dans l’Atlantique, 305 km/h : un record égalé seulement par Melissa, en 2025.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Allen' },
  { nom: 'Reva', genre: 'cyclone', quand: 'mars 1983', an: 1983, zone: 'outre-mer',
    ou: 'Tuamotu, Polynésie',
    bilan: '3 à 5 morts, l’atoll de Mataiva détruit.',
    recit: 'L’un des six cyclones qui ont dévasté Tahiti et les Tuamotu en une seule saison.',
    source: 'https://ladepeche.pf/2022/12/27/il-y-a-40-ans-six-cyclones-devastaient-tahiti-et-les-tuamotu/' },
  { nom: 'Raja', genre: 'cyclone', quand: 'décembre 1986', an: 1986, zone: 'outre-mer',
    ou: 'Futuna',
    bilan: '1 mort, 80 % des cultures détruites.',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Raja' },
  { nom: 'Anne', genre: 'cyclone', quand: 'janvier 1988', an: 1988, zone: 'outre-mer',
    ou: 'Nouvelle-Calédonie',
    bilan: '2 morts, presque toutes les cultures détruites.',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Anne' },
  { nom: 'Hugo', genre: 'ouragan', quand: '17 septembre 1989', an: 1989, zone: 'outre-mer',
    ou: 'Guadeloupe',
    bilan: '11 morts, des dizaines de milliers de sans-abri.',
    recit: 'Le cyclone de référence en Guadeloupe : toute la récolte de bananes perdue, plus de 4 milliards de francs de dégâts.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Hugo' },
  { nom: 'Cindy', genre: 'tempête tropicale', quand: '14 août 1993', an: 1993, zone: 'outre-mer',
    ou: 'Martinique',
    bilan: '2 morts, 3 000 sans-abri.',
    recit: 'Pas même un ouragan, mais des pluies diluviennes : plus de 150 maisons détruites.',
    source: 'https://en.wikipedia.org/wiki/Tropical_Storm_Cindy_(1993)' },
  { nom: 'Iris', genre: 'tempête tropicale', quand: '26 et 27 août 1995', an: 1995, zone: 'outre-mer',
    ou: 'Martinique, Guadeloupe',
    bilan: '3 à 5 morts, des coulées de boue en Martinique.',
    recit: 'Le nom a été rayé des listes plus tard, après un autre ouragan Iris, en 2001.',
    source: 'https://en.wikipedia.org/wiki/Hurricane_Iris_(1995)' },
  { nom: 'Luis', genre: 'ouragan', quand: '5 septembre 1995', an: 1995, zone: 'outre-mer',
    ou: 'Saint-Martin, Saint-Barthélemy, Guadeloupe',
    bilan: '3 morts, la moitié des logements de Saint-Martin touchés.',
    recit: '250 millions de francs de dégâts en Guadeloupe.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Luis' },
  { nom: 'Martin', genre: 'cyclone', quand: 'novembre 1997', an: 1997, zone: 'outre-mer',
    ou: 'Polynésie française',
    bilan: 'Au moins 8 morts.',
    recit: 'Les atolls de Motu One, Mopelia et Scilly submergés.',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Martin_(1997)' },
  { nom: 'Alan', genre: 'cyclone', quand: 'avril 1998', an: 1998, zone: 'outre-mer',
    ou: 'îles Sous-le-Vent, Polynésie',
    bilan: 'Au moins 8 morts, 750 maisons détruites.',
    recit: 'Selon les sources, les bilans vont jusqu’à 21 morts.',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Alan' },
  { nom: 'Lenny', genre: 'ouragan', quand: 'du 17 au 19 novembre 1999', an: 1999, zone: 'outre-mer',
    ou: 'Guadeloupe, Martinique',
    bilan: '6 morts en Guadeloupe et en Martinique, la côte ouest de la Guadeloupe ravagée.',
    recit: 'Surnommé « Wrong Way Lenny » : le premier ouragan connu à traverser la mer des Caraïbes d’ouest en est.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Lenny' },
  { nom: 'Dina', genre: 'cyclone', quand: 'janvier 2002', an: 2002, zone: 'outre-mer',
    ou: 'La Réunion',
    bilan: 'Environ 200 millions d’euros de dégâts.',
    recit: 'Aucun mort direct, six indirects.',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Dina' },
  { nom: 'Erica', genre: 'cyclone', quand: 'mars 2003', an: 2003, zone: 'outre-mer',
    ou: 'Nouvelle-Calédonie',
    bilan: '3 morts, un millier de sans-abri.',
    source: 'https://en.wikipedia.org/wiki/Cyclone_Erica' },
  { nom: 'Dean', genre: 'ouragan', quand: '17 août 2007', an: 2007, zone: 'outre-mer',
    ou: 'Martinique, Guadeloupe',
    bilan: 'Toute la récolte de bananes de la Martinique perdue, 1 300 maisons détruites.',
    recit: '250 à 400 millions d’euros de dégâts en Martinique ; aucun mort direct, trois indirects.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Dean' },
  { nom: 'Oli', genre: 'cyclone', quand: 'février 2010', an: 2010, zone: 'outre-mer',
    ou: 'Tubuai, Polynésie',
    bilan: '1 mort, 400 maisons détruites.',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Oli_(2010)' },
  { nom: 'Irma', genre: 'ouragan', quand: '6 septembre 2017', an: 2017, zone: 'outre-mer',
    ou: 'Saint-Martin, Saint-Barthélemy',
    bilan: '11 morts à Saint-Martin, 85 % des maisons touchées.',
    recit: 'Catégorie 5, la plus forte ; environ 3 milliards d’euros de dégâts sur les deux îles.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Irma' },
  { nom: 'Maria', genre: 'ouragan', quand: '18 et 19 septembre 2017', an: 2017, zone: 'outre-mer',
    ou: 'Guadeloupe',
    bilan: '2 morts et 2 disparus en Guadeloupe.',
    recit: 'Arrivé deux semaines après Irma : la banane de Guadeloupe presque entièrement perdue, et près de 3 000 morts à Porto Rico.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Maria' },
  { nom: 'Fiona', genre: 'tempête tropicale', quand: '16 et 17 septembre 2022', an: 2022, zone: 'outre-mer',
    ou: 'Guadeloupe',
    bilan: '1 mort, 40 % des habitants privés d’eau.',
    recit: 'Des crues soudaines ; l’état de catastrophe naturelle reconnu.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Fiona' },
  { nom: 'Garance', genre: 'cyclone', quand: '28 février 2025', an: 2025, zone: 'outre-mer',
    ou: 'La Réunion',
    bilan: '5 morts, environ 900 millions d’euros de dégâts.',
    recit: 'Le cyclone le plus coûteux de l’histoire de l’île ; une alerte violette, la deuxième jamais déclenchée.',
    source: 'https://fr.wikipedia.org/wiki/Cyclone_Garance' },

  // --- Ailleurs ------------------------------------------------------------
  { nom: 'Katrina', genre: 'ouragan', quand: '29 août 2005', an: 2005, zone: 'monde',
    ou: 'Louisiane, Mississippi',
    bilan: 'Entre 1 400 et 1 800 morts selon les bilans.',
    recit: 'Les digues ont cédé : 80 % de La Nouvelle-Orléans sous l’eau.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Katrina' },
  { nom: 'Sandy', genre: 'ouragan', quand: 'fin octobre 2012', an: 2012, zone: 'monde',
    ou: 'Haïti, Cuba, New York',
    bilan: 'Plus de 200 morts.',
    recit: 'Surnommé « Superstorm » : le métro et les tunnels de New York inondés.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Sandy' },
  { nom: 'Milton', genre: 'ouragan', quand: '9 octobre 2024', an: 2024, zone: 'monde',
    ou: 'Floride',
    bilan: 'Une quarantaine de morts.',
    recit: 'Arrivé deux semaines après Helene, avec une quarantaine de tornades et des évacuations massives.',
    retire: true,
    source: 'https://fr.wikipedia.org/wiki/Ouragan_Milton' },
  { nom: 'Melissa', genre: 'ouragan', quand: '28 octobre 2025', an: 2025, zone: 'monde',
    ou: 'Jamaïque, Haïti',
    bilan: 'Plus de 90 morts, dont 45 en Jamaïque et 43 en Haïti.',
    recit: 'Des vents à 305 km/h, record de l’Atlantique à égalité avec Allen (1980) ; le plus puissant jamais arrivé sur la Jamaïque.',
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

const ARTICLE: Record<GenreTempete, { de: string; le: string; du: string }> = {
  'tempête': { de: 'd’une tempête', le: 'la tempête', du: 'de la tempête' },
  'dépression': { de: 'd’une dépression', le: 'la dépression', du: 'de la dépression' },
  'tempête tropicale': { de: 'd’une tempête tropicale', le: 'la tempête tropicale', du: 'de la tempête tropicale' },
  'ouragan': { de: 'd’un ouragan', le: 'l’ouragan', du: 'de l’ouragan' },
  'cyclone': { de: 'd’un cyclone', le: 'le cyclone', du: 'du cyclone' }
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

/** « l'ouragan Irma », « la tempête Klaus » */
export const leNom = (t: Tempete) => `${ARTICLE[t.genre].le} ${t.nom}`

/** « Ouragan Irma » */
export const titreTempete = (t: Tempete) => `${t.genre[0]!.toUpperCase()}${t.genre.slice(1)} ${t.nom}`

/** Le titre de la feuille : « Ouragan Irma », ou « Deux tempêtes Martin ». */
export function titreFeuille(tp: readonly Tempete[]): string {
  if (tp.length === 1) return titreTempete(tp[0]!)
  const nombre = tp.length === 2 ? 'Deux' : String(tp.length)
  const memeNom = tp.every(t => cle(t.nom) === cle(tp[0]!.nom))
  return memeNom ? `${nombre} tempêtes ${tp[0]!.nom}` : `${nombre} tempêtes`
}

/** « Eléanore se prononce comme Eleanor, le nom de la tempête. » */
export const phraseOreille = (prenom: string, t: Tempete) =>
  `${prenom} se prononce comme ${t.nom}, le nom ${ARTICLE[t.genre].du}.`

/**
 * « il y a 9 ans » : de quoi juger si on s'en souvient encore. Insécables :
 * en fin de ligne, « ans » ne part pas seul à la suivante.
 */
export function ilYA(an: number, maintenant = new Date().getFullYear()): string {
  const n = maintenant - an
  return n <= 0 ? 'cette\u00a0année' : n === 1 ? 'l’an\u00a0dernier' : `il\u00a0y\u00a0a\u00a0${n}\u00a0ans`
}

/** Le site du lien, lisible : « Wikipédia », « Wikipédia (en anglais) », « europe1.fr ». */
export function siteSource(url: string): string {
  let hote = ''
  try { hote = new URL(url).hostname } catch { return 'le site source' }
  if (hote === 'fr.wikipedia.org') return 'Wikipédia'
  if (hote.endsWith('wikipedia.org')) return 'Wikipédia (en anglais)'
  return hote.replace(/^www\./, '')
}
