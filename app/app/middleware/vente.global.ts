/**
 * Dans une app des stores, les pages qui vendent n'existent pas.
 *
 * /offrir (acheter un cadeau) et /offrir/merci ne s'y atteignent par aucun
 * bouton ; un lien suivi depuis un message y mènerait quand même. On ramène à
 * l'accueil — rien ne se vend dans l'app (useVente), tout se vend sur le site.
 */
export default defineNuxtRouteMiddleware((vers) => {
  if (!import.meta.client || useVente().ouverte) return
  if (vers.path === '/offrir' || vers.path.startsWith('/offrir/')) return navigateTo('/', { replace: true })
})
