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
 * 1. On compte les GESTES, pas les prénoms : un swipe juge d'un coup toutes
 *    les graphies du même son (Chloé, Cloé, Khloé…), et c'est un geste.
 *
 * 2. Le quota est celui de la PERSONNE, sur toutes ses listes non débloquées ;
 *    c'est la LISTE qui se débloque en payant. Une liste payée ne consomme
 *    rien, ni départ ni filet.
 *
 * 3. Le départ se compte AUSSI par liste (300 par défaut, deux personnes).
 *    Un compte se crée en une minute (une adresse e-mail à confirmer) : sans
 *    ce plafond, chaque nouveau compte invité dans la liste rapportait 150
 *    prénoms. Un membre qui arrive sur une liste au départ épuisé passe
 *    directement au filet — comme tout le monde au bout de son départ.
 *
 * Les limites se lisent sur la liste où l'on swipe (`quota_depart`,
 * `quota_depart_liste`, `quota_par_jour`) : on peut en offrir une plus large.
 * Le jour est celui de Paris, pas d'UTC : un filet qui revient à deux heures
 * du matin passe pour un bug.
 *
 * Les compteurs vivent dans les bulletins (migration 0005), là où le vote
 * s'écrit : compter un geste ne coûte aucune ligne de plus. Le filet ne garde
 * que le dernier jour de chaque liste — le quota ne lit que le jour même.
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

/**
 * Les colonnes de l'état du quota, lues sur la liste `g` (groupes g).
 * `personne` et `jour` : les paramètres de la requête qui les emploie ;
 * `tout` : 1 pour compter aussi les départs d'une liste débloquée (écran de
 * la liste), 0 sinon — la réponse d'un vote sur une liste débloquée n'en a
 * pas l'usage, et ce sont les votes les plus nombreux : les `case` ne lisent
 * alors que la liste. Chaque ligne lue compte (D1).
 *
 * Consommé = archive + bulletins (migration 0005) : `gestes_depart` des
 * utilisateurs et des groupes ne garde plus que ce qu'avaient consommé les
 * bulletins disparus ; le reste se lit dans les bulletins, où le vote l'a
 * compté (SQL_VOTER, dans votes.ts, qui lit ces mêmes colonnes).
 */
export const colonnesQuota = (personne: string, jour: string, tout: string) => `
       (g.paye_le is not null) as paye,
       g.quota_depart as depart, g.quota_depart_liste as "departListe", g.quota_par_jour as jour,
       case when g.paye_le is null or ${tout} then
         g.gestes_depart + coalesce((select sum(x.depart) from bulletins x where x.groupe_id = g.id), 0)
       else g.gestes_depart end as "faitListe",
       case when g.paye_le is null or ${tout} then
         (select u.gestes_depart from utilisateurs u where u.id = ${personne})
         + coalesce((select sum(x.depart) from membres m
                       join bulletins x on x.groupe_id = m.groupe_id and x.user_id = m.user_id
                      where m.user_id = ${personne}), 0)
       else 0 end as "faitDepart",
       case when g.paye_le is null then
         coalesce((select sum(x.n_jour) from membres m
                     join bulletins x on x.groupe_id = m.groupe_id and x.user_id = m.user_id
                     join groupes y on y.id = x.groupe_id
                    where m.user_id = ${personne} and x.jour = ${jour} and y.paye_le is null), 0)
       else 0 end as "faitJour"`

/** L'état du quota. ?1 la liste, ?2 la personne, ?3 le jour de Paris, ?4 `tout`. */
export const SQL_QUOTA = `select ${colonnesQuota('?2', '?3', '?4')} from groupes g where g.id = ?1`

/** Le même, dans le lot d'un vote : lu seulement si le vote n'a rien écrit
 *  (`changes()`, la dernière écriture du lot) — sinon le vote l'a déjà rendu. */
export const SQL_QUOTA_SI_REFUS = `${SQL_QUOTA} and changes() = 0`

interface LigneQuota {
  paye: boolean
  depart: number
  departListe: number
  jour: number
  faitListe: number
  faitDepart: number
  faitJour: number
}

/** Une ligne de SQL_QUOTA, mise en forme pour l'app. Pas de ligne : la liste
 *  n'existe plus. */
export function etatQuota(g: LigneQuota | null | undefined): Quota {
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  if (g.paye) {
    return {
      paye: true, phase: 'illimite',
      depart: { limite: g.depart, fait: g.faitDepart, liste_limite: g.departListe,
                liste_fait: g.faitListe, reste: Infinity },
      limite_jour: g.jour, fait_jour: 0, reste_jour: Infinity, reste: Infinity
    }
  }
  const departReste = Math.max(0, Math.min(g.depart - g.faitDepart, g.departListe - g.faitListe))
  const resteJour = Math.max(0, g.jour - g.faitJour)
  return {
    paye: false, phase: departReste > 0 ? 'depart' : 'jour',
    depart: { limite: g.depart, fait: g.faitDepart, liste_limite: g.departListe,
              liste_fait: g.faitListe, reste: departReste },
    limite_jour: g.jour, fait_jour: g.faitJour, reste_jour: resteJour,
    reste: departReste + resteJour
  }
}

/** L'état après un vote écrit, depuis ce que le vote a lu avant d'écrire
 *  (le `returning` de SQL_VOTER) : un geste de plus, au départ ou au filet. */
export function etatApresVote(json: string): Quota {
  const q = JSON.parse(json) as LigneQuota & { mode: 'paye' | 'depart' | 'jour' }
  const depart = q.mode === 'depart' ? 1 : 0
  return etatQuota({ ...q, paye: !!q.paye, faitListe: q.faitListe + depart,
    faitDepart: q.faitDepart + depart, faitJour: q.faitJour + (q.mode === 'jour' ? 1 : 0) })
}

/** L'état du quota, sans rien consommer. Consommer, c'est voter : le geste se
 *  compte dans la même instruction que le vote (SQL_VOTER). */
export async function quotaEtat(gid: number, uid: string): Promise<Quota> {
  return etatQuota(await q1<LigneQuota>(SQL_QUOTA, [gid, uid, jourParis(), 1]))
}
