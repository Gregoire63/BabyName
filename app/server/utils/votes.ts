/**
 * SEUL endroit du code autorisé à lire les votes d'autrui.
 *
 * Règle du vote aveugle : on ne voit le vote d'un autre membre sur un prénom
 * QUE si l'on a soi-même déjà voté sur ce prénom. Avec Supabase c'était une
 * policy RLS ; ici c'est ce fichier, et il ne doit pas être contourné.
 * Toute nouvelle route qui a besoin des votes passe par ici.
 *
 * LES BULLETINS (migration 0005). Les votes d'un membre sur une liste tiennent
 * en UNE ligne : `positifs` (oui et neutres) et `negatifs` (non), deux objets
 * JSON dont chaque entrée est
 *
 *   "Chloé": [valeur, instant]  ou  [valeur, instant, balayage]
 *
 * (valeur 0, 1 ou 2 ; instant en secondes Unix ; balayage : la racine d'un non
 * donné à toute une famille, ou « ph:Tête » pour une graphie qui a suivi le
 * prénom jugé).
 *
 * D1 compte les lignes, pas les octets : un swipe écrit une ligne, et relire
 * toute une liste en coûte trois. Le travail sur les prénoms se fait donc ICI,
 * dans le Worker, sur des objets JSON — pas en SQL, où json_each compterait
 * chaque prénom comme une ligne lue. Les accords ne lisent que les `positifs`
 * des décideurs : les non, qui sont la plupart des votes, ne sont jamais
 * parcourus pour eux.
 */

import { colonnesQuota } from './quota'

/** [valeur, instant (s), balayage ?] */
export type Entree = [valeur: number, instant: number, balayage?: string]
export type Votes = Record<string, Entree>

/** Le chemin JSON d'un prénom dans un bulletin : $."Chloé". Un prénom valide
 *  n'a ni guillemet ni point (validation.ts) : il ne sort pas de sa clé. */
export const cheminPrenom = (prenom: string) => `$."${prenom}"`

