/**
 * Les gestes de la base locale, pour tester sans toucher aux fichiers.
 *
 *  - base-neuve       : tout vider et resemer le jeu d'essai du jour. Rien a
 *                       arreter, rien a supprimer a la main (sous Windows,
 *                       effacer .data pendant que le serveur tourne ne marche
 *                       pas : PGlite garde la base ouverte).
 *  - nouvelle-journee : les compteurs du jour a zero — le filet quotidien
 *                       revient, comme demain matin.
 *  - quotas-a-zero    : depart ET jour a zero, pour tout le monde.
 *  - debloquer        : une liste passe payee, sans Stripe (comme un code a
 *                       100 % : « offerte »).
 *  - rebloquer        : elle redevient gratuite.
 *
 * Developpement seulement, base embarquee seulement (voir utils/dev.ts).
 */
const JOUR = `(now() at time zone 'Europe/Paris')::date`

export default defineEventHandler(async (e) => {
  // En ligne : au build, tout ce qui suit sort du bundle (voir base.get.ts).
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  const c = await exigerBaseLocale()
  const { action, groupe } = await readBody<{ action?: string; groupe?: number }>(e) ?? {}

  if (action === 'base-neuve') {
    const tables = await c.query(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`)
    const noms = tables.rows.map((t: any) => `"${String(t.tablename).replace(/"/g, '')}"`)
    if (noms.length) await c.executer(`truncate table ${noms.join(', ')} restart identity cascade`)
    const { semerSiVide, etatSemence } = await import('../../utils/semence')
    await semerSiVide(c)
    // La session du navigateur designe un compte qui n'existe plus : on la
    // retire, l'app repart de la connexion.
    retirerSession(e)
    return { ok: true, semence: await etatSemence(c) }
  }

  if (action === 'nouvelle-journee') {
    const r = await c.query(`delete from quota_jour where jour >= ${JOUR} returning 1`)
    return { ok: true, compteurs_effaces: r.rows.length }
  }

  if (action === 'quotas-a-zero') {
    await c.query(`delete from quota_jour`)
    await c.query(`update utilisateurs set gestes_depart = 0`)
    await c.query(`update groupes set gestes_depart = 0`)
    return { ok: true }
  }

  if (action === 'debloquer' || action === 'rebloquer') {
    const gid = Number(groupe)
    if (!Number.isInteger(gid) || gid <= 0) throw createError({ statusCode: 400, statusMessage: 'groupe_invalide' })
    const r = action === 'debloquer'
      ? await c.query(
          `update groupes set paye_le = coalesce(paye_le, now()), offert = true,
                  paye_par = coalesce(paye_par, cree_par)
            where id = $1 returning id`, [gid])
      : await c.query(
          `update groupes set paye_le = null, paye_par = null, offert = false, paiement_ref = null
            where id = $1 returning id`, [gid])
    if (!r.rows.length) throw createError({ statusCode: 404, statusMessage: 'groupe_inconnu' })
    return { ok: true }
  }

  throw createError({ statusCode: 400, statusMessage: 'action_inconnue' })
})
