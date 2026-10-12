import type { Textes } from '../composables/useLangue'

/**
 * Les tempêtes (app/utils/tempetes.ts) : les phrases de l'icône, de la
 * feuille et de la fiche, et le récit de chaque tempête. Le français est le
 * texte vérifié (voir l'en-tête d'utils/tempetes : chiffres, sources).
 */
export default {
  fr: {
    // Les genres (GenreTempete) : « d’un ouragan », « l’ouragan », « de l’ouragan », « Ouragan »
    un_tempete: 'd’une tempête', un_depression: 'd’une dépression', un_tropicale: 'd’une tempête tropicale',
    un_ouragan: 'd’un ouragan', un_cyclone: 'd’un cyclone',
    le_tempete: 'la tempête', le_depression: 'la dépression', le_tropicale: 'la tempête tropicale',
    le_ouragan: 'l’ouragan', le_cyclone: 'le cyclone',
    du_tempete: 'de la tempête', du_depression: 'de la dépression', du_tropicale: 'de la tempête tropicale',
    du_ouragan: 'de l’ouragan', du_cyclone: 'du cyclone',
    titre_tempete: 'Tempête', titre_depression: 'Dépression', titre_tropicale: 'Tempête tropicale',
    titre_ouragan: 'Ouragan', titre_cyclone: 'Cyclone',
    // Ce que dit l'icône, les titres, les phrases
    nomDe: 'Nom {de} : {nom}, {an}',
    seDit: 'Se dit comme {le} {nom}, {an}',
    plusieurs: (p) => {
      const ans = p.ans as number[]
      return `Nom de ${Number(p.n) === 2 ? 'deux' : p.n} tempêtes : ${p.nom}, ${ans.slice(0, -1).join(', ')} et ${ans[ans.length - 1]}`
    },
    leNom: '{le} {nom}',
    titreFeuille: (p) => `${Number(p.n) === 2 ? 'Deux' : p.n} tempêtes${p.nom ? ` ${p.nom}` : ''}`,
    oreille: '{prenom} se prononce comme {nom}, le nom {du}.',
    cetteAnnee: 'cette\u00a0année',
    anDernier: 'l’an\u00a0dernier',
    ilYA: 'il\u00a0y\u00a0a\u00a0{n}\u00a0ans',
    wikipedia: 'Wikipédia',
    wikipediaFr: 'Wikipédia (en français)',
    wikipediaEn: 'Wikipédia (en anglais)',
    siteSource: 'le site source',
    // Chaque tempête : quand, où, le bilan, ce qui a marqué (`<nom><année>_…`)
    // Martin, 1999
    martin1999_quand: '27 et 28 décembre 1999',
    martin1999_ou: 'moitié sud de la France',
    martin1999_bilan: 'Avec Lothar, la veille : 92 morts et 3,6 millions de foyers privés d’électricité.',
    martin1999_recit: 'Lothar avait balayé le nord ; Martin a suivi par le sud, avec des rafales à 198 km/h sur l’île d’Oléron et la mer montée de 1,5 à 2 m en Charente-Maritime.',
    // Klaus, 2009
    klaus2009_quand: '24 janvier 2009',
    klaus2009_ou: 'Sud-Ouest',
    klaus2009_bilan: '12 morts, 1,7 million de foyers privés d’électricité.',
    klaus2009_recit: '60 % de la forêt des Landes à terre, environ 1,2 milliard d’euros de dégâts.',
    // Joachim, 2011
    joachim2011_quand: '15 et 16 décembre 2011',
    joachim2011_ou: 'de la Bretagne à l’Alsace',
    joachim2011_bilan: '400 000 foyers privés d’électricité.',
    joachim2011_recit: 'De 180 à 250 millions d’euros de dégâts.',
    // Egon, 2017
    egon2017_quand: '12 et 13 janvier 2017',
    egon2017_ou: 'Normandie, Picardie, Nord',
    egon2017_bilan: '330 000 foyers privés d’électricité.',
    egon2017_recit: 'La rosace de la cathédrale de Soissons, dans l’Aisne, détruite.',
    // Eleanor, 2018
    eleanor2018_quand: '3 et 4 janvier 2018',
    eleanor2018_ou: 'Nord, Est, Alpes, Corse',
    eleanor2018_bilan: '5 morts, des crues et des avalanches dans les Alpes.',
    eleanor2018_recit: '200 000 foyers privés d’électricité.',
    // Miguel, 2019
    miguel2019_quand: '7 juin 2019',
    miguel2019_ou: 'Vendée',
    miguel2019_bilan: '4 morts aux Sables-d’Olonne.',
    miguel2019_recit: 'Parmi eux, trois sauveteurs de la SNSM partis au secours d’un pêcheur.',
    // Gloria, 2020
    gloria2020_quand: 'du 20 au 23 janvier 2020',
    gloria2020_ou: 'Pyrénées-Orientales, Aude',
    gloria2020_bilan: 'Des crues, 2 000 personnes évacuées, 163 communes reconnues en catastrophe naturelle.',
    gloria2020_recit: 'Aucun mort en France ; plusieurs en Espagne.',
    // Alex, 2020
    alex2020_quand: '2 octobre 2020',
    alex2020_ou: 'Alpes-Maritimes',
    alex2020_bilan: '11 morts et 8 disparus.',
    alex2020_recit: 'Les vallées de la Roya, de la Vésubie et de la Tinée dévastées ; 70 communes reconnues en catastrophe naturelle.',
    // Aurore, 2021
    aurore2021_quand: '20 et 21 octobre 2021',
    aurore2021_ou: 'Normandie, Bretagne, Île-de-France',
    aurore2021_bilan: '250 000 foyers privés d’électricité.',
    aurore2021_recit: 'Des rafales à 175 km/h à Fécamp.',
    // Ciarán, 2023
    ciaran2023_quand: '1er et 2 novembre 2023',
    ciaran2023_ou: 'Bretagne, Normandie',
    ciaran2023_bilan: '1,2 million de foyers privés d’électricité.',
    ciaran2023_recit: 'Vigilance rouge dans le Finistère, les Côtes-d’Armor et la Manche, des rafales à près de 200 km/h ; avec Domingos, arrivée juste après, 1,3 milliard d’euros de dégâts.',
    // Monica, 2024
    monica2024_quand: '9 et 10 mars 2024',
    monica2024_ou: 'Gard, Ardèche',
    monica2024_bilan: '6 morts dans le Gard, dans des crues éclair.',
    // Caetano, 2024
    caetano2024_quand: '21 et 22 novembre 2024',
    caetano2024_ou: 'Normandie, Nord, Île-de-France',
    caetano2024_bilan: '270 000 foyers privés d’électricité, la Normandie parmi les plus touchées.',
    // Nils, 2026
    nils2026_quand: '12 et 13 février 2026',
    nils2026_ou: 'Nouvelle-Aquitaine, Occitanie',
    nils2026_bilan: '3 morts, 900 000 foyers privés d’électricité au plus fort.',
    nils2026_recit: 'Vigilance rouge pour les crues en Gironde et en Lot-et-Garonne.',
    // Hyacinthe, 1980
    hyacinthe1980_quand: 'janvier 1980',
    hyacinthe1980_ou: 'La Réunion',
    hyacinthe1980_bilan: '25 morts, 7 000 sans-abri.',
    hyacinthe1980_recit: 'Le cyclone le plus pluvieux jamais mesuré : 6 083 mm en quinze jours au cratère Commerson, un record mondial.',
    // Allen, 1980
    allen1980_quand: '4 août 1980',
    allen1980_ou: 'Martinique, Guadeloupe',
    allen1980_bilan: '1 mort en Guadeloupe, plus de 1 000 maisons détruites ou très endommagées en Martinique.',
    allen1980_recit: 'Les vents les plus forts jamais mesurés dans l’Atlantique, 305 km/h : un record égalé seulement par Melissa, en 2025.',
    // Reva, 1983
    reva1983_quand: 'mars 1983',
    reva1983_ou: 'Tuamotu, Polynésie',
    reva1983_bilan: '3 à 5 morts, l’atoll de Mataiva détruit.',
    reva1983_recit: 'L’un des six cyclones qui ont dévasté Tahiti et les Tuamotu en une seule saison.',
    // Raja, 1986
    raja1986_quand: 'décembre 1986',
    raja1986_ou: 'Futuna',
    raja1986_bilan: '1 mort, 80 % des cultures détruites.',
    // Anne, 1988
    anne1988_quand: 'janvier 1988',
    anne1988_ou: 'Nouvelle-Calédonie',
    anne1988_bilan: '2 morts, presque toutes les cultures détruites.',
    // Hugo, 1989
    hugo1989_quand: '17 septembre 1989',
    hugo1989_ou: 'Guadeloupe',
    hugo1989_bilan: '11 morts, des dizaines de milliers de sans-abri.',
    hugo1989_recit: 'Le cyclone de référence en Guadeloupe : toute la récolte de bananes perdue, plus de 4 milliards de francs de dégâts.',
    // Cindy, 1993
    cindy1993_quand: '14 août 1993',
    cindy1993_ou: 'Martinique',
    cindy1993_bilan: '2 morts, 3 000 sans-abri.',
    cindy1993_recit: 'Pas même un ouragan, mais des pluies diluviennes : plus de 150 maisons détruites.',
    // Iris, 1995
    iris1995_quand: '26 et 27 août 1995',
    iris1995_ou: 'Martinique, Guadeloupe',
    iris1995_bilan: '3 à 5 morts, des coulées de boue en Martinique.',
    iris1995_recit: 'Le nom a été rayé des listes plus tard, après un autre ouragan Iris, en 2001.',
    // Luis, 1995
    luis1995_quand: '5 septembre 1995',
    luis1995_ou: 'Saint-Martin, Saint-Barthélemy, Guadeloupe',
    luis1995_bilan: '3 morts, la moitié des logements de Saint-Martin touchés.',
    luis1995_recit: '250 millions de francs de dégâts en Guadeloupe.',
    // Martin, 1997
    martin1997_quand: 'novembre 1997',
    martin1997_ou: 'Polynésie française',
    martin1997_bilan: 'Au moins 8 morts.',
    martin1997_recit: 'Les atolls de Motu One, Mopelia et Scilly submergés.',
    // Alan, 1998
    alan1998_quand: 'avril 1998',
    alan1998_ou: 'îles Sous-le-Vent, Polynésie',
    alan1998_bilan: 'Au moins 8 morts, 750 maisons détruites.',
    alan1998_recit: 'Selon les sources, les bilans vont jusqu’à 21 morts.',
    // Lenny, 1999
    lenny1999_quand: 'du 17 au 19 novembre 1999',
    lenny1999_ou: 'Guadeloupe, Martinique',
    lenny1999_bilan: '6 morts en Guadeloupe et en Martinique, la côte ouest de la Guadeloupe ravagée.',
    lenny1999_recit: 'Surnommé « Wrong Way Lenny » : le premier ouragan connu à traverser la mer des Caraïbes d’ouest en est.',
    // Dina, 2002
    dina2002_quand: 'janvier 2002',
    dina2002_ou: 'La Réunion',
    dina2002_bilan: 'Environ 200 millions d’euros de dégâts.',
    dina2002_recit: 'Aucun mort direct, six indirects.',
    // Erica, 2003
    erica2003_quand: 'mars 2003',
    erica2003_ou: 'Nouvelle-Calédonie',
    erica2003_bilan: '3 morts, un millier de sans-abri.',
    // Dean, 2007
    dean2007_quand: '17 août 2007',
    dean2007_ou: 'Martinique, Guadeloupe',
    dean2007_bilan: 'Toute la récolte de bananes de la Martinique perdue, 1 300 maisons détruites.',
    dean2007_recit: '250 à 400 millions d’euros de dégâts en Martinique ; aucun mort direct, trois indirects.',
    // Oli, 2010
    oli2010_quand: 'février 2010',
    oli2010_ou: 'Tubuai, Polynésie',
    oli2010_bilan: '1 mort, 400 maisons détruites.',
    // Irma, 2017
    irma2017_quand: '6 septembre 2017',
    irma2017_ou: 'Saint-Martin, Saint-Barthélemy',
    irma2017_bilan: '11 morts à Saint-Martin, 85 % des maisons touchées.',
    irma2017_recit: 'Catégorie 5, la plus forte ; environ 3 milliards d’euros de dégâts sur les deux îles.',
    // Maria, 2017
    maria2017_quand: '18 et 19 septembre 2017',
    maria2017_ou: 'Guadeloupe',
    maria2017_bilan: '2 morts et 2 disparus en Guadeloupe.',
    maria2017_recit: 'Arrivé deux semaines après Irma : la banane de Guadeloupe presque entièrement perdue, et près de 3 000 morts à Porto Rico.',
    // Fiona, 2022
    fiona2022_quand: '16 et 17 septembre 2022',
    fiona2022_ou: 'Guadeloupe',
    fiona2022_bilan: '1 mort, 40 % des habitants privés d’eau.',
    fiona2022_recit: 'Des crues soudaines ; l’état de catastrophe naturelle reconnu.',
    // Garance, 2025
    garance2025_quand: '28 février 2025',
    garance2025_ou: 'La Réunion',
    garance2025_bilan: '5 morts, environ 900 millions d’euros de dégâts.',
    garance2025_recit: 'Le cyclone le plus coûteux de l’histoire de l’île ; une alerte violette, la deuxième jamais déclenchée.',
    // Katrina, 2005
    katrina2005_quand: '29 août 2005',
    katrina2005_ou: 'Louisiane, Mississippi',
    katrina2005_bilan: 'Entre 1 400 et 1 800 morts selon les bilans.',
    katrina2005_recit: 'Les digues ont cédé : 80 % de La Nouvelle-Orléans sous l’eau.',
    // Sandy, 2012
    sandy2012_quand: 'fin octobre 2012',
    sandy2012_ou: 'Haïti, Cuba, New York',
    sandy2012_bilan: 'Plus de 200 morts.',
    sandy2012_recit: 'Surnommé « Superstorm » : le métro et les tunnels de New York inondés.',
    // Milton, 2024
    milton2024_quand: '9 octobre 2024',
    milton2024_ou: 'Floride',
    milton2024_bilan: 'Une quarantaine de morts.',
    milton2024_recit: 'Arrivé deux semaines après Helene, avec une quarantaine de tornades et des évacuations massives.',
    // Melissa, 2025
    melissa2025_quand: '28 octobre 2025',
    melissa2025_ou: 'Jamaïque, Haïti',
    melissa2025_bilan: 'Plus de 90 morts, dont 45 en Jamaïque et 43 en Haïti.',
    melissa2025_recit: 'Des vents à 305 km/h, record de l’Atlantique à égalité avec Allen (1980) ; le plus puissant jamais arrivé sur la Jamaïque.'
  },
  en: {
    un_tempete: 'a storm', un_depression: 'a depression', un_tropicale: 'a tropical storm',
    un_ouragan: 'a hurricane', un_cyclone: 'a cyclone',
    le_tempete: 'Storm', le_depression: 'Depression', le_tropicale: 'Tropical Storm',
    le_ouragan: 'Hurricane', le_cyclone: 'Cyclone',
    du_tempete: 'the storm', du_depression: 'the depression', du_tropicale: 'the tropical storm',
    du_ouragan: 'the hurricane', du_cyclone: 'the cyclone',
    titre_tempete: 'Storm', titre_depression: 'Depression', titre_tropicale: 'Tropical Storm',
    titre_ouragan: 'Hurricane', titre_cyclone: 'Cyclone',
    nomDe: 'Name of {de}: {nom}, {an}',
    seDit: 'Sounds like {le} {nom}, {an}',
    plusieurs: (p) => {
      const ans = p.ans as number[]
      return `Name of ${Number(p.n) === 2 ? 'two' : p.n} storms: ${p.nom}, ${ans.slice(0, -1).join(', ')} and ${ans[ans.length - 1]}`
    },
    leNom: '{le} {nom}',
    titreFeuille: (p) => `${Number(p.n) === 2 ? 'Two' : p.n} storms${p.nom ? ` named ${p.nom}` : ''}`,
    oreille: '{prenom} is pronounced like {nom}, the name of {du}.',
    cetteAnnee: 'this\u00a0year',
    anDernier: 'last\u00a0year',
    ilYA: '{n}\u00a0years\u00a0ago',
    wikipedia: 'Wikipedia',
    wikipediaFr: 'Wikipedia (in French)',
    wikipediaEn: 'Wikipedia (in English)',
    siteSource: 'the source site',
    // Martin, 1999
    martin1999_quand: '27–28 December 1999',
    martin1999_ou: 'southern half of France',
    martin1999_bilan: 'Together with Lothar the day before: 92 dead and 3.6 million households without power.',
    martin1999_recit: 'Lothar had swept across the north; Martin followed through the south, with gusts of 198 km/h on the Île d’Oléron and the sea rising 1.5 to 2 m in Charente-Maritime.',
    // Klaus, 2009
    klaus2009_quand: '24 January 2009',
    klaus2009_ou: 'South-West France',
    klaus2009_bilan: '12 dead, 1.7 million households without power.',
    klaus2009_recit: '60% of the Landes forest flattened, around €1.2 billion of damage.',
    // Joachim, 2011
    joachim2011_quand: '15–16 December 2011',
    joachim2011_ou: 'from Brittany to Alsace',
    joachim2011_bilan: '400,000 households without power.',
    joachim2011_recit: '€180 to €250 million of damage.',
    // Egon, 2017
    egon2017_quand: '12–13 January 2017',
    egon2017_ou: 'Normandy, Picardy, Nord',
    egon2017_bilan: '330,000 households without power.',
    egon2017_recit: 'The rose window of Soissons Cathedral, in the Aisne, destroyed.',
    // Eleanor, 2018
    eleanor2018_quand: '3–4 January 2018',
    eleanor2018_ou: 'North, East, the Alps, Corsica',
    eleanor2018_bilan: '5 dead, floods and avalanches in the Alps.',
    eleanor2018_recit: '200,000 households without power.',
    // Miguel, 2019
    miguel2019_quand: '7 June 2019',
    miguel2019_ou: 'Vendée',
    miguel2019_bilan: '4 dead at Les Sables-d’Olonne.',
    miguel2019_recit: 'Among them, three SNSM lifeboat crew who had gone to help a fisherman.',
    // Gloria, 2020
    gloria2020_quand: '20 to 23 January 2020',
    gloria2020_ou: 'Pyrénées-Orientales, Aude',
    gloria2020_bilan: 'Floods, 2,000 people evacuated, 163 municipalities declared natural disaster areas.',
    gloria2020_recit: 'No deaths in France; several in Spain.',
    // Alex, 2020
    alex2020_quand: '2 October 2020',
    alex2020_ou: 'Alpes-Maritimes',
    alex2020_bilan: '11 dead and 8 missing.',
    alex2020_recit: 'The Roya, Vésubie and Tinée valleys devastated; 70 municipalities declared natural disaster areas.',
    // Aurore, 2021
    aurore2021_quand: '20–21 October 2021',
    aurore2021_ou: 'Normandy, Brittany, Île-de-France',
    aurore2021_bilan: '250,000 households without power.',
    aurore2021_recit: 'Gusts of 175 km/h at Fécamp.',
    // Ciarán, 2023
    ciaran2023_quand: '1–2 November 2023',
    ciaran2023_ou: 'Brittany, Normandy',
    ciaran2023_bilan: '1.2 million households without power.',
    ciaran2023_recit: 'Red alert in Finistère, Côtes-d’Armor and Manche, gusts of nearly 200 km/h; with Domingos, which came just after, €1.3 billion of damage.',
    // Monica, 2024
    monica2024_quand: '9–10 March 2024',
    monica2024_ou: 'Gard, Ardèche',
    monica2024_bilan: '6 dead in the Gard, in flash floods.',
    // Caetano, 2024
    caetano2024_quand: '21–22 November 2024',
    caetano2024_ou: 'Normandy, Nord, Île-de-France',
    caetano2024_bilan: '270,000 households without power, Normandy among the worst hit.',
    // Nils, 2026
    nils2026_quand: '12–13 February 2026',
    nils2026_ou: 'Nouvelle-Aquitaine, Occitanie',
    nils2026_bilan: '3 dead, 900,000 households without power at the peak.',
    nils2026_recit: 'Red flood alert in Gironde and Lot-et-Garonne.',
    // Hyacinthe, 1980
    hyacinthe1980_quand: 'January 1980',
    hyacinthe1980_ou: 'Réunion',
    hyacinthe1980_bilan: '25 dead, 7,000 homeless.',
    hyacinthe1980_recit: 'The rainiest cyclone ever measured: 6,083 mm in fifteen days at the Commerson crater, a world record.',
    // Allen, 1980
    allen1980_quand: '4 August 1980',
    allen1980_ou: 'Martinique, Guadeloupe',
    allen1980_bilan: '1 dead in Guadeloupe, more than 1,000 homes destroyed or badly damaged in Martinique.',
    allen1980_recit: 'The strongest winds ever measured in the Atlantic, 305 km/h: a record matched only by Melissa, in 2025.',
    // Reva, 1983
    reva1983_quand: 'March 1983',
    reva1983_ou: 'Tuamotu, French Polynesia',
    reva1983_bilan: '3 to 5 dead, Mataiva atoll destroyed.',
    reva1983_recit: 'One of six cyclones that devastated Tahiti and the Tuamotu in a single season.',
    // Raja, 1986
    raja1986_quand: 'December 1986',
    raja1986_ou: 'Futuna',
    raja1986_bilan: '1 dead, 80% of crops destroyed.',
    // Anne, 1988
    anne1988_quand: 'January 1988',
    anne1988_ou: 'New Caledonia',
    anne1988_bilan: '2 dead, almost all crops destroyed.',
    // Hugo, 1989
    hugo1989_quand: '17 September 1989',
    hugo1989_ou: 'Guadeloupe',
    hugo1989_bilan: '11 dead, tens of thousands left homeless.',
    hugo1989_recit: 'The benchmark cyclone in Guadeloupe: the whole banana crop lost, more than 4 billion francs of damage.',
    // Cindy, 1993
    cindy1993_quand: '14 August 1993',
    cindy1993_ou: 'Martinique',
    cindy1993_bilan: '2 dead, 3,000 homeless.',
    cindy1993_recit: 'Not even a hurricane, but torrential rain: more than 150 homes destroyed.',
    // Iris, 1995
    iris1995_quand: '26–27 August 1995',
    iris1995_ou: 'Martinique, Guadeloupe',
    iris1995_bilan: '3 to 5 dead, mudslides in Martinique.',
    iris1995_recit: 'The name was retired later, after another Hurricane Iris, in 2001.',
    // Luis, 1995
    luis1995_quand: '5 September 1995',
    luis1995_ou: 'Saint-Martin, Saint-Barthélemy, Guadeloupe',
    luis1995_bilan: '3 dead, half the homes on Saint-Martin hit.',
    luis1995_recit: '250 million francs of damage in Guadeloupe.',
    // Martin, 1997
    martin1997_quand: 'November 1997',
    martin1997_ou: 'French Polynesia',
    martin1997_bilan: 'At least 8 dead.',
    martin1997_recit: 'The atolls of Motu One, Mopelia and Scilly submerged.',
    // Alan, 1998
    alan1998_quand: 'April 1998',
    alan1998_ou: 'Leeward Islands, French Polynesia',
    alan1998_bilan: 'At least 8 dead, 750 homes destroyed.',
    alan1998_recit: 'Depending on the source, the toll goes up to 21 dead.',
    // Lenny, 1999
    lenny1999_quand: '17 to 19 November 1999',
    lenny1999_ou: 'Guadeloupe, Martinique',
    lenny1999_bilan: '6 dead in Guadeloupe and Martinique, the west coast of Guadeloupe ravaged.',
    lenny1999_recit: 'Nicknamed “Wrong Way Lenny”: the first known hurricane to cross the Caribbean Sea from west to east.',
    // Dina, 2002
    dina2002_quand: 'January 2002',
    dina2002_ou: 'Réunion',
    dina2002_bilan: 'Around €200 million of damage.',
    dina2002_recit: 'No direct deaths, six indirect.',
    // Erica, 2003
    erica2003_quand: 'March 2003',
    erica2003_ou: 'New Caledonia',
    erica2003_bilan: '3 dead, around a thousand homeless.',
    // Dean, 2007
    dean2007_quand: '17 August 2007',
    dean2007_ou: 'Martinique, Guadeloupe',
    dean2007_bilan: 'Martinique’s whole banana crop lost, 1,300 homes destroyed.',
    dean2007_recit: '€250 to €400 million of damage in Martinique; no direct deaths, three indirect.',
    // Oli, 2010
    oli2010_quand: 'February 2010',
    oli2010_ou: 'Tubuai, French Polynesia',
    oli2010_bilan: '1 dead, 400 homes destroyed.',
    // Irma, 2017
    irma2017_quand: '6 September 2017',
    irma2017_ou: 'Saint-Martin, Saint-Barthélemy',
    irma2017_bilan: '11 dead on Saint-Martin, 85% of homes hit.',
    irma2017_recit: 'Category 5, the strongest; around €3 billion of damage on the two islands.',
    // Maria, 2017
    maria2017_quand: '18–19 September 2017',
    maria2017_ou: 'Guadeloupe',
    maria2017_bilan: '2 dead and 2 missing in Guadeloupe.',
    maria2017_recit: 'Arrived two weeks after Irma: Guadeloupe’s bananas almost entirely lost, and nearly 3,000 dead in Puerto Rico.',
    // Fiona, 2022
    fiona2022_quand: '16–17 September 2022',
    fiona2022_ou: 'Guadeloupe',
    fiona2022_bilan: '1 dead, 40% of residents without water.',
    fiona2022_recit: 'Flash floods; natural disaster status declared.',
    // Garance, 2025
    garance2025_quand: '28 February 2025',
    garance2025_ou: 'Réunion',
    garance2025_bilan: '5 dead, around €900 million of damage.',
    garance2025_recit: 'The costliest cyclone in the island’s history; a purple alert, only the second ever issued.',
    // Katrina, 2005
    katrina2005_quand: '29 August 2005',
    katrina2005_ou: 'Louisiana, Mississippi',
    katrina2005_bilan: 'Between 1,400 and 1,800 dead, depending on the count.',
    katrina2005_recit: 'The levees gave way: 80% of New Orleans under water.',
    // Sandy, 2012
    sandy2012_quand: 'late October 2012',
    sandy2012_ou: 'Haiti, Cuba, New York',
    sandy2012_bilan: 'More than 200 dead.',
    sandy2012_recit: 'Nicknamed “Superstorm”: New York’s subway and tunnels flooded.',
    // Milton, 2024
    milton2024_quand: '9 October 2024',
    milton2024_ou: 'Florida',
    milton2024_bilan: 'Around forty dead.',
    milton2024_recit: 'Arrived two weeks after Helene, with around forty tornadoes and mass evacuations.',
    // Melissa, 2025
    melissa2025_quand: '28 October 2025',
    melissa2025_ou: 'Jamaica, Haiti',
    melissa2025_bilan: 'More than 90 dead, including 45 in Jamaica and 43 in Haiti.',
    melissa2025_recit: 'Winds of 305 km/h, tying the Atlantic record with Allen (1980); the most powerful ever to hit Jamaica.'
  }
} satisfies Textes
