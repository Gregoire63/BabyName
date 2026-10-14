/**
 * La fin de l'écran de chargement (app/spa-loading-template.html).
 *
 * Nuxt retire de lui-même le conteneur du gabarit au montage ; l'écran du logo
 * en est sorti exprès, pour finir d'écrire son trait puis s'effacer en fondu.
 * On lui dit ici que l'app est prête — ou qu'elle a planté : la page d'erreur
 * doit se voir, elle aussi.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const fin = () => (window as { __amorce?: () => void }).__amorce?.()
  nuxtApp.hook('app:suspense:resolve', fin)
  nuxtApp.hook('app:error', fin)
})
