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
 *  - cadeau           : un code cadeau neuf, payé pour de faux (sans Stripe) :
 *                       de quoi essayer /?cadeau=… en local.
 *  - vieillir-cadeaux : les codes pas encore utilisés arrivent à échéance.
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
    // (Les achats de l'app iOS ne partent pas avec les comptes ni les listes :
    // leur clé passe à NULL, exprès — un achat survit à son acheteur. Ici on
    // les vide à la main, sinon la semence bute sur ses propres jetons.)
    await b.lot([
      [MARQUEUR],
      ['delete from achats_apple'],
      ['delete from cadeaux'], ['delete from groupes'], ['delete from utilisateurs'], ['delete from limites'],
      ['delete from _semence'], ['delete from sqlite_sequence']
    ])
    await semerSiVide(b)
    // La session du navigateur designe un compte qui n'existe plus : on la
    // retire, l'app repart de la connexion.
    retirerSession(e)
    return { ok: true, semence: await etatSemence(b) }
  }

  if (action === 'nouvelle-journee') {
    // Le filet vit dans les bulletins (jour, n_jour) : on l'oublie.
    const r = await b.ecrire(`update bulletins set jour = null, n_jour = 0 where jour >= ?1`, [jourParis()])
    return { ok: true, compteurs_effaces: r.changes }
  }

  if (action === 'quotas-a-zero') {
    // Le depart compte dans les bulletins ET dans les archives (migration 0005).
    await b.lot([
      ['update bulletins set depart = 0, jour = null, n_jour = 0'],
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

  if (action === 'cadeau') {
    const { de_la_part, message } = await readBody<{ de_la_part?: string; message?: string }>(e) ?? {}
    const code = nouveauCodeCadeau()
    await b.ecrire(
      `insert into cadeaux (code_hash, session_ref, paiement_ref, de_la_part, message, expire_le)
       values (?1, ?2, null, ?3, ?4, ${decale('?5')})`,
      [empreinteCadeau(code), `cs_local_${code}`, texteOffrant(de_la_part, 40),
        texteOffrant(message, 200), `+${CONSERVATION.cadeauMois} months`])
    return { ok: true, code: cadeauLisible(code) }
  }

  if (action === 'vieillir-cadeaux') {
    const r = await b.ecrire(
      `update cadeaux set expire_le = ${decale('-1 day')} where utilise_le is null`)
    return { ok: true, cadeaux: r.changes }
  }

  throw createError({ statusCode: 400, statusMessage: 'action_inconnue' })
})
