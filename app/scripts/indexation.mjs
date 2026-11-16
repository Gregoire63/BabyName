/**
 * Ce que les fiches de prénoms présentent à Google (scripts/seo.mjs) : quelles
 * fiches sont indexées, et sous quel titre.
 *
 * PLAN B du 16/11/2026, branche plan-b-elagage, à fusionner si la core update
 * de novembre (10/11 → ~24/11) n'a pas relevé le domaine (point le 27/11).
 * Depuis le 19/10, babynamed.fr ne se classe plus, pas même sur sa marque :
 * tout le domaine est jugé, et ce qu'il pèse, ce sont ~7 300 fiches nées en
 * quelques semaines sur le même gabarit. Le noindex du 08/11 (section
 * anglaise, fiches sans sens) ne suffit pas s'il n'a rien changé au 27/11.
 *
 * 1. ÉLAGAGE. Une fiche reste présentée à Google si elle dit vraiment quelque
 *    chose du prénom, et si quelqu'un le cherche :
 *    - un SENS FIABLE (sens et origine connus, confiance au moins moyenne) et
 *      une DEMANDE (SEUIL_DEMANDE naissances en trois ans, ou un pic d'au
 *      moins PIC_DEMANDE pour 10 000 naissances une année depuis 1986) ;
 *    - ou un prénom CONNU, dont la courbe et les chiffres font à eux seuls
 *      une page : SEUIL_CONNU naissances en trois ans, un pic de PIC_CONNU
 *      pour 10 000, ou HISTOIRE_CONNUE naissances depuis 1900 (Josette).
 *    - ou une fiche que Google MONTRAIT avant la chute (FICHES_VUES : toutes
 *      les fiches de l'export Search Console du 16/11, 3 mois) : une page
 *      qui a fait ses preuves ne sort pas, même rare (Cathaleya, Daenerys).
 *    Les autres restent en ligne, liées, en noindex, follow, hors sitemap :
 *    les fiches qui n'ont qu'une origine et quelques naissances, les sens
 *    incertains d'un prénom rare, les prénoms donnés moins de cinq fois par
 *    an, quand Google ne les a jamais montrées. Environ 1 900 fiches sortent,
 *    dont aucune n'avait d'impression dans l'export.
 *
 * 2. TITRES. Toutes les fiches s'appelaient « X : signification, origine et
 *    popularité du prénom ». Le titre dit maintenant ce que la fiche apporte :
 *    « Alba : signification « blanche, aube », origine latine ». Jamais de
 *    sens dans un titre quand il est incertain, jamais de « signification »
 *    quand il n'y en a pas (essai-seo).
 */
export const SEUIL_DEMANDE = 15
export const PIC_DEMANDE = 1
export const SEUIL_CONNU = 150
export const PIC_CONNU = 2
export const HISTOIRE_CONNUE = 5000
export const TITRE_MAX = 65
/** Les fiches que Google montrait (scripts/donnees/fiches-vues-google.json). */
export const FICHES_VUES_FICHIER = 'scripts/donnees/fiches-vues-google.json'

/**
 * Un sens qui commence par une relation (« forme féminine de Martin : voué à
 * Mars », « diminutif de Geneviève ») se lit mal après « signifie » : il se
 * dit comme on le dirait. Un composé (« Marie : amertume ou aimée +
 * Christine : chrétienne ») réunit deux prénoms.
 */
export const RELATION = /^((?:variante|forme|diminutif|dérivé|contraction|féminin|masculin|abrégé|graphie|ancienne graphie|apocope)\b[^:]*?)(?: : (.+))?$/
export function lireSens(m) {
  if (!m) return null
  const morceaux = m.split(' + ')
  if (morceaux.length > 1 && morceaux.every(x => x.includes(' : '))) {
    return { parties: morceaux.map(x => { const i = x.indexOf(' : '); return { nom: x.slice(0, i), sens: x.slice(i + 3) } }) }
  }
  const r = m.match(RELATION)
  return r ? { relation: r[1], sens: r[2] ?? null } : { sens: m }
}

/**
 * p : { m (sens), g (origines), cf (confiance du sens : 0 basse, 1 moyenne,
 * 2 haute), n (naissances sur trois ans) } ; pic : le plus haut, pour 10 000
 * naissances, depuis 1986 ; histoire : naissances depuis 1900 (0 sans
 * histoire) ; vue : Google la montrait (FICHES_VUES_FICHIER).
 */
export function ficheIndexable(p, { pic = 0, histoire = 0, vue = false } = {}) {
  const dit = !!p.m || (p.g?.length ?? 0) > 0
  if (!dit) return false                                   // mince
  const sensFiable = !!p.m && p.g.length > 0 && p.cf >= 1
  const demande = p.n >= SEUIL_DEMANDE || pic >= PIC_DEMANDE
  const connu = p.n >= SEUIL_CONNU || pic >= PIC_CONNU || histoire >= HISTOIRE_CONNUE
  return (sensFiable && demande) || connu || vue
}

/**
 * Le titre d'une fiche française (les prénoms « d'ailleurs » gardent le leur).
 * l : le prénom ; ar : sa graphie arabe ou null ; S : le sens lu par
 * lireSens (null, { sens }, { relation, sens }, { parties }) ; cf : la
 * confiance ; origine : la première origine, accordée (« latine ») ou null.
 * Le premier essai qui tient en TITRE_MAX caractères gagne.
 */
export function titreFiche({ l, ar = null, S = null, cf = null, origine: o = null }) {
  const tete = `${l}${ar ? ` (${ar})` : ''}`
  // « Prénom moderne », pas « d'origine moderne » : ce n'est pas une origine.
  const moderne = o === 'moderne'
  const origine = moderne ? null : o
  const essais = []
  if (!S) {
    // Pas de sens : pas de « signification » dans le titre.
    if (origine) essais.push(`${tete} : prénom d’origine ${origine}, naissances et popularité`)
    if (moderne) essais.push(`${tete} : prénom moderne, naissances et popularité`)
    essais.push(`${tete} : origine et popularité du prénom`)
    return essais.find(t => t.length <= TITRE_MAX) ?? essais.at(-1)
  } else if (cf >= 1 && S.parties) {
    essais.push(`${tete} : signification de ${S.parties.map(x => x.nom).join(' et ')}`)
  } else if (cf >= 1 && S.relation) {
    if (S.sens) {
      essais.push(`${tete} : signification « ${S.sens} », ${S.relation}`)
      essais.push(`${tete} : signification « ${S.sens} »`)
    }
    essais.push(`${tete} : ${S.relation}, signification et origine`)
    essais.push(`Prénom ${tete} : ${S.relation}`)
  } else if (cf >= 1 && S.sens) {
    // Le sens entier, puis son premier morceau (« le loué, le digne de
    // louanges » → « le loué ») : un titre trop long est coupé par Google.
    const court = S.sens.split(/\s*[,;]\s*/)[0]
    for (const sens of court && court !== S.sens ? [S.sens, court] : [S.sens]) {
      if (origine) essais.push(`${tete} : signification « ${sens} », origine ${origine}`)
      essais.push(`${tete} : signification « ${sens} »`)
    }
  } else if (origine) {
    essais.push(`${tete} : signification et origine ${origine} du prénom`)
  } else if (moderne) {
    essais.push(`${tete} : prénom moderne, signification et popularité`)
  }
  essais.push(`${tete} : signification, origine et popularité du prénom`)
  return essais.find(t => t.length <= TITRE_MAX) ?? essais.at(-1)
}
