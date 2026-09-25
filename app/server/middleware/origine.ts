/**
 * Une requête qui MODIFIE quelque chose doit venir de l'app elle-même.
 *
 * Le cookie de session est en SameSite=Lax : un autre site ne peut pas le
 * faire partir avec un POST — c'est la première défense contre la
 * falsification de requête (CSRF). Celle-ci est la seconde, pour le jour où
 * un navigateur, une extension ou un sous-domaine ferait défaut à la
 * première : le navigateur dit d'où vient la requête (Sec-Fetch-Site,
 * Origin), et on refuse ce qui vient d'ailleurs.
 *
 * Laissés passer : les appels sans ces en-têtes (Stripe, les outils en ligne
 * de commande — qui n'ont pas de cookie de session à détourner), et le
 * webhook de Stripe, que sa signature protège.
 */
const MODIFIE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default defineEventHandler((e) => {
  const chemin = e.path || ''
  if (!chemin.startsWith('/api/') || !MODIFIE.has(e.method)) return
  if (chemin.startsWith('/api/paiement/webhook')) return

  const site = getHeader(e, 'sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') {
    throw createError({ statusCode: 403, statusMessage: 'origine_refusee' })
  }
  const origine = getHeader(e, 'origin')
  if (origine && origine !== 'null') {
    let hote = ''
    try { hote = new URL(origine).host } catch { /* origine illisible */ }
    // L'hôte de la requête elle-même : sur Cloudflare, c'est celui qui a mené
    // au Worker. Aucun X-Forwarded-Host à croire.
    const ici = getRequestHost(e)
    if (hote !== ici) throw createError({ statusCode: 403, statusMessage: 'origine_refusee' })
  } else if (origine === 'null') {
    throw createError({ statusCode: 403, statusMessage: 'origine_refusee' })
  }
})