/** Un objet de votes lu en base. Illisible, il vaut vide : jamais d'exception. */
export function lireVotes(json: unknown): Votes {
  if (typeof json !== 'string' || !json) return {}
  try {
    const v = JSON.parse(json)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

/** L'entrée d'un prénom — sans tomber sur Object.prototype : « constructor »
 *  est un prénom valide pour la validation, pas un vote. */
export const entreeDe = (v: Votes, prenom: string): Entree | undefined =>
  Object.hasOwn(v, prenom) ? v[prenom] : undefined

const parPrenom = <T extends { prenom: string }>(a: T, b: T) =>
  a.prenom < b.prenom ? -1 : a.prenom > b.prenom ? 1 : 0

// --------------------------------------------------------------- l'écriture

/**
 * Le vote, en UNE écriture et UNE instruction : le prénom jugé, ses graphies
 * et le quota. Paramètres :
 *
 *   ?1 la liste · ?2 le membre · ?3 le prénom jugé
 *   ?4 les entrées nouvelles, {"Chloé": [2, t], "Cloé": [2, t, "ph:Chloé"]}
 *   ?5 la racine d'un balayage de famille, ou null · ?6 le jour de Paris
 *
 * `nb` compte les prénoms jugés pour eux-mêmes (migration 0006) : le prénom
 * de la carte, ou chaque nom d'une famille écartée — pas les graphies qui
 * l'ont suivi (« ph:… »). « 1 jugé » après un swipe sur Louise, pas 3.
 *
 * Les règles d'avant (une ligne par vote) tiennent, entrée par entrée (`f`) :
 *  - le prénom jugé s'écrit, sauf dans un balayage de famille, qui ne touche
 *    pas à un prénom déjà jugé : on n'écarte que ce qu'on n'a pas regardé ;
 *  - une graphie suit son prénom, mais n'écrase jamais un jugement porté un
 *    par un (une entrée sans balayage) : seulement un autre vote collectif.
 * Puis chaque entrée va dans `positifs` ou `negatifs`, et sort de l'autre
 * (json_patch : une clé à null s'efface).
 *
 * Le quota (`q`, les colonnes de quota.ts) : liste débloquée, rien à
 * compter ; sinon le lot de départ tant qu'il en reste — à la personne ET à
 * la liste —, puis le filet du jour. Plus rien : aucune ligne ne change, la
 * requête ne renvoie rien, et rien n'est compté — une tentative refusée ne
 * mange pas le filet du lendemain. Écrit, le vote renvoie ce qu'il a lu du
 * quota (etatApresVote) : pas besoin de le relire.
 *
 * Le bulletin doit exister : `SQL_BULLETIN` juste avant, dans le même lot.
 */
export const SQL_BULLETIN = `insert or ignore into bulletins (groupe_id, user_id) values (?1, ?2)`

export const SQL_VOTER = `
with
e as materialized (
  select j.key as k, j.value as neuve, j.key = ?3 as principal,
         coalesce(json_extract(b.positifs, '$."' || j.key || '"'),
                  json_extract(b.negatifs, '$."' || j.key || '"')) as ex
    from json_each(?4) j, bulletins b
   where b.groupe_id = ?1 and b.user_id = ?2
),
f as (
  select k, ex,
         case when ex is not null
                   and (case when principal then ?5 is not null else json_array_length(ex) < 3 end)
              then ex else neuve end as entree
    from e
),
c as materialized (
  select json_group_object(k, json(case when json_extract(entree, '$[0]') > 0 then entree end)) as pos,
         json_group_object(k, json(case when json_extract(entree, '$[0]') = 0 then entree end)) as neg,
         -- les prénoms jugés pour eux-mêmes, avant et après (migration 0006)
         sum((coalesce(json_extract(entree, '$[2]'), '') not like 'ph:%')
             - (ex is not null and coalesce(json_extract(ex, '$[2]'), '') not like 'ph:%')) as juges
    from f
),
q as materialized (
  select *,
         case when paye then 'paye'
              when "faitListe" < "departListe" and "faitDepart" < depart then 'depart'
              when "faitJour" < jour then 'jour'
         end as mode
    from (select ${colonnesQuota('?2', '?6', '0')} from groupes g where g.id = ?1)
)
update bulletins set
  positifs = json_patch(bulletins.positifs, c.pos),
  negatifs = json_patch(bulletins.negatifs, c.neg),
  nb       = bulletins.nb + c.juges,
  maj_le   = ${MAINTENANT},
  depart   = bulletins.depart + (q.mode = 'depart'),
  n_jour   = case when q.mode <> 'jour' then bulletins.n_jour
                  when bulletins.jour = ?6 then bulletins.n_jour + 1 else 1 end,
  jour     = case when q.mode = 'jour' then ?6 else bulletins.jour end
from c, q
where bulletins.groupe_id = ?1 and bulletins.user_id = ?2 and q.mode is not null
returning (select json_object('mode', mode, 'paye', paye, 'depart', depart, 'departListe', "departListe",
                              'jour', jour, 'faitListe', "faitListe", 'faitDepart', "faitDepart",
                              'faitJour', "faitJour") from q) as quota`

/** Les entrées d'un vote : le prénom jugé, puis ses graphies, qui portent la
 *  marque du geste (la racine d'un balayage, sinon « ph:Tête »). */
export function entreesDuVote(prenom: string, valeur: number, racine: string | null,
  graphies: string[], instant = Math.floor(Date.now() / 1000)): Record<string, Entree> {
  const out: Record<string, Entree> = { [prenom]: racine ? [valeur, instant, racine] : [valeur, instant] }
  const marque = (racine ?? `ph:${prenom}`).slice(0, 40)
  for (const g of graphies) if (g !== prenom) out[g] = [valeur, instant, marque]
  return out
}

/** Les votes de chacun sur UN prénom — à ne lire qu'une fois son propre vote
 *  écrit (vote.post.ts) : c'est ce qui les rend visibles. ?1 la liste, ?2 le
 *  chemin de la valeur : cheminPrenom(prenom) + '[0]'. Un bulletin est un
 *  membre (clé étrangère) : pas besoin de relire membres. */
/**
 * La voix de CHAQUE membre sur un prénom — y compris ceux qui ne l'ont pas
 * jugé (valeur nulle), avec leur rôle : de quoi dire, sans autre lecture, si
 * le vote qu'on vient d'écrire a fait un accord (server/utils/push.ts).
 * `votesDuPrenom` n'en rend que les voix données.
 */
export const SQL_VOTES_DU_PRENOM = `
select m.user_id, u.pseudo, m.role,
       coalesce(json_extract(b.positifs, ?2), json_extract(b.negatifs, ?2)) as valeur
  from membres m
  join utilisateurs u on u.id = m.user_id
  left join bulletins b on b.groupe_id = m.groupe_id and b.user_id = m.user_id
 where m.groupe_id = ?1`

/** Ma voix sur ce prénom AVANT le vote du même lot (nulle : jamais jugé). */
export const SQL_MA_VOIX = `
select coalesce(json_extract(positifs, ?3), json_extract(negatifs, ?3)) as valeur
  from bulletins where groupe_id = ?1 and user_id = ?2`

export function votesDuPrenom(prenom: string, lignes: { user_id: string; pseudo: string; valeur: number | null }[]): VoteVisible[] {
  return lignes.filter(l => l.valeur !== null && l.valeur !== undefined)
    .map(l => ({ prenom, user_id: l.user_id, pseudo: l.pseudo, valeur: Number(l.valeur) }))
}

/**
 * Retirer des prénoms de mes votes (« remettre » une famille écartée) : ils
 * retournent dans la pile. ?1 la liste, ?2 le membre, ?3 les prénoms (tableau
 * JSON), ?4 le même en objet de null ({"Kevin": null}) : json_patch efface.
 * `nb` perd les prénoms jugés pour eux-mêmes, pas les graphies (« ph:… »).
 */
export const SQL_REMETTRE = `
update bulletins set
  nb = nb - (select count(*) from (
               select coalesce(json_extract(bulletins.positifs, '$."' || j.value || '"'),
                               json_extract(bulletins.negatifs, '$."' || j.value || '"')) as e
                 from json_each(?3) j)
              where e is not null and coalesce(json_extract(e, '$[2]'), '') not like 'ph:%'),
  positifs = json_patch(positifs, ?4),
  negatifs = json_patch(negatifs, ?4)
 where groupe_id = ?1 and user_id = ?2`

// ---------------------------------------------------------------- les lectures

export interface VoteVisible {
  prenom: string
  user_id: string
  pseudo: string
  valeur: number
}

/**
 * Tous les votes que je peux voir dans une liste : les miens, et ceux des
 * autres sur les prénoms que j'ai jugés. Triés par prénom, et à prénom égal
 * dans l'ordre d'arrivée des membres.
 *
 * Ce que je vois ne porte jamais que sur MES prénoms : on part donc des miens,
 * triés une fois, et on cherche chacun chez les autres — sans parcourir ni
 * trier leurs bulletins entiers.
 */
export async function votesVisibles(
  groupeId: number, moi: string, prenoms?: string[]
): Promise<VoteVisible[]> {
  const lignes = await q<{ user_id: string; pseudo: string; positifs: string; negatifs: string }>(
    `select b.user_id, u.pseudo, b.positifs, b.negatifs
       from bulletins b
       join membres m on m.groupe_id = b.groupe_id and m.user_id = b.user_id
       join utilisateurs u on u.id = b.user_id
      where b.groupe_id = ?1
      order by m.rejoint_le`, [groupeId])
  const lus = lignes.map(l => ({ user_id: l.user_id, pseudo: l.pseudo,
    positifs: lireVotes(l.positifs), negatifs: lireVotes(l.negatifs) }))
  const mien = lus.find(l => l.user_id === moi)
  if (!mien) return []
  let miens = [...Object.keys(mien.positifs), ...Object.keys(mien.negatifs)]
  if (prenoms?.length) { const f = new Set(prenoms); miens = miens.filter(p => f.has(p)) }
  miens.sort()

  const out: VoteVisible[] = []
  for (const prenom of miens) {
    for (const l of lus) {
      const e = entreeDe(l.positifs, prenom) ?? entreeDe(l.negatifs, prenom)
      if (e) out.push({ prenom, user_id: l.user_id, pseudo: l.pseudo, valeur: e[0] })
    }
  }
  return out
}

/** Combien de prénoms chaque membre a-t-il jugés ? Sert à l'indicateur
 *  « il manque 12 votes de Papy » sans rien révéler du contenu des votes.
 *
 *  Le role sort avec : « les accords attendent Mamie » est faux si Mamie est
 *  observatrice — les accords ne l'attendent pas, justement. */
export async function avancement(groupeId: number) {
  return q(
    `select m.user_id, u.pseudo, m.role, coalesce(b.nb, 0) as votes
       from membres m
       join utilisateurs u on u.id = m.user_id
       left join bulletins b on b.groupe_id = m.groupe_id and b.user_id = m.user_id
      where m.groupe_id = ?1
      order by votes desc`,
    [groupeId]
  )
}

export interface Accord {
  prenom: string
  nb_votes: number
  score: number
  nb_oui: number
  nb_neutres: number
}

/**
 * Les accords d'une liste — ce qu'était la vue v_matchs : tous les DÉCIDEURS
 * ont voté, aucun non, au moins un oui ; ni bloqué en secret, ni « déjà
 * pris ». Les observateurs ne comptent ni dans les votes ni dans le quorum.
 *
 * Les `positifs` suffisent : un non exclut le prénom, et un décideur sans
 * entrée positive l'exclut aussi. Triés par score (valeur × poids), puis
 * nombre de oui, puis prénom.
 */
export function accords(decideurs: { positifs: Votes; poids: number }[], exclus: Set<string>): Accord[] {
  if (!decideurs.length) return []
  const out: Accord[] = []
  for (const prenom in decideurs[0]!.positifs) {
    if (exclus.has(prenom)) continue
    let score = 0, oui = 0, neutres = 0, complet = true
    for (const d of decideurs) {
      const e = entreeDe(d.positifs, prenom)
      if (!e || !(e[0] > 0)) { complet = false; break }
      score += e[0] * d.poids
      if (e[0] === 2) oui++; else neutres++
    }
    if (complet && oui > 0) {
      out.push({ prenom, nb_votes: decideurs.length, score, nb_oui: oui, nb_neutres: neutres })
    }
  }
  return out.sort(parPrenom).sort((a, b) => b.score - a.score || b.nb_oui - a.nb_oui)
}

/**
 * Les accords d'une liste, et ce que la famille en dit.
 *
 * Un observateur (les grands-parents) ne compte ni dans les accords ni dans
 * leur ordre. Mais son « oui » sur un prénom que le couple a déjà retenu est
 * exactement ce qu'il a envie de dire — « celui-là, je l'adore ». C'est
 * `coeurs` : les observateurs qui ont dit oui à ce prénom, dans l'ordre où ils
 * l'ont dit. Leur « non », lui, ne s'affiche pas ici : sur la courte liste du
 * couple, un refus de la famille serait un veto par la bande.
 *
 * Vote à l'aveugle, comme partout : on ne voit les cœurs des autres qu'après
 * avoir donné son propre avis sur ce prénom. Un parent l'a toujours donné
 * (c'est un accord) ; un observateur, pas forcément.
 *
 * `nb_commentaires` suit la même règle que commentaires.get.ts : la carte
 * repliée dit « 1 mot », sinon le mot de Mamie dort sous un prénom que
 * personne ne pense à déplier.
 *
 * `voix` : qui, parmi les décideurs, a dit oui et qui a dit neutre — « je ne
 * sais plus qui a voté quoi ». Sur un accord, chaque décideur a déjà donné son
 * avis : le vote aveugle est tenu. Mais seuls les décideurs le lisent : un
 * observateur garde les nombres, la famille n'a pas à savoir lequel des deux
 * parents n'était que « neutre ».
 *
 * L'ORDRE est celui de la liste (groupes.ordre_communs, migration 0010),
 * rangé à la main dans « Communs » — un seul pour tous, c'est la courte liste
 * du couple. Les accords qu'il ne connaît pas encore (arrivés depuis) suivent,
 * dans l'ordre du score, et se disent `nouveau`.
 */
export async function communsVisibles(groupeId: number, moi: string) {
  const [membres, exclus, mots, groupe] = await lot([
    // Mes non, et seulement si j'observe : ils disent si j'ai donné mon avis.
    // Un décideur l'a toujours donné sur un accord — on ne les lit pas.
    [`select m.user_id, m.role, m.poids, u.pseudo, b.positifs,
             case when m.user_id = ?2 and m.role = 'observateur' then b.negatifs end as negatifs
        from membres m
        join utilisateurs u on u.id = m.user_id
        left join bulletins b on b.groupe_id = m.groupe_id and b.user_id = m.user_id
       where m.groupe_id = ?1
       order by m.rejoint_le`, [groupeId, moi]],
    [`select prenom from vetos where groupe_id = ?1
      union select prenom from deja_pris where groupe_id = ?1`, [groupeId]],
    [`select prenom, count(*) as n, sum(user_id = ?2) as miens
        from commentaires where groupe_id = ?1 group by prenom`, [groupeId, moi]],
    [`select ordre_communs from groupes where id = ?1`, [groupeId]]
  ])
  const lus = membres!.rows.map((m: any) => ({ ...m, positifs: lireVotes(m.positifs) }))
  const decideurs = lus.filter(m => m.role !== 'observateur')
  const observateurs = lus.filter(m => m.role === 'observateur')
  const mien = lus.find(m => m.user_id === moi)
  const jeDecide = !!mien && mien.role !== 'observateur'
  const mesPos: Votes = mien?.positifs ?? {}
  const mesNeg = lireVotes(mien?.negatifs)
  const jaiVote = (p: string) => mien?.role !== 'observateur'
    || Object.hasOwn(mesPos, p) || Object.hasOwn(mesNeg, p)
  const commentaires = new Map(mots!.rows.map((r: any) => [r.prenom as string, r]))
  const ordre = lireOrdre((groupe!.rows[0] as any)?.ordre_communs)

  const tous = accords(decideurs, new Set(exclus!.rows.map((r: any) => r.prenom))).map((a) => {
    const vu = jaiVote(a.prenom)
    const coeurs = !vu ? [] : observateurs
      .map(o => ({ o, e: entreeDe(o.positifs, a.prenom) }))
      .filter(x => x.e?.[0] === 2)
      .sort((x, y) => x.e![1] - y.e![1])
      .map(x => ({ pseudo: x.o.pseudo as string, moi: x.o.user_id === moi ? 1 : 0 }))
    const k = commentaires.get(a.prenom)
    // Les oui d'abord, puis les neutres ; dans l'ordre d'arrivée dans la liste.
    const voix = !jeDecide ? [] : decideurs
      .map(d => ({ pseudo: d.pseudo as string, moi: d.user_id === moi ? 1 : 0,
                   valeur: entreeDe(d.positifs, a.prenom)![0] as 1 | 2 }))
      .sort((x, y) => y.valeur - x.valeur)
    return {
      ...a,
      coeurs,
      voix,
      j_aime: entreeDe(mesPos, a.prenom)?.[0] === 2,
      nb_commentaires: k ? Number(vu ? k.n : k.miens) : 0,
      nouveau: ordre.size > 0 && !ordre.has(a.prenom)
    }
  })
  // Le tri de `accords` (score) reste celui des nouveaux : sort() est stable.
  const rang = (p: string) => ordre.get(p) ?? ordre.size
  return tous.sort((x, y) => rang(x.prenom) - rang(y.prenom))
}

/** L'ordre rangé à la main : prénom → place. Illisible ou absent : aucun. */
function lireOrdre(brut: unknown): Map<string, number> {
  try {
    const l = typeof brut === 'string' ? JSON.parse(brut) : null
    return new Map(Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string').map((p, i) => [p, i]) : [])
  } catch { return new Map() }
}

/** Le nombre d'accords de chacune de mes listes (l'accueil), en deux
 *  lectures : les positifs des décideurs, et ce qui est retiré du jeu. */
export async function nbCommunsParListe(uid: string): Promise<Map<number, number>> {
  const [decideurs, exclus] = await lot([
    [`select d.groupe_id, d.poids, b.positifs
        from membres moi
        join membres d on d.groupe_id = moi.groupe_id and d.role <> 'observateur'
        left join bulletins b on b.groupe_id = d.groupe_id and b.user_id = d.user_id
       where moi.user_id = ?1`, [uid]],
    [`select t.groupe_id, t.prenom from membres moi join vetos t on t.groupe_id = moi.groupe_id
       where moi.user_id = ?1
      union all
      select d.groupe_id, d.prenom from membres moi join deja_pris d on d.groupe_id = moi.groupe_id
       where moi.user_id = ?1`, [uid]]
  ])
  const parListe = new Map<number, { positifs: Votes; poids: number }[]>()
  for (const d of decideurs!.rows as any[]) {
    const l = parListe.get(Number(d.groupe_id)) ?? []
    l.push({ positifs: lireVotes(d.positifs), poids: Number(d.poids) })
    parListe.set(Number(d.groupe_id), l)
  }
  const retires = new Map<number, Set<string>>()
  for (const r of exclus!.rows as any[]) {
    const s = retires.get(Number(r.groupe_id)) ?? new Set<string>()
    s.add(r.prenom)
    retires.set(Number(r.groupe_id), s)
  }
  const out = new Map<number, number>()
  for (const [gid, ds] of parListe) out.set(gid, accords(ds, retires.get(gid) ?? new Set()).length)
  return out
}

/** Mes non, du plus récent au plus ancien (à la même seconde, le dernier
 *  inscrit d'abord), avec leur balayage. */
export async function mesNon(groupeId: number, moi: string, limite: number) {
  const b = await q1<{ negatifs: string }>(
    `select negatifs from bulletins where groupe_id = ?1 and user_id = ?2`, [groupeId, moi])
  return Object.entries(lireVotes(b?.negatifs))
    .map(([prenom, e], i) => ({ prenom, instant: e[1], balayage: e[2] ?? null, i }))
    .sort((a, b) => b.instant - a.instant || b.i - a.i)
    .slice(0, limite)
    .map(({ prenom, instant, balayage }) => ({ prenom, vote_le: new Date(instant * 1000).toISOString(), balayage }))
}
