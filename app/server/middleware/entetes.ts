import { ENTETES_COMMUNES } from '../entetes-securite'

/**
 * Les en-têtes de sécurité sur tout ce que le serveur répond.
 *
 * En production sur Vercel, le module de build (modules/entetes-cache.ts)
 * les pose déjà pour TOUTES les réponses, statiques comprises : les poser ici
 * aussi les doublerait. On ne les pose donc ici qu'ailleurs — en
 * développement (les essais les vérifient) et sur un autre hébergeur.
 */
const SUR_VERCEL = !!process.env.VERCEL

export default defineEventHandler((e) => {
  if (SUR_VERCEL && !import.meta.dev) return
  for (const [k, v] of Object.entries(ENTETES_COMMUNES)) {
    if (import.meta.dev && k === 'strict-transport-security') continue   // http en local
    // Les devtools de Nuxt s'ouvrent dans un cadre de la page elle-meme.
    setHeader(e, k, import.meta.dev && k === 'x-frame-options' ? 'SAMEORIGIN' : v)
  }
})
