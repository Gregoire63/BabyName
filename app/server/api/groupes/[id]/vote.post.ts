export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const { prenom, valeur, balayage, variantes } = await readBody<
    { prenom?: string; valeur?: number; balayage?: string; variantes?: string[] }>(e) ?? {}
  if (!prenom || typeof valeur !== 'number' || ![0, 1, 2].includes(valeur)) {
    throw createError({ statusCode: 400, statusMessage: 'vote_invalide' })
  }

  // Le quota d'abord : on ne consomme un geste que si on va vraiment écrire,
  // et on n'écrit rien si le geste n'a pas pu être consommé. Le compteur est
  // en base, pas dans le navigateur — voir server/utils/quota.ts.
  const quota = await consommerGeste(gid, moi.user_id)
  if (!quota) {
    const etat = await quotaEtat(gid, moi.user_id)
    throw createError({
      statusCode: 402, statusMessage: 'quota_atteint',
      data: { quota: etat }
    })
  }

  // balayage : racine commune quand le non vient d'un « écarter la famille ».
  // Renseigné seulement pour un non — écarter est le seul geste collectif qui
  // porte sur des prénoms qu'on n'a pas regardés.
  const racine = valeur === 0 && typeof balayage === 'string' && balayage
    ? balayage.slice(0, 40)
    : null

  // variantes : les autres graphies du MEME prénom (Elyo, Élio, Hélio). Elles
  // ne sont pas d'autres prénoms qu'on écarterait au passage, c'est le même
  // qu'on ne veut pas juger dix fois. Ça vaut pour les trois verdicts.
  const autres = Array.isArray(variantes)
    ? [...new Set(variantes.filter(v => typeof v === 'string' && v && v !== prenom))].slice(0, 40)
    : []

  // Le prénom montré sur la carte est jugé explicitement : il s'écrit sans
  // condition et sans racine — c'est LUI qu'on regardait.
  await q(`insert into votes (groupe_id, user_id, prenom, valeur, balayage)
           values ($1, $2, $3, $4, $5)
           on conflict (groupe_id, user_id, prenom)
           do update set valeur = excluded.valeur, vote_le = now(),
                         balayage = excluded.balayage
                   where $5::text is null`,
    [gid, moi.user_id, prenom, valeur, racine])

  // Les autres graphies suivent, mais JAMAIS au prix d'un jugement porté un
  // par un : le « where votes.balayage is not null » ne laisse un vote
  // collectif écraser qu'un autre vote collectif. Sans lui, un non individuel
  // prendrait la marque du groupe et disparaîtrait en le défaisant — et
  // changer d'avis sur le groupe laisserait les variantes sur l'ancien
  // verdict, ce qui est l'incohérence inverse.
  if (autres.length) {
    const marque = (racine ?? `ph:${prenom}`).slice(0, 40)
    const lignes = autres.map((_, i) => `($1, $2, $${i + 5}, $3, $4)`).join(', ')
    await q(`insert into votes (groupe_id, user_id, prenom, valeur, balayage)
             values ${lignes}
             on conflict (groupe_id, user_id, prenom)
             do update set valeur = excluded.valeur, vote_le = now(),
                           balayage = excluded.balayage
                     where votes.balayage is not null`,
      [gid, moi.user_id, valeur, marque, ...autres])
  }

  // On renvoie les votes des autres sur CE prénom : légitime, on vient de voter.
  return { ok: true, quota, votes: await votesVisibles(gid, moi.user_id, [prenom]) }
})
