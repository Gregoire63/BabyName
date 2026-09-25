/**
 * Ou en est la base locale : age du jeu d'essai, comptes, listes.
 * Developpement seulement (voir utils/dev.ts).
 */
export default defineEventHandler(async () => {
  // En ligne, et pas seulement dans exigerBaseLocale : au build, la condition
  // devient `if (true) throw`, et tout ce qui suit — jeu d'essai et cles de
  // dev compris — sort du bundle de production.
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'introuvable' })
  const b = await exigerBaseLocale()
  const { etatSemence, COMPTES_DEV, VERSION_SEMENCE } = await import('../../utils/semence')
  const listes = await b.q(
    `select cast(g.id as text) as id, g.nom, g.paye_le is not null as paye, g.offert, g.code_invitation,
            (select count(*) from membres m where m.groupe_id = g.id) as membres
       from groupes g order by g.id`)
  return {
    semence: { ...(await etatSemence(b)), actuelle: VERSION_SEMENCE },
    comptes: COMPTES_DEV,
    listes
  }
})
