import type { H3Event } from 'h3'

export interface Membre { groupe_id: number; user_id: string; role: string; poids: number }

/**
 * Noter l'activite d'un compte, une fois par jour au plus.
 *
 * `vu_le` fait courir le delai de conservation : un compte sans activite
 * depuis 24 mois est efface par la purge quotidienne. Il n'etait mis a jour
 * qu'a la reprise par cle — un couple qui trie tous les jours sur le meme
 * telephone aurait donc ete efface deux ans apres son inscription, en plein
 * usage. Une ecriture par jour et par personne, pas une par requete : la
 * condition sur la date rend l'`update` vide le reste du temps.
 *
 * S'emploie en CTE : Postgres execute une CTE qui modifie, meme si la
 * requete principale ne la lit pas. Aucun aller-retour de plus.
 */
export const NOTER_ACTIVITE =
  `update utilisateurs set vu_le = now()
    where id = $1 and vu_le < now() - interval '1 day' returning 1`

function jetonOuRefus(e: H3Event): string {
  const id = userIdOuNull(e)
  if (!id) throw createError({ statusCode: 401, statusMessage: 'non_connecte' })
  return id
}

/**
 * Exige une session valide ET un compte qui existe encore.
 *
 * Le cookie est signe, pas adosse a la base : il survit a l'effacement du
 * compte sur les autres appareils de la personne. Sans cette verification,
 * une session orpheline passait la garde et tombait plus loin sur une cle
 * etrangere — une erreur 500 au lieu d'un retour propre a l'accueil.
 */
export async function exigerUtilisateur(e: H3Event): Promise<string> {
  const id = jetonOuRefus(e)
  const u = await q1(
    `with activite as (${NOTER_ACTIVITE})
     select 1 as ok from utilisateurs where id = $1`, [id])
  if (!u) {
    retirerSession(e)
    throw createError({ statusCode: 401, statusMessage: 'compte_inexistant' })
  }
  return id
}

/**
 * Exige que l'utilisateur soit membre du groupe. Renvoie son adhésion.
 *
 * Une seule requete : l'adhesion prouve que le compte existe (elle disparait
 * avec lui, en cascade), et l'activite se note dans la meme instruction.
 */
export async function exigerMembre(e: H3Event, groupeId: number): Promise<Membre> {
  const uid = jetonOuRefus(e)
  const m = await q1<Membre>(
    `with activite as (${NOTER_ACTIVITE})
     select groupe_id, user_id, role, poids from membres
      where user_id = $1 and groupe_id = $2`,
    [uid, groupeId]
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
