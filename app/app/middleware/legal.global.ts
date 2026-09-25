/**
 * D'une page legale a l'autre, on REMPLACE l'entree d'historique.
 *
 * Elles se lisent en chaine : les conditions renvoient aux mentions, qui
 * renvoient a la confidentialite, et le pied de chacune mene aux trois
 * autres. Empilees, il fallait appuyer sur « Retour » une fois par page lue
 * pour retrouver l'app. Une seule entree pour toute la lecture : Retour — le
 * bouton de la page comme celui du telephone — ramene d'ou l'on venait.
 *
 * `redirectedFrom` : c'est le second passage, celui de la navigation
 * remplacee. Sans ce garde-fou, elle se redirigerait elle-meme sans fin.
 */
export default defineNuxtRouteMiddleware((vers, depuis) => {
  if (!import.meta.client || vers.redirectedFrom || vers.path === depuis.path) return
  if (estPageLegale(vers.path) && estPageLegale(depuis.path)) {
    return navigateTo(vers.fullPath, { replace: true })
  }
})
