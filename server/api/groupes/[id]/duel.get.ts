/**
 * Propose le prochain duel. On tire parmi les prénoms « communs » du groupe
 * (ceux qui ont survécu au vote), en privilégiant les paires dont l'écart Elo
 * est faible : un duel entre un favori évident et un rebut n'apprend rien.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)

  const communs = await q<{ prenom: string }>(
    `select prenom from v_matchs where groupe_id = $1`, [gid])
  if (communs.length < 2) return { duel: null, raison: 'pas_assez_de_communs', nb: communs.length }

  const scores = new Map<string, number>()
  for (const r of await q<{ prenom: string; score: number }>(
    `select prenom, score from elo where groupe_id=$1 and user_id=$2`, [gid, moi.user_id])) {
    scores.set(r.prenom, r.score)
  }

  const deja = new Set(
    (await q<{ a: string; b: string }>(
      `select prenom_a as a, prenom_b as b from duels where groupe_id=$1 and user_id=$2
        order by joue_le desc limit 400`, [gid, moi.user_id]))
      .map(d => [d.a, d.b].sort().join('|')))

  const liste = communs.map(c => c.prenom)
  let meilleur: [string, string] | null = null
  let ecartMin = Infinity
  // 60 tirages suffisent à trouver une paire serrée sans balayer tout le produit cartésien
  for (let i = 0; i < 60; i++) {
    const a = liste[Math.floor(Math.random() * liste.length)]
    const b = liste[Math.floor(Math.random() * liste.length)]
    if (a === b || deja.has([a, b].sort().join('|'))) continue
    const ecart = Math.abs((scores.get(a) ?? 1500) - (scores.get(b) ?? 1500))
    if (ecart < ecartMin) { ecartMin = ecart; meilleur = [a, b] }
  }
  if (!meilleur) return { duel: null, raison: 'tout_deja_joue', nb: liste.length }
  return { duel: { a: meilleur[0], b: meilleur[1] }, restants: liste.length }
})
