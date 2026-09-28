/**
 * Le propriétaire d'une liste : celui qui l'a créée, tant qu'il en est.
 *
 * S'il la quitte (ou efface son compte), la liste passe au plus ancien de
 * ceux qui y décident — jamais à un observateur. Rien n'est écrit : le
 * propriétaire se déduit des membres, il ne peut donc pas désigner quelqu'un
 * qui n'est plus là. Il est le seul à pouvoir supprimer la liste pour tous
 * (groupes/[id]/supprimer.post.ts) ; les autres la quittent.
 */
export async function proprietaire(gid: number): Promise<string | null> {
  const r = await q1<{ u: string | null }>(
    `select coalesce(
       (select m.user_id from membres m join groupes g on g.id = m.groupe_id
         where m.groupe_id = ?1 and m.user_id = g.cree_par and m.role <> 'observateur'),
       (select m.user_id from membres m
         where m.groupe_id = ?1 and m.role <> 'observateur'
         order by m.rejoint_le, m.user_id limit 1)) as u`, [gid])
  return r?.u ?? null
}
