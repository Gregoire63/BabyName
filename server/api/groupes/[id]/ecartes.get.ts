/**
 * Les prénoms que J'AI écartés, séparés en deux :
 *  - les balayages de famille, regroupés par la racine enregistrée au moment
 *    du geste (colonne votes.balayage) ;
 *  - les non donnés un par un.
 *
 * On lit la racine plutôt que de la recalculer : elle dépendait de la pile
 * au moment du balayage, qui a changé depuis. La redeviner regroupait des
 * prénoms qui n'étaient jamais partis ensemble.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const lignes = await q<{ prenom: string; vote_le: string; balayage: string | null }>(
    `select prenom, vote_le, balayage from votes
      where groupe_id = $1 and user_id = $2 and valeur = 0
      order by vote_le desc limit 600`, [gid, moi.user_id])

  const familles = new Map<string, { racine: string; prenoms: string[]; le: string }>()
  const seuls: { prenom: string; le: string }[] = []

  for (const l of lignes) {
    if (!l.balayage) { seuls.push({ prenom: l.prenom, le: l.vote_le }); continue }
    const f = familles.get(l.balayage)
    if (f) f.prenoms.push(l.prenom)
    else familles.set(l.balayage, { racine: l.balayage, prenoms: [l.prenom], le: l.vote_le })
  }

  return {
    total: lignes.length,
    familles: [...familles.values()].sort((a, b) => b.le.localeCompare(a.le)),
    seuls
  }
})
