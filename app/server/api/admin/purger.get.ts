import { timingSafeEqual } from 'node:crypto'

/**
 * La purge quotidienne, declenchee A LA MAIN (ou par un essai).
 *
 * En ligne, elle tourne toute seule chaque nuit : c'est la tache planifiee
 * server/tasks/purge.ts. Cette route n'existe que si CRON_SECRET est pose, et
 * demande `Authorization: Bearer <CRON_SECRET>` : une purge declenchable par
 * n'importe qui serait un bouton « effacer des comptes » expose sur Internet
 * — meme borne aux comptes inactifs.
 *
 * Le bilan ne contient que des nombres : il part dans les journaux, qui n'ont
 * pas a contenir d'identifiants.
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
