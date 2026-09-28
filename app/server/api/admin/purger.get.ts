/**
 * La purge quotidienne, declenchee A LA MAIN (ou par un essai).
 *
 * En ligne, elle tourne toute seule chaque nuit : c'est la tache planifiee
 * server/tasks/purge.ts. Cette route n'existe que si CRON_SECRET est pose, et
 * demande `Authorization: Bearer <CRON_SECRET>` : une purge declenchable par
 * n'importe qui serait un bouton « effacer des comptes » expose sur Internet
 * — meme borne aux comptes inactifs. (Le controle : server/utils/admin.ts,
 * le meme que pour le detail de /api/sante.)
 *
 * Le bilan ne contient que des nombres : il part dans les journaux, qui n'ont
 * pas a contenir d'identifiants.
 */
export default defineEventHandler(async (e) => {
  if (!secretAdmin()) throw createError({ statusCode: 404, statusMessage: 'desactive' })
  if (!estAdmin(e)) throw createError({ statusCode: 401, statusMessage: 'non_autorise' })

  const bilan = await purger()
  console.info('[purge]', JSON.stringify(bilan))
  return { ok: true, ...bilan }
})
