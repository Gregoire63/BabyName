/**
 * Les gestes de la base locale, pour tester sans toucher aux fichiers.
 *
 *  - base-neuve       : tout vider et resemer le jeu d'essai du jour. Rien a
 *                       arreter, rien a supprimer a la main.
 *  - nouvelle-journee : les compteurs du jour a zero — le filet quotidien
 *                       revient, comme demain matin.
 *  - quotas-a-zero    : depart ET jour a zero, pour tout le monde.
 *  - debloquer        : une liste passe payee, sans Stripe (comme un code a
 *                       100 % : « offerte »).
 *  - rebloquer        : elle redevient gratuite.
 *
 * Developpement seulement, base locale seulement (voir utils/dev.ts).
 */
export default defineEventHandler(async (e) => {
  // En ligne : au build, tout ce qui suit sort du bundle (voir base.get.ts).
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  const b = await exigerBaseLocale()
  const { action, groupe } = await readBody<{ action?: string; groupe?: number }>(e) ?? {}

  if (action === 'base-neuve') {
    // Les listes et les comptes emportent tout le reste (cascades) ; les
    // compteurs d'identifiants repartent de 1, comme un `truncate … restart
    // identity` : les essais comptent sur « Notre liste » = liste 1.
    const { semerSiVide, etatSemence, MARQUEUR } = await import('../../utils/semence')
    await b.lot([
      [MARQUEUR],
      ['delete from groupes'], ['delete from utilisateurs'], ['delete from limites'],
      ['delete from _semence'], ['delete from sqlite_sequence']
    ])
    await semerSiVide(b)
    // La session du navigateur designe un compte qui n'existe plus : on la
    // retire, l'app repart de la connexion.
    retirerSession(e)
    return { ok: true, semence: await etatSemence(b) }
  }

  if (action === 'nouvelle-journee') {
    const r = await b.ecrire(`delete from quota_jour where jour >= ?1`, [jourParis()])
    return { ok: true, compteurs_effaces: r.changes }
  }

  if (action === 'quotas-a-zero') {
    await b.lot([
      ['delete from quota_jour'],
      ['update utilisateurs set gestes_depart = 0'],
      ['update groupes set gestes_depart = 0']
    ])
    return { ok: true }
  }

  if (action === 'debloquer' || action === 'rebloquer') {
    const gid = Number(groupe)
    if (!Number.isInteger(gid) || gid <= 0) throw createError({ statusCode: 400, statusMessage: 'groupe_invalide' })
    const r = action === 'debloquer'
      ? await b.ecrire(
          `update groupes set paye_le = coalesce(paye_le, ${MAINTENANT}), offert = 1,
                  paye_par = coalesce(paye_par, cree_par)
            where id = ?1`, [gid])
      : await b.ecrire(
          `update groupes set paye_le = null, paye_par = null, offert = 0, paiement_ref = null
            where id = ?1`, [gid])
    if (!r.changes) throw createError({ statusCode: 404, statusMessage: 'groupe_inconnu' })
    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: 'action_inconnue' })
})
