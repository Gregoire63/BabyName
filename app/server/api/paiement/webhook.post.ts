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

  // On ne réagit qu'au paiement effectivement encaissé.
  if (ev?.type !== 'checkout.session.completed') return { ok: true, ignore: ev?.type }
  const s = ev.data?.object ?? {}
  if (s.payment_status !== 'paid') return { ok: true, ignore: 'non_paye' }

  const gid = Number(s.metadata?.groupe_id ?? s.client_reference_id)
  const uid = s.metadata?.user_id ?? null
  if (!Number.isFinite(gid)) return { ok: true, ignore: 'sans_groupe' }

  // `where paye_le is null` : Stripe rejoue ses webhooks, et un deuxième
  // passage ne doit pas réécrire la date ni changer qui a payé.
  await q(`update groupes set paye_le = now(), paye_par = $2
            where id = $1 and paye_le is null`, [gid, uid])
  return { ok: true, groupe: gid }
})
