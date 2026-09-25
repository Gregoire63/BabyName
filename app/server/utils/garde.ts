import type { H3Event } from 'h3'
import type { Valeur } from './db'

export interface Membre { groupe_id: number; user_id: string; role: string; poids: number }

/**
 * Noter l'activite d'un compte, une fois par jour au plus.
 *
 * `vu_le` fait courir le delai de conservation : un compte sans activite
 * depuis 24 mois est efface par la purge quotidienne. Une ecriture par jour
 * et par personne, pas une par requete : la condition sur la date rend
 * l'`update` vide le reste du temps.
 *
 * Elle part dans le MEME lot que la lecture qui la suit (voir avecActivite) :
 * aucun aller-retour de plus. (Postgres la faisait tenir dans une CTE ;
 * SQLite n'a pas de CTE qui ecrit.)
 */
export const NOTER_ACTIVITE =
  `update utilisateurs set vu_le = ${MAINTENANT}
    where id = ?1 and vu_le < ${decale('-1 day')}`

/** L'activite notee, puis une lecture : un seul lot, un seul aller-retour. */
export async function avecActivite<T>(uid: string, sql: string, params: Valeur[]): Promise<T | null> {
  const [, r] = await lot([[NOTER_ACTIVITE, [uid]], [sql, params]])
  return (r!.rows[0] as T) ?? null
}

function sessionOuRefus(e: H3Event): Session {
  const s = sessionOuNull(e)
  if (!s) throw createError({ statusCode: 401, statusMessage: 'non_connecte' })
  return s
}

/** Cookie d'un compte efface, ou d'une generation revoquee : on le retire
 *  et l'app repart de la connexion. */
function sessionMorte(e: H3Event, raison: string): never {
  retirerSession(e)
  throw createError({ statusCode: 401, statusMessage: raison })
}

/**
 * Exige une session valide ET un compte qui existe encore ET une generation
 * de sessions a jour.
 *
 * Le cookie est signe, pas adosse a la base : il survit a l'effacement du
 * compte sur les autres appareils de la personne, et a « Deconnecter mes
 * autres appareils ». La base tranche : compte absent, ou generation
 * depassee, et la session tombe ici — pas plus loin sur une cle etrangere.
 */
export async function exigerUtilisateur(e: H3Event): Promise<string> {
  const s = sessionOuRefus(e)
  const u = await avecActivite<{ gen: number }>(s.u,
    `select session_gen as gen from utilisateurs where id = ?1`, [s.u])
  if (!u) sessionMorte(e, 'compte_inexistant')
  if (u.gen !== s.g) sessionMorte(e, 'session_revoquee')
  return s.u
}

/** Le compte, sa generation, et ce dont les routes de connexion ont besoin. */
export async function exigerCompte(e: H3Event) {
  const s = sessionOuRefus(e)
  const u = await avecActivite<{ id: string; pseudo: string; email: string | null; gen: number; webauthn_id: string | null }>(s.u,
    `select id, pseudo, email, session_gen as gen, webauthn_id from utilisateurs where id = ?1`, [s.u])
  if (!u) sessionMorte(e, 'compte_inexistant')
  if (u.gen !== s.g) sessionMorte(e, 'session_revoquee')
  return u
}

/**
 * Exige que l'utilisateur soit membre du groupe. Renvoie son adhésion.
 *
 * Un seul aller-retour : le compte (et sa generation de sessions),
 * l'adhesion, et l'activite notee dans le meme lot. Pas de compte ou generation
 * depassee : 401, la session est morte. Pas d'adhesion : 403.
 */
export async function exigerMembre(e: H3Event, groupeId: number): Promise<Membre> {
  const s = sessionOuRefus(e)
  const m = await avecActivite<Membre & { gen: number }>(s.u,
    `select u.session_gen as gen, m.groupe_id, m.user_id, m.role, m.poids
       from utilisateurs u
       left join membres m on m.user_id = u.id and m.groupe_id = ?2
      where u.id = ?1`,
    [s.u, groupeId]
  )
  if (!m) sessionMorte(e, 'compte_inexistant')
  if (m.gen !== s.g) sessionMorte(e, 'session_revoquee')
  if (!m.groupe_id) throw createError({ statusCode: 403, statusMessage: 'pas_membre' })
  return { groupe_id: Number(m.groupe_id), user_id: m.user_id, role: m.role, poids: m.poids }
}

/** Lit l'id de groupe d'une route, en validant que c'en est bien un. */
export function groupeIdDepuisRoute(e: H3Event): number {
  const brut = getRouterParam(e, 'id')
  const n = Number(brut)
  if (!Number.isInteger(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: 'groupe_invalide' })
  return n
}
