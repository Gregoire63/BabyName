export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const [groupe, membres, av, vetos, favoris] = await Promise.all([
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
    q<{ prenom: string; motif: string | null; user_id: string }>(
      `select prenom, motif, user_id from vetos where groupe_id = ?1`, [gid]),
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
   */
  return {
    groupe, membres, avancement: av, moi,
    quota: await quotaEtat(gid, moi.user_id),
    vetos: vetos.map(v => v.prenom),
    mes_vetos: vetos.filter(v => v.user_id === moi.user_id)
                    .map(v => ({ prenom: v.prenom, motif: v.motif })),
    mes_favoris: favoris.map((f: any) => f.prenom)
  }
})
