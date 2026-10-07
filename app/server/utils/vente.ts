import type { H3Event } from 'h3'

/**
 * Dans une app des stores, la caisse du SITE est fermée — le serveur le
 * tient aussi.
 *
 * L'app iOS et l'app Android affichent ce site (shared/utils/coquille.ts).
 * Apple et Google prennent une commission sur ce qui s'y achète ET sur ce
 * vers quoi elles envoient, ventes à déclarer une par une. Stripe, les
 * cadeaux et les codes n'y existent donc pas : l'écran ne les montre pas
 * (useVente), et ici on refuse l'achat d'une liste par Stripe, l'achat d'un
 * cadeau et l'usage d'un code venus d'une app. Un bouton oublié dans un écran
 * ne vendrait rien, et un code cadeau — une clé de licence, aux yeux d'Apple —
 * ne s'y saisit pas.
 *
 * Dans l'app iOS, une liste se débloque quand même : par l'achat intégré de
 * l'App Store, et par lui seul (server/utils/apple.ts). Dans l'app Android,
 * par rien.
 *
 * Ce n'est pas une sécurité (un agent utilisateur se choisit) : c'est la
 * garantie que NOS apps ne font passer aucune vente à côté des stores, quoi
 * qu'il reste dans une page. Un achat, où qu'il soit fait, débloque la liste
 * partout.
 */
export function refuserDansUneApp(e: H3Event) {
  if (coquilleDepuis(getHeader(e, 'user-agent'))) {
    throw createError({ statusCode: 403, statusMessage: 'vente_fermee_dans_l_app' })
  }
}
