/**
 * Une adresse /api/… qui n'est pas une route : 404, en JSON.
 *
 * Sans ce filet, la requête tombait sur la page de l'app (SPA) et répondait
 * 200, avec du HTML : une route retirée — celles de l'ancienne clé d'accès,
 * migration 0007 — avait l'air de marcher, et une app restée ouverte sur
 * l'ancienne version prenait une page pour une réponse.
 */
export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'route_inconnue' })
})
