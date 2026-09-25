/**
 * Le retour de la page de paiement, confirmé chez Stripe.
 *
 * Le webhook reste la voie principale — lui seul voit les paiements des gens
 * qui ferment l'onglet avant la redirection. Mais c'est aussi un point de
 * panne unique : un secret mal recopié dans Vercel, et chaque acheteur paie
 * sans rien recevoir. Stripe recommande donc de livrer AUSSI au retour.
 *
 * Rien ici ne fait confiance au navigateur : il n'apporte qu'un identifiant
 * de session, que le serveur relit chez Stripe avec la clé secrète. Et la
 * session doit porter CETTE liste — sinon un identifiant payé pour la liste A
 * débloquerait n'importe quelle liste B.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  await exigerMembre(e, gid)
  const { session_id } = await readBody<{ session_id?: string }>(e) ?? {}
  if (!session_id) throw createError({ statusCode: 400, statusMessage: 'session_manquante' })

  if (!paiementPret()) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })

  const s = await lireSession(session_id)
  if (!s) throw createError({ statusCode: 404, statusMessage: 'session_introuvable' })

  const pour = Number(s.metadata?.groupe_id ?? s.client_reference_id)
  if (pour !== gid) throw createError({ statusCode: 403, statusMessage: 'session_autre_liste' })

  const r = await livrer(s)
  const g = await q1<{ paye: boolean }>(
    `select (paye_le is not null) as paye from groupes where id = $1`, [gid])
  return { ok: true, paye: !!g?.paye, raison: r.livre ? undefined : r.raison }
})
