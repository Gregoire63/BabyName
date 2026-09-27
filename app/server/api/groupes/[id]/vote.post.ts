/**
 * Un vote : le prénom jugé, ses graphies et le quota, en UN aller-retour et
 * UNE ligne écrite (le bulletin du membre, voir server/utils/votes.ts).
 *
 * Le lot : le bulletin s'il n'existe pas encore ; le vote, qui ne s'écrit que
 * si le quota le permet et le compte en même temps ; les votes des autres sur
 * ce prénom ; l'état du quota après. Le quota est en base, pas dans le
 * navigateur — voir server/utils/quota.ts.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, valeur, balayage, variantes } = await readBody<
    { prenom?: string; valeur?: number; balayage?: string; variantes?: string[] }>(e) ?? {}
  if (typeof valeur !== 'number' || ![0, 1, 2].includes(valeur)) {
    throw createError({ statusCode: 400, statusMessage: 'vote_invalide' })
  }
  prenomValide(prenom)

  // balayage : racine commune quand le non vient d'un « écarter la famille ».
  // Renseigné seulement pour un non — écarter est le seul geste collectif qui
  // porte sur des prénoms qu'on n'a pas regardés.
  const racine = valeur === 0 && typeof balayage === 'string' && balayage
    ? balayage.slice(0, 40)
    : null

  // variantes : les autres graphies du MEME prénom (Elyo, Élio, Hélio). Elles
  // ne sont pas d'autres prénoms qu'on écarterait au passage, c'est le même
  // qu'on ne veut pas juger dix fois. Ça vaut pour les trois verdicts.
  const graphies = prenomsValides(variantes, 40).filter(v => v !== prenom)

  const jour = jourParis()
  const [, vote, autres, refus] = await lot([
    [SQL_BULLETIN, [gid, moi.user_id]],
    [SQL_VOTER, [gid, moi.user_id, prenom, entreesDuVote(prenom!, valeur, racine, graphies), racine, jour]],
    [SQL_VOTES_DU_PRENOM, [gid, cheminPrenom(prenom!) + '[0]']],
    [SQL_QUOTA_SI_REFUS, [gid, moi.user_id, jour, 0]]
  ])

  // Rien d'écrit : le quota a dit non, et rien n'a été compté.
  const ecrit = vote!.rows[0]
  if (!ecrit) {
    throw createError({ statusCode: 402, statusMessage: 'quota_atteint',
      data: { quota: etatQuota(refus!.rows[0]) } })
  }

  // Les votes des autres sur CE prénom : légitime, on vient de voter.
  return { ok: true, quota: etatApresVote(ecrit.quota), votes: votesDuPrenom(prenom!, autres!.rows) }
})
