import { lireFiche, pageFiche, pageIntrouvable } from '../../utils/ficheInsee'
import { POLITIQUE_STATIQUE } from '../../entetes-securite'

/**
 * /prenom/<slug>/ quand Cloudflare n'a pas de fichier statique pour ce
 * prénom : la fiche d'un prénom INSEE sans page, rendue ici (voir
 * scripts/fiches-insee.mjs). Un prénom que l'INSEE ne connaît pas : 404, avec
 * le même habillage et la recherche pour rebondir.
 */
const slugDe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

export default defineEventHandler(async (e) => {
  // GET, et HEAD : des robots vérifient une adresse par HEAD avant de la lire.
  if (e.method !== 'GET' && e.method !== 'HEAD') {
    setResponseHeader(e, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const brut = decodeURIComponent(String(getRouterParam(e, 'chemin') ?? ''))
  const morceaux = brut.split('/').filter(Boolean)
  const slug = slugDe(morceaux[0] ?? '')
  // Une seule forme d'adresse : minuscules, sans accent, barre finale.
  if (slug && (morceaux.length !== 1 || morceaux[0] !== slug || !e.path.split('?')[0]!.endsWith('/'))) {
    return sendRedirect(e, `/prenom/${slug}/`, 301)
  }
  setHeader(e, 'content-type', 'text/html; charset=utf-8')
  setHeader(e, 'content-security-policy', POLITIQUE_STATIQUE)
  const f = slug ? await lireFiche(e, slug) : null
  const html = f ? await pageFiche(f) : null
  if (html) {
    setHeader(e, 'cache-control', 'public, max-age=3600, s-maxage=86400')
    return html
  }
  setResponseStatus(e, 404)
  setHeader(e, 'cache-control', 'public, max-age=300')
  return (await pageIntrouvable(slug)) ?? 'Prénom introuvable'
})
