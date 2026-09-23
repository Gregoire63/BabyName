/**
 * Le quota de swipes, côté serveur.
 *
 * Il vivait dans le localStorage du navigateur, où il servait d'hygiène : on
 * juge mal après quarante prénoms d'affilée. Un quota qu'on remet à zéro en
 * vidant son cache suffit pour ça. Il ne suffit plus dès qu'il sépare une
 * version gratuite d'une version payante.
 *
 * DEUX CHOIX QUI COMMANDENT LE RESTE :
 *
 * 1. On compte les GESTES, pas les lignes de `votes`. Depuis le regroupement
 *    par prononciation, un seul swipe écrit jusqu'à seize lignes — compter les
 *    lignes ferait tomber le quota en deux minutes, et punirait justement les
 *    prénoms les plus utiles.
 *
 * 2. Le quota porte sur (liste, membre), et c'est la LISTE qui se débloque en
 *    payant. Une liste de prénoms n'a de sens qu'à deux : bloquer un seul
 *    membre la rend inutilisable pour les deux.
 *
 * Le jour est celui de Paris, pas celui d'UTC : un quota qui se remet à zéro
 * à deux heures du matin passe pour un bug.
 */
export interface Quota {
  paye: boolean
  limite_jour: number
  limite_mois: number
  fait_jour: number
  fait_mois: number
  reste_jour: number
  reste_mois: number
  /** Ce qui reste vraiment : le plus contraignant des deux. */
  reste: number
}

const JOUR = `(now() at time zone 'Europe/Paris')::date`

async function reglages(gid: number) {
  const g = await q1<{ paye: boolean; jour: number; mois: number }>(
    `select (paye_le is not null) as paye,
            quota_swipe_jour::int as jour, quota_swipe_mois::int as mois
       from groupes where id = $1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  return g
}

function illimite(g: { jour: number; mois: number }): Quota {
  return {
    paye: true, limite_jour: g.jour, limite_mois: g.mois,
    fait_jour: 0, fait_mois: 0,
    reste_jour: Infinity, reste_mois: Infinity, reste: Infinity
  }
}

async function comptes(gid: number, uid: string) {
  const r = await q1<{ jour: number; mois: number }>(
    `select coalesce((select n from quota_jour
                       where groupe_id = $1 and user_id = $2 and jour = ${JOUR}), 0)::int as jour,
            coalesce((select sum(n) from quota_jour
                       where groupe_id = $1 and user_id = $2
                         and jour >= date_trunc('month', ${JOUR})::date), 0)::int as mois`,
    [gid, uid])
  return { jour: r?.jour ?? 0, mois: r?.mois ?? 0 }
}

function etat(g: { paye: boolean; jour: number; mois: number },
              c: { jour: number; mois: number }): Quota {
  const rj = Math.max(0, g.jour - c.jour)
  const rm = Math.max(0, g.mois - c.mois)
  return {
    paye: false, limite_jour: g.jour, limite_mois: g.mois,
    fait_jour: c.jour, fait_mois: c.mois,
    reste_jour: rj, reste_mois: rm, reste: Math.min(rj, rm)
  }
}

/** L'état du quota, sans rien consommer. */
export async function quotaEtat(gid: number, uid: string): Promise<Quota> {
  const g = await reglages(gid)
  if (g.paye) return illimite(g)
  return etat(g, await comptes(gid, uid))
}

/**
 * Consomme un geste. Renvoie l'état APRÈS, ou `null` si la limite est déjà
 * atteinte — auquel cas rien n'a été compté : une tentative refusée ne doit
 * pas manger le quota du lendemain.
 */
export async function consommerGeste(gid: number, uid: string): Promise<Quota | null> {
  const g = await reglages(gid)
  if (g.paye) return illimite(g)
  if (g.jour <= 0 || g.mois <= 0) return null

  const c = await comptes(gid, uid)
  if (c.mois >= g.mois) return null

  // Le « where » fait le contrôle et l'incrément dans la même instruction :
  // deux onglets ouverts ne peuvent pas passer le quota à deux.
  const r = await q1<{ n: number }>(
    `insert into quota_jour (groupe_id, user_id, jour, n)
     values ($1, $2, ${JOUR}, 1)
     on conflict (groupe_id, user_id, jour)
     do update set n = quota_jour.n + 1 where quota_jour.n < $3
     returning n::int as n`,
    [gid, uid, g.jour])
  if (!r) return null
  return etat(g, { jour: r.n, mois: c.mois + 1 })
}
