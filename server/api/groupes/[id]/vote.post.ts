export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, valeur } = await readBody<{ prenom?: string; valeur?: number }>(e) ?? {}
  if (!prenom || typeof valeur !== 'number' || ![0, 1, 2].includes(valeur)) {
    throw createError({ statusCode: 400, statusMessage: 'vote_invalide' })
  }
  await q(`insert into votes (groupe_id, user_id, prenom, valeur) values ($1, $2, $3, $4)
           on conflict (groupe_id, user_id, prenom)
           do update set valeur = excluded.valeur, vote_le = now()`,
    [gid, moi.user_id, prenom, valeur])
  // On renvoie les votes des autres sur CE prénom : légitime, on vient de voter.
  return { ok: true, votes: await votesVisibles(gid, moi.user_id, [prenom]) }
})
