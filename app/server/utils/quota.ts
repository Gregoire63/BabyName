/**
 * Le quota de la version gratuite, côté serveur : un DÉPART large, puis un
 * FILET quotidien.
 *
 * Il était de 20 prénoms par jour. Deux minutes de tri : le mur tombait
 * pendant la première soirée, avant le premier accord — on faisait payer
 * quelqu'un qui n'avait encore rien vu, au moment précis où il avait envie de
 * continuer. On cherche un prénom par grosses séances, pas au goutte-à-goutte.
 *
 * Désormais :
 *  - le DÉPART (150 par défaut) se juge d'une traite, sans limite de jour ;
 *  - ensuite, un FILET de 15 par jour, sans fin : jamais d'impasse, donc
 *    jamais l'impression d'un piège — ceux qui ne paient pas continuent,
 *    recommandent, et paieront peut-être plus tard ;
 *  - le mur tombe à la deuxième ou troisième soirée, quand les accords sont
 *    déjà à l'écran : c'est là qu'on paie, pas avant.
 *
 * TROIS CHOIX QUI COMMANDENT LE RESTE :
 *
 * 1. On compte les GESTES, pas les lignes de `votes` : un swipe écrit jusqu'à
 *    seize lignes (une par graphie du même son).
 *
 * 2. Le quota est celui de la PERSONNE, sur toutes ses listes non débloquées ;
 *    c'est la LISTE qui se débloque en payant. Une liste payée ne consomme
 *    rien, ni départ ni filet.
 *
 * 3. Le départ se compte AUSSI par liste (300 par défaut, deux personnes).
 *    Sans e-mail, un compte se crée en trois secondes : sans ce plafond,
 *    chaque nouveau compte invité dans la liste rapportait 150 prénoms. Un
 *    membre qui arrive sur une liste au départ épuisé passe directement au
 *    filet — comme tout le monde au bout de son départ.
 *
 * Les limites se lisent sur la liste où l'on swipe (`quota_depart`,
 * `quota_depart_liste`, `quota_par_jour`) : on peut en offrir une plus large.
 * Le jour est celui de Paris, pas d'UTC : un filet qui revient à deux heures
 * du matin passe pour un bug.
 */
export interface Quota {
  paye: boolean
  /** « depart » tant qu'il en reste, puis « jour » ; « illimite » si payée. */
  phase: 'depart' | 'jour' | 'illimite'
  depart: {
    limite: number        // par personne
    fait: number          // consommé par la personne, toutes listes gratuites
    liste_limite: number  // pour la liste
    liste_fait: number    // consommé sur la liste, tous membres
    reste: number         // le plus contraignant des deux
  }
  limite_jour: number
  fait_jour: number
  reste_jour: number
  /** Ce qui reste vraiment, maintenant : départ restant + filet du jour. */
  reste: number
}

interface Reglages {
  paye: boolean
  depart: number
  departListe: number
  jour: number
  faitListe: number
}

async function reglages(gid: number): Promise<Reglages> {
  const g = await q1<Reglages>(
    `select (paye_le is not null) as paye,
            quota_depart as depart, quota_depart_liste as "departListe",
            quota_par_jour as jour, gestes_depart as "faitListe"
       from groupes where id = ?1`, [gid])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  return g
}

/**
 * Ce que la personne a déjà consommé : son départ (à vie, tant que le compte
 * existe) et son filet du jour, sur TOUTES ses listes non débloquées.
 */
async function comptes(uid: string): Promise<{ depart: number; jour: number }> {
  const r = await q1<{ depart: number; jour: number }>(
    `select u.gestes_depart as depart,
            coalesce((select sum(qj.n)
                        from quota_jour qj join groupes g on g.id = qj.groupe_id
                       where qj.user_id = u.id and qj.jour = ?2
                         and g.paye_le is null), 0) as jour
       from utilisateurs u where u.id = ?1`, [uid, jourParis()])
  return { depart: r?.depart ?? 0, jour: r?.jour ?? 0 }
}

function etat(g: Reglages, c: { depart: number; jour: number }): Quota {
  if (g.paye) {
    return {
      paye: true, phase: 'illimite',
      depart: { limite: g.depart, fait: c.depart, liste_limite: g.departListe,
                liste_fait: g.faitListe, reste: Infinity },
      limite_jour: g.jour, fait_jour: 0, reste_jour: Infinity, reste: Infinity
    }
  }
  const departReste = Math.max(0, Math.min(g.depart - c.depart, g.departListe - g.faitListe))
  const resteJour = Math.max(0, g.jour - c.jour)
  return {
    paye: false, phase: departReste > 0 ? 'depart' : 'jour',
    depart: { limite: g.depart, fait: c.depart, liste_limite: g.departListe,
              liste_fait: g.faitListe, reste: departReste },
    limite_jour: g.jour, fait_jour: c.jour, reste_jour: resteJour,
    reste: departReste + resteJour
  }
}

/** L'état du quota, sans rien consommer. */
export async function quotaEtat(gid: number, uid: string): Promise<Quota> {
  const [g, c] = await Promise.all([reglages(gid), comptes(uid)])
  return etat(g, c)
}

/**
 * Consomme un geste. Renvoie l'état APRÈS, ou `null` si plus rien ne reste
 * aujourd'hui — auquel cas rien n'a été compté : une tentative refusée ne doit
 * pas manger le filet du lendemain.
 *
 * Le départ d'abord, puis le filet. Le départ se prend en UN lot qui
 * vérifie les deux plafonds (personne, liste) et incrémente les deux
 * compteurs ensemble — ou aucun : la liste d'abord, sous condition des deux
 * plafonds ; la personne ensuite, seulement si la liste vient de bouger
 * (`changes()` : les lignes touchées par l'instruction précédente du lot).
 * Deux onglets ouverts au même instant peuvent passer un geste de trop ; ça
 * ne vaut pas un verrou.
 */
export async function consommerGeste(gid: number, uid: string): Promise<Quota | null> {
  const g = await reglages(gid)
  if (g.paye) return etat(g, { depart: 0, jour: 0 })

  const [, personne] = await lot([
    [`update groupes set gestes_depart = gestes_depart + 1
       where id = ?2 and gestes_depart < quota_depart_liste
         and (select gestes_depart from utilisateurs where id = ?1) < quota_depart`, [uid, gid]],
    [`update utilisateurs set gestes_depart = gestes_depart + 1
       where id = ?1 and changes() = 1 returning 1 as n`, [uid]]
  ])
  if (personne!.rows.length) return quotaEtat(gid, uid)

  // Plus de départ : le filet du jour.
  if (g.jour <= 0) return null
  const c = await comptes(uid)
  if (c.jour >= g.jour) return null
  await ecrire(`insert into quota_jour (groupe_id, user_id, jour, n)
                values (?1, ?2, ?3, 1)
                on conflict (groupe_id, user_id, jour)
                do update set n = quota_jour.n + 1`,
    [gid, uid, jourParis()])
  return quotaEtat(gid, uid)
}
