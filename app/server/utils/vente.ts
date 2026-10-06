import type { H3Event } from 'h3'

/**
 * Dans une app des stores, rien ne se vend — le serveur le tient aussi.
 *
 * L'app iOS et l'app Android affichent ce site (shared/utils/coquille.ts).
 * Apple et Google prennent une commission sur ce qui s'y achète ET sur ce
 * vers quoi elles envoient, ventes à déclarer une par une. On n'y vend donc
 * rien : l'écran ne montre ni offre ni code cadeau (useVente), et ici on
 * refuse l'achat d'une liste, l'achat d'un cadeau et l'usage d'un code venus
 * d'une app. Un bouton oublié dans un écran ne vendrait rien, et un code
 * cadeau — une clé de licence, aux yeux d'Apple — ne s'y saisit pas.
 *
 * Ce n'est pas une sécurité (un agent utilisateur se choisit) : c'est la
 * garantie que NOS apps ne vendent rien, quoi qu'il reste dans une page.
 * L'achat fait sur le site débloque la liste partout, app comprise.
 */
export function refuserDansUneApp(e: H3Event) {
  if (coquilleDepuis(getHeader(e, 'user-agent'))) {
    throw createError({ statusCode: 403, statusMessage: 'vente_fermee_dans_l_app' })
  }
}
