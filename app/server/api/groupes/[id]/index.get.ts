/**
 * Une ligne par graphie, rattachée à sa tête : on regroupe pour l'écran.
 * Un veto d'avant les graphies n'a pas de tête — il est la sienne.
 */
function parTete<T extends { prenom: string; tete: string | null }>(lignes: T[]) {
  const groupes = new Map<string, { tete: T; variantes: string[] }>()
  for (const l of lignes) {
    const t = l.tete ?? l.prenom
    const g = groupes.get(t)
    if (!g) groupes.set(t, { tete: l, variantes: l.prenom === t ? [] : [l.prenom] })
    else if (l.prenom === t) g.tete = l
    else g.variantes.push(l.prenom)
  }
  return [...groupes.entries()].map(([prenom, g]) => ({ prenom, ligne: g.tete, variantes: g.variantes }))
}

export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const [groupe, membres, av, vetos, dejaPris, favoris] = await Promise.all([
    // Les codes d'invitation ne vont qu'a ceux qui decident (voir
    // groupes/index.get.ts) : un observateur ne fait entrer personne.
    q1(`select cast(id as text) as id, nom,
               case when ?2 then code_invitation end as code_invitation,
               nb_vetos_max, favoris_visibles, quota_swipe_jour,
               filtres, nom_famille, (paye_le is not null) as paye, paye_le, offert,
               case when ?2 and paye_le is not null then code_observateur end as code_observateur
          from groupes where id = ?1`, [gid, moi.role !== 'observateur']),
    q(`select m.user_id, u.pseudo, m.role, m.poids from membres m
         join utilisateurs u on u.id = m.user_id where m.groupe_id = ?1
        order by m.rejoint_le`, [gid]),
    avancement(gid),
    q<{ prenom: string; tete: string | null; motif: string | null; user_id: string }>(
      `select prenom, tete, motif, user_id from vetos where groupe_id = ?1`, [gid]),
    q<{ prenom: string; tete: string; motif: string | null; user_id: string | null;
        auteur: string | null; pose_le: string }>(
      `select d.prenom, d.tete, d.motif, d.user_id, u.pseudo as auteur, d.pose_le
         from deja_pris d left join utilisateurs u on u.id = d.user_id
        where d.groupe_id = ?1 order by d.pose_le`, [gid]),
    q(`select prenom from favoris where groupe_id = ?1 and user_id = ?2`, [gid, moi.user_id])
  ])

  /**
   * Un veto ne se montre pas aux autres.
   *
   * On renvoyait la liste complete avec le pseudo de celui qui l'avait pose :
   * chacun voyait donc ce que l'autre avait refuse en bloc, alors que tout le
   * reste de l'application repose sur le fait de ne rien savoir avant d'avoir
   * dit soi-meme. Les prenoms bruts restent necessaires — c'est eux qui les
   * retirent de la pile — mais ni l'auteur ni le motif ne sortent d'ici.
   *
   * « Déjà pris », au contraire, se montre en entier, a tous les membres :
   * c'est tout son principe (deja-pris.post.ts).
   */
  return {
    groupe, membres, avancement: av, moi,
    quota: await quotaEtat(gid, moi.user_id),
    vetos: vetos.map(v => v.prenom),
    mes_vetos: parTete(vetos.filter(v => v.user_id === moi.user_id))
      .map(v => ({ prenom: v.prenom, motif: v.ligne.motif, variantes: v.variantes })),
    deja_pris: parTete(dejaPris).map(d => ({
      prenom: d.prenom, variantes: d.variantes, motif: d.ligne.motif,
      auteur: d.ligne.auteur, mien: d.ligne.user_id === moi.user_id, pose_le: d.ligne.pose_le
    })),
    mes_favoris: favoris.map((f: any) => f.prenom)
  }
})
