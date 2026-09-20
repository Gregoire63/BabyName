/**
 * Propose le prochain duel.
 *
 * Deux viviers, dans cet ordre :
 *  1. les « communs » du groupe — ceux que tout le monde a validés. C'est le
 *     cas intéressant : on départage ce qui est déjà accepté par tous.
 *  2. à défaut, MES propres oui et neutres. Sans cette reprise, un groupe
 *     sans aucun accord n'avait aucun duel à jouer, donc aucun classement :
 *     l'onglet restait vide jusqu'au premier match, ce qui peut ne jamais
 *     arriver.
 *
 * Pourquoi MES votes et pas ceux de tout le monde : proposer un prénom parce
 * qu'un autre membre l'a aimé révélerait son vote sur un prénom que je n'ai
 * peut-être pas encore jugé. Le classement Elo est de toute façon personnel
 * (table elo, une ligne par membre), donc un vivier personnel est cohérent.
 *
 * On privilégie les paires dont l'écart Elo est faible : un duel entre un
 * favori évident et un rebut n'apprend rien.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)

  let source: 'communs' | 'mes_choix' = 'communs'
  let liste = (await q<{ prenom: string }>(
    `select prenom from v_matchs where groupe_id = $1`, [gid])).map(c => c.prenom)

  if (liste.length < 2) {
    source = 'mes_choix'
    liste = (await q<{ prenom: string }>(
      `select v.prenom from votes v
        where v.groupe_id = $1 and v.user_id = $2 and v.valeur in (1, 2)
          and not exists (select 1 from vetos t
                           where t.groupe_id = v.groupe_id and t.prenom = v.prenom)
        order by v.valeur desc, v.vote_le desc
        limit 200`, [gid, moi.user_id])).map(c => c.prenom)
  }
  if (liste.length < 2) {
    return { duel: null, raison: 'pas_assez_de_votes', nb: liste.length, source }
  }

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

  let meilleur: [string, string] | null = null
  let ecartMin = Infinity
  // 60 tirages suffisent à trouver une paire serrée sans balayer tout le produit cartésien
  for (let i = 0; i < 60; i++) {
    const a = liste[Math.floor(Math.random() * liste.length)]!
    const b = liste[Math.floor(Math.random() * liste.length)]!
    if (a === b || deja.has([a, b].sort().join('|'))) continue
    const ecart = Math.abs((scores.get(a) ?? 1500) - (scores.get(b) ?? 1500))
    if (ecart < ecartMin) { ecartMin = ecart; meilleur = [a, b] }
  }
  if (!meilleur) return { duel: null, raison: 'tout_deja_joue', nb: liste.length, source }
  return { duel: { a: meilleur[0], b: meilleur[1] }, restants: liste.length, source }
})
