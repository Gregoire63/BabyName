/**
 * Retirer un prénom du jeu, de deux façons (voir la migration 0002) :
 *
 *  - « déjà pris » : partagé, visible de toute la liste, sans quota — la
 *    famille, les amis, quelqu'un qu'on connaît trop ;
 *  - en secret : personne ne sait qui, ni pourquoi — compté, pour que ça
 *    reste l'exception (un ex, ce qu'on ne veut pas expliquer).
 *
 * Dans les deux cas, le prénom emporte ses graphies (même prononciation).
 */

/** Blocages secrets par personne et par liste. Posé à la création de chaque
 *  liste (la colonne nb_vetos_max en garde la valeur). */
export const BLOCAGES_SECRETS = 5

/** Graphies acceptées avec un prénom : le plus grand groupe du catalogue
 *  (Isaac) en compte 33. */
export const GRAPHIES_MAX = 40
