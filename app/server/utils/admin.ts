import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Le secret d'administration : CRON_SECRET.
 *
 * Il ouvre ce qui ne regarde que l'exploitant : la purge à la main
 * (/api/admin/purger) et le détail de /api/sante. Non posé, ces portes-là
 * n'existent pas.
 */
export function secretAdmin(): string {
  return String(process.env.CRON_SECRET || useRuntimeConfig().cronSecret || '')
}

/** La requête porte `Authorization: Bearer <CRON_SECRET>` (comparé à temps constant). */
export function estAdmin(e: H3Event): boolean {
  const secret = secretAdmin()
  if (!secret) return false
  const recu = Buffer.from(getHeader(e, 'authorization') || '')
  const attendu = Buffer.from(`Bearer ${secret}`)
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
}
