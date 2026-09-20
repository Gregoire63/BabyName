export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const [groupe, membres, av, vetos, favoris] = await Promise.all([
    q1(`select id, nom, code_invitation, nb_vetos_max, favoris_visibles, quota_swipe_jour, filtres
          from groupes where id = $1`, [gid]),
    q(`select m.user_id, u.pseudo, m.role, m.poids from membres m
         join utilisateurs u on u.id = m.user_id where m.groupe_id = $1
        order by m.rejoint_le`, [gid]),
    avancement(gid),
    q<{ prenom: string; motif: string | null; user_id: string }>(
      `select prenom, motif, user_id from vetos where groupe_id = $1`, [gid]),
    q(`select prenom from favoris where groupe_id = $1 and user_id = $2`, [gid, moi.user_id])
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
    vetos: vetos.map(v => v.prenom),
    mes_vetos: vetos.filter(v => v.user_id === moi.user_id)
                    .map(v => ({ prenom: v.prenom, motif: v.motif })),
    mes_favoris: favoris.map((f: any) => f.prenom)
  }
})
