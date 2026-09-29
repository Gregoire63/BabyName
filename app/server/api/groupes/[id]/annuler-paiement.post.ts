import { liberer } from '../../../utils/reservation'
/**
 * Retour de la page de paiement par « annuler » (`?paye=0`).
 *
 * Sans lui, la page Stripe restait ouverte trente minutes, et l'autre parent
 * ne pouvait pas payer entre-temps. On la ferme chez Stripe (elle ne pourra
 * plus encaisser), puis on rend la place. Seul celui qui l'a ouverte le peut.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  const g = await q1<{ par: string | null; sess: string | null }>(
    `select paiement_en_cours_par as par, paiement_en_cours_session as sess from groupes where id = ?1`, [gid])
  if (!g || g.par !== moi.user_id) return { ok: true }
  if (g.sess && paiementPret()) {
    // Deja payee entre-temps (retour arriere apres paiement) : on livre, on
    // ne ferme rien.
    const s = await lireSession(g.sess).catch(() => null)
    if (s?.status === 'complete') { await livrer(s); return { ok: true, paye: true } }
    await expirerSession(g.sess)
  }
  await liberer(gid, moi.user_id)
  return { ok: true }
})
