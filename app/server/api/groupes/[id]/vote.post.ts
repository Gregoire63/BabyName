export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, valeur, balayage } = await readBody<
    { prenom?: string; valeur?: number; balayage?: string }>(e) ?? {}
  if (!prenom || typeof valeur !== 'number' || ![0, 1, 2].includes(valeur)) {
    throw createError({ statusCode: 400, statusMessage: 'vote_invalide' })
  }
  // balayage : racine commune quand le non vient d'un « écarter la famille ».
  // Renseigné seulement pour un non — un oui n'est jamais collectif.
  const racine = valeur === 0 && typeof balayage === 'string' && balayage
    ? balayage.slice(0, 40)
    : null

  // Le « where » n'est pas decoratif : un balayage ne doit JAMAIS ecraser un
  // prenom deja juge un par un. Sans lui, le non individuel prendrait la
  // racine du balayage et disparaitrait en remettant la famille. Le client
  // exclut deja ces prenoms de la pile ; la base le garantit.
  await q(`insert into votes (groupe_id, user_id, prenom, valeur, balayage)
           values ($1, $2, $3, $4, $5)
           on conflict (groupe_id, user_id, prenom)
           do update set valeur = excluded.valeur, vote_le = now(),
                         balayage = excluded.balayage
                   where $5::text is null`,
    [gid, moi.user_id, prenom, valeur, racine])
  // On renvoie les votes des autres sur CE prénom : légitime, on vient de voter.
  return { ok: true, votes: await votesVisibles(gid, moi.user_id, [prenom]) }
})
