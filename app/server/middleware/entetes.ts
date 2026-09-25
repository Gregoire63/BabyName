import { ENTETES_COMMUNES } from '../entetes-securite'

/**
 * Les en-têtes de sécurité sur tout ce que le SERVEUR répond : l'API et la
 * coquille de l'app. Les fichiers statiques, que Cloudflare sert sans passer
 * par ici, reçoivent les mêmes par le fichier _headers
 * (modules/entetes-cache.ts).
 */
export default defineEventHandler((e) => {
  for (const [k, v] of Object.entries(ENTETES_COMMUNES)) {
    if (import.meta.dev && k === 'strict-transport-security') continue   // http en local
    // Les devtools de Nuxt s'ouvrent dans un cadre de la page elle-meme.
    setHeader(e, k, import.meta.dev && k === 'x-frame-options' ? 'SAMEORIGIN' : v)
  }
})
