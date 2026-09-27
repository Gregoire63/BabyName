/**
 * La page de retour d'un achat de cadeau : le code, à transmettre.
 *
 * Le navigateur n'apporte qu'un identifiant de session ; le serveur la relit
 * chez Stripe avec la clé secrète, livre le cadeau s'il est payé (le webhook
 * a pu ne pas encore passer), et rend le code — qui n'est lisible qu'ici et
 * sur la facture : en base, il n'y a que son empreinte.
 */
export default defineEventHandler(async (e) => {
  await limiter(e, 'cadeau-retour', ipDe(e), 60, 600)
  if (!paiementPret()) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  const id = String(getQuery(e).session_id ?? '')
  const s = id ? await lireSession(id) : null
  const code = normaliserCodeCadeau(s?.metadata?.code)
  if (!s || s.metadata?.type !== 'cadeau' || !code) {
    throw createError({ statusCode: 404, statusMessage: 'session_introuvable' })
  }
  await livrerCadeau(s)
  const c = await q1<{ expire_le: string; utilise_le: string | null; annule_le: string | null }>(
    `select expire_le, utilise_le, annule_le from cadeaux where code_hash = ?1`, [empreinteCadeau(code)])
  return {
    // pret : payé, prêt à servir ; en_attente : un prélèvement pas encore
    // encaissé (le code est déjà écrit sur la facture, il vaudra ensuite).
    statut: !c ? 'en_attente' : c.annule_le ? 'annule' : c.utilise_le ? 'utilise' : 'pret',
    code: cadeauLisible(code),
    de_la_part: texteOffrant(s.metadata?.de_la_part, 40),
    message: texteOffrant(s.metadata?.message, 200),
    expire_le: c?.expire_le ?? null
  }
})
