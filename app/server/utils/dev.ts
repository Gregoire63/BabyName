import type { Connexion } from './db'

/**
 * Les outils de la base locale n'existent qu'en developpement, et seulement
 * sur le Postgres embarque.
 *
 * Deux verrous, et le second compte autant que le premier : un `nuxt dev`
 * lance avec une URL de base dans l'environnement (un `vercel env pull`, un
 * NUXT_DATABASE_URL oublie) parle a la VRAIE base. « Base neuve » y viderait
 * la production. On refuse donc tout ce qui n'est pas la base embarquee.
 */
export async function exigerBaseLocale(): Promise<Connexion> {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  const c = await base()
  if (c.moteur !== 'embarque') {
    throw createError({ statusCode: 403, statusMessage: 'base_distante',
      message: 'Outils reserves a la base locale : ce serveur de dev parle a une base distante.' })
  }
  return c
}
