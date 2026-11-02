import { cibleDuLien } from '../utils/stores'
import { provenanceValide } from '../utils/provenance'

/**
 * babynamed.fr/app : le lien court des réseaux (bio TikTok…). Il mène chacun
 * là où l'app s'installe — l'App Store, Google Play — ou au site sur un
 * ordinateur. Le choix, et pourquoi, est dans server/utils/stores.ts.
 *
 * `?ref=` dit d'où vient le lien (un mot : provenanceValide). Sans lui, c'est
 * la bio TikTok. Un autre réseau : babynamed.fr/app?ref=instagram.
 *
 * Chaque passage laisse une ligne dans les journaux du Worker (Workers Logs,
 * chercher « [lien] ») : la provenance et la plateforme, rien d'autre — ni
 * adresse IP, ni agent utilisateur, ni identifiant. Le site promet « sans
 * pistage » : c'est un compteur, pas un suivi.
 */
export default defineEventHandler((e) => {
  // GET, et HEAD : des robots (l'aperçu d'un lien) vérifient une adresse par HEAD.
  if (e.method !== 'GET' && e.method !== 'HEAD') {
    setResponseHeader(e, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const provenance = provenanceValide(getQuery(e).ref) ?? 'tiktok'
  const { plateforme, adresse } = cibleDuLien(getHeader(e, 'user-agent'), provenance,
    String(useRuntimeConfig().androidPaquet || 'fr.babynamed.app'))
  if (e.method === 'GET') console.log(`[lien] ${JSON.stringify({ provenance, plateforme })}`)
  // La réponse dépend de l'appareil : aucun cache ne doit la garder.
  setHeader(e, 'cache-control', 'no-store')
  setHeader(e, 'vary', 'user-agent')
  setHeader(e, 'x-robots-tag', 'noindex')
  return sendRedirect(e, adresse, 302)
})
