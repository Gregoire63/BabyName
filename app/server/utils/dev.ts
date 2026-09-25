import type { Outils } from './db'

/**
 * Les outils de la base locale n'existent qu'en developpement.
 *
 * En developpement, la liaison DB est la base D1 LOCALE que wrangler simule
 * dans .data/wrangler (voir nuxt.config.ts, cloudflare.dev). Ne jamais mettre
 * `"remote": true` sur la liaison DB dans wrangler.jsonc : `nuxt dev`
 * parlerait alors a la vraie base, et « Base neuve » viderait la production.
 */
export async function exigerBaseLocale(): Promise<Outils> {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  return base()
}
