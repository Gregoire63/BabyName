import type { H3Event } from 'h3'

export interface Membre { groupe_id: number; user_id: string; role: string; poids: number }

/** Exige une session valide. */
export async function exigerUtilisateur(e: H3Event): Promise<string> {
  const id = userIdOuNull(e)
  if (!id) throw createError({ statusCode: 401, statusMessage: 'non_connecte' })
  return id
}

/** Exige que l'utilisateur soit membre du groupe. Renvoie son adhésion. */
export async function exigerMembre(e: H3Event, groupeId: number): Promise<Membre> {
  const uid = await exigerUtilisateur(e)
  const m = await q1<Membre>(
    'select groupe_id, user_id, role, poids from membres where groupe_id = $1 and user_id = $2',
    [groupeId, uid]
  )
  if (!m) throw createError({ statusCode: 403, statusMessage: 'pas_membre' })
  return m
}

/** Lit l'id de groupe d'une route, en validant que c'en est bien un. */
export function groupeIdDepuisRoute(e: H3Event): number {
  const brut = getRouterParam(e, 'id')
  const n = Number(brut)
  if (!Number.isInteger(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: 'groupe_invalide' })
  return n
}
