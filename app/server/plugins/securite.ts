import { randomBytes } from 'node:crypto'
import { politiqueApp } from '../entetes-securite'

/**
 * La politique de contenu (CSP) de la coquille de l'app, avec un nonce tiré
 * au sort à chaque page servie.
 *
 * La coquille contient des scripts EN LIGNE (la configuration de Nuxt, le
 * thème posé avant l'affichage) : sans nonce, il faudrait autoriser tout
 * script en ligne — et la CSP ne protégerait plus de rien. Chaque balise
 * <script> de la page reçoit le nonce ; l'en-tête le déclare.
 *
 * Production seulement : en développement, Vite injecte ses propres scripts
 * et sa connexion de rechargement à chaud. La vérification se fait sur un
 * build de production (voir LISEZMOI, « Sécurité »).
 */
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = randomBytes(16).toString('base64')
    const marquer = (morceaux: string[]) =>
      morceaux.map(m => m.replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`))
    html.head = marquer(html.head)
    html.bodyPrepend = marquer(html.bodyPrepend)
    html.body = marquer(html.body)
    html.bodyAppend = marquer(html.bodyAppend)
    setHeader(event, 'content-security-policy', politiqueApp(nonce))
  })
  // Pas la peine d'annoncer le cadriciel à qui cherche une faille connue.
  nitroApp.hooks.hook('render:response', (reponse) => {
    if (reponse?.headers) delete (reponse.headers as Record<string, unknown>)['x-powered-by']
  })
})
