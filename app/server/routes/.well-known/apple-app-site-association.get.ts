/**
 * « Cette app est bien celle de ce site » — pour iOS.
 *
 * Avec ce fichier, DEUX adresses de babynamed.fr, touchées dans un message ou
 * un e-mail, ouvrent l'app iOS quand elle est installée (liens universels) —
 * et le navigateur sinon, où elles marchent pareil :
 *
 *  - /rejoindre/<code> : une invitation à une liste ;
 *  - /connexion/app    : le lien de connexion, quand il a été demandé DEPUIS
 *                        l'app (server/utils/liens.ts).
 *
 * Tout le reste s'ouvre dans le navigateur, app installée ou non, et c'est
 * voulu : les pages publiques, un lien de connexion demandé depuis le site, un
 * lien cadeau, le retour d'un paiement. Rien ne se vend dans l'app
 * (server/utils/vente.ts) ; qui veut débloquer une liste ou utiliser un
 * cadeau depuis son téléphone doit pouvoir arriver sur le site sans que l'app
 * lui prenne le lien des mains.
 *
 * `webcredentials` laisse la vue web de l'app se servir des passkeys du
 * domaine.
 *
 * L'identifiant (« ABCDE12345.fr.babynamed.app » : équipe Apple + identifiant
 * de l'app) se pose en variable du Worker, NUXT_APPLE_APP_ID. Sans lui : 404,
 * et tous les liens s'ouvrent dans le navigateur, comme avant.
 */
export default defineEventHandler((e) => {
  const id = String(useRuntimeConfig().appleAppId || '').trim()
  if (!/^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/.test(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  setHeader(e, 'content-type', 'application/json')
  setHeader(e, 'cache-control', 'public, max-age=3600')
  return {
    applinks: {
      details: [{
        appIDs: [id],
        components: [
          { '/': '/rejoindre/*', comment: 'une invitation à une liste' },
          { '/': '/connexion/app', comment: 'le lien de connexion demandé depuis l’app' }
        ]
      }]
    },
    webcredentials: { apps: [id] }
  }
})
