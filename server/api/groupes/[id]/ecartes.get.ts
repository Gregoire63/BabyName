/**
 * Les prénoms que J'AI écartés (vote « non »), regroupés par famille.
 *
 * Le regroupement reprend la règle du balayage : même racine (70 % du début
 * du prénom sans accents, au minimum 4 lettres). Un balayage de famille
 * réapparaît donc comme un seul bloc, et les non isolés restent isolés.
 */
const sansAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const lignes = await q<{ prenom: string; vote_le: string }>(
    `select prenom, vote_le from votes
      where groupe_id = $1 and user_id = $2 and valeur = 0
      order by vote_le desc limit 500`, [gid, moi.user_id])

  const familles = new Map<string, { racine: string; prenoms: string[]; le: string }>()
  for (const l of lignes) {
    const slug = sansAccent(l.prenom)
    const racine = slug.slice(0, Math.max(4, Math.floor(slug.length * 0.7)))
    const f = familles.get(racine)
    if (f) f.prenoms.push(l.prenom)
    else familles.set(racine, { racine, prenoms: [l.prenom], le: l.vote_le })
  }
  return {
    total: lignes.length,
    familles: [...familles.values()].sort((a, b) => b.prenoms.length - a.prenoms.length)
  }
})
