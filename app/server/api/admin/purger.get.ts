import { timingSafeEqual } from 'node:crypto'

/**
 * La purge quotidienne — appelee par le cron de Vercel (vercel.json).
 *
 * Vercel envoie `Authorization: Bearer <CRON_SECRET>` quand la variable
 * CRON_SECRET existe dans le projet. Sans elle, la route n'existe pas (404) :
 * une purge declenchable par n'importe qui serait un bouton « effacer des
 * comptes » expose sur Internet — meme borne aux comptes inactifs.
 *
 * Le bilan ne contient que des nombres : il part dans les logs de Vercel, qui
 * n'ont pas a contenir d'identifiants.
 */
export default defineEventHandler(async (e) => {
  const secret = String(process.env.CRON_SECRET || useRuntimeConfig().cronSecret || '')
  if (!secret) throw createError({ statusCode: 404, statusMessage: 'desactive' })

  const recu = Buffer.from(getHeader(e, 'authorization') || '')
  const attendu = Buffer.from(`Bearer ${secret}`)
  if (recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) {
    throw createError({ statusCode: 401, statusMessage: 'non_autorise' })
  }

  const bilan = await purger()
  console.info('[purge]', JSON.stringify(bilan))
  return { ok: true, ...bilan }
})
