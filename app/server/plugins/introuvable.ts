/**
 * Une adresse qui ne correspond à aucune page doit répondre 404, pas 200.
 *
 * L'app est une coquille (ssr: false) : le serveur renvoie la même page quel
 * que soit le chemin, et c'est le routeur, dans le navigateur, qui découvre
 * qu'elle n'existe pas (il affiche alors app/error.vue). Sans ce plugin, la
 * réponse restait 200 : pour Google, une « soft 404 » ; et une fiche prénom
 * supprimée (/prenom/xxx/, que Cloudflare ne trouve pas dans les fichiers
 * statiques) passait pour une page vide mais valide.
 *
 * La liste suit app/pages/ : une page ajoutée là doit l'être ici aussi,
 * sinon elle s'affiche quand même mais répond 404 aux robots.
 * `node scripts/verifier-routes.mjs` compare les deux.
 */
export const ROUTES_APP: RegExp[] = [
  /^\/$/,
  /^\/connexion$/,
  // /connexion/app : la même page, sous l'adresse que l'app des stores ouvre
  // elle-même (alias dans pages/connexion/lien.vue).
  /^\/connexion\/(lien|app)$/,
  /^\/rejoindre\/[^/]+$/,
  /^\/offrir$/,
  /^\/offrir\/merci$/,
  /^\/(accessibilite|conditions|confidentialite|mentions-legales)$/,
  /^\/g\/[^/]+\/(accueil|classement|communs|duels|groupe|reglages|swipe|top)$/
]

export const routeConnue = (chemin: string) => {
  const c = chemin.split('?')[0]!.replace(/\/+$/, '') || '/'
  return ROUTES_APP.some(r => r.test(c))
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (reponse, { event }) => {
    if (!reponse || routeConnue(event.path || '/')) return
    reponse.statusCode = 404
    reponse.statusMessage = 'Not Found'
  })
})
