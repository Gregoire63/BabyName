export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  // Un code se devine par essais : dix par heure et par compte, trente par
  // IP. Largement assez pour se tromper de lien ; beaucoup trop peu pour
  // balayer quatre milliards de valeurs (voir shared/utils/codes.ts).
  await limiter(e, 'rejoindre-compte', uid, 10, 3600)
  await limiter(e, 'rejoindre-ip', ipDe(e), 30, 3600)
  const { code } = await readBody<{ code?: string }>(e) ?? {}
  const c = normaliserCodeInvitation(code)
  if (!c) throw createError({ statusCode: 400, statusMessage: 'code_invalide' })
  /**
   * Deux codes mènent a la meme liste et n'y donnent pas la meme voix.
   *
   * Le role vient du CODE, jamais du corps de la requete : un observateur qui
   * bricolerait son lien s'elirait sinon parent, avec droit de veto sur des
   * accords qui ne sont pas les siens.
   */
  const g = await q1<{ id: number; nom: string; observateur: boolean }>(
    `select id, nom, (code_observateur = $1) as observateur
       from groupes where code_invitation = $1 or code_observateur = $1`, [c])
  if (!g) throw createError({ statusCode: 404, statusMessage: 'groupe_introuvable' })
  const role = g.observateur ? 'observateur' : 'invite'
  // `do nothing` : un membre deja parent ne se fait pas retrograder parce
  // qu'on lui a repasse le lien « observateur ».
  await q(`insert into membres (groupe_id, user_id, role, poids) values ($1, $2, $3, 1.0)
           on conflict do nothing`, [g.id, uid, role])
  return { id: g.id, nom: g.nom, role }
})
