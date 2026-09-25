/** Ce que l'ecran de connexion peut proposer : le lien par e-mail n'existe
 *  que si l'envoi est configure. Aucune valeur secrete ici. */
export default defineEventHandler(() => ({ courriel: courrielPret() }))
