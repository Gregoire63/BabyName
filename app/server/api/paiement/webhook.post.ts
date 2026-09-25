/**
 * Le seul endroit qui débloque une liste.
 *
 * Stripe appelle cette route après un paiement réussi. Rien d'autre ne pose
 * `paye_le` : ni le retour du navigateur sur `?paye=1`, ni un appel de l'app.
 * La signature est ce qui sépare un paiement d'une simple requête POST —
 * sans elle, l'URL suffirait à tout débloquer.
 *
 * Le corps est lu BRUT : la signature porte sur les octets exacts, un JSON
 * reparsé puis re-sérialisé ne correspondrait plus.
 */
export default defineEventHandler(async (e) => {
  const brut = await readRawBody(e, 'utf8')
  if (!brut) throw createError({ statusCode: 400, statusMessage: 'corps_vide' })

  if (!signatureValide(brut, getHeader(e, 'stripe-signature'))) {
    throw createError({ statusCode: 400, statusMessage: 'signature_invalide' })
  }

  let ev: any
  try { ev = JSON.parse(brut) } catch { throw createError({ statusCode: 400, statusMessage: 'json_invalide' }) }

  /**
   * Deux evenements debloquent, pas un.
   *
   * `completed` arrive quand la page de paiement se ferme. Pour une carte,
   * l'argent est deja la ; pour un prelevement (SEPA…), il ne l'est pas
   * encore et `payment_status` vaut `unpaid` — c'est alors
   * `async_payment_succeeded` qui arrive, plus tard, quand il l'est. N'ecouter
   * que le premier, c'etait encaisser les prelevements sans jamais debloquer.
   */
  const DEBLOQUANTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded']
  if (!DEBLOQUANTS.includes(ev?.type)) return { ok: true, ignore: ev?.type }
  const r = await livrer(ev.data?.object)
  return r.livre ? { ok: true, groupe: r.groupe, offert: r.offert } : { ok: true, ignore: r.raison }
})
