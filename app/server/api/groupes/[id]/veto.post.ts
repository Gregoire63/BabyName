/**
 * Bloquer un prénom EN SECRET : personne ne saura qui, ni pourquoi.
 *
 * Le prénom emporte ses graphies (`variantes`, envoyées par l'app depuis le
 * catalogue) : une ligne chacune, toutes rattachées à la même tête. Le quota
 * compte les têtes (trigger trg_quota_veto) — Chloé et ses six graphies,
 * c'est UN blocage. Une graphie déjà retirée par quelqu'un d'autre est
 * ignorée, pas refusée.
 *
 * Pour ce qui s'explique (la famille, les amis), il y a « déjà pris » :
 * partagé, sans quota (deja-pris.post.ts).
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  // Tout l'interet de l'observateur : il donne son avis sans pouvoir bloquer.
  if (moi.role === 'observateur') {
    throw createError({ statusCode: 403, statusMessage: 'observateur_sans_veto' })
  }
  await limiter(e, 'exclusion', moi.user_id, 120, 3600)
  const { prenom, motif, variantes } =
    await readBody<{ prenom?: string; motif?: unknown; variantes?: unknown }>(e) ?? {}
  const tete = prenomValide(prenom)
  const autres = prenomsValides(variantes, GRAPHIES_MAX).filter(v => v !== tete)
  try {
    await lot([
      [`insert into vetos (groupe_id, user_id, prenom, motif, tete) values (?1, ?2, ?3, ?4, ?3)`,
        [gid, moi.user_id, tete, noteLibre(motif)]],
      [`insert or ignore into vetos (groupe_id, user_id, prenom, tete)
        select ?1, ?2, value, ?3 from json_each(?4)`,
        [gid, moi.user_id, tete, JSON.stringify(autres)]]
    ])
  } catch (err: any) {
    if (String(err?.message).includes('quota_veto_atteint')) {
      throw createError({ statusCode: 409, statusMessage: 'quota_veto_atteint' })
    }
    if (estDoublon(err)) throw createError({ statusCode: 409, statusMessage: 'deja_veto' })
    throw err
  }
  return { ok: true }
})
