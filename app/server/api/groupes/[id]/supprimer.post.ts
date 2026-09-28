/**
 * Supprimer une liste, pour tous ses membres.
 *
 * Réservé à ceux qui décident, comme renommer (nom.put.ts) : un observateur
 * regarde, il ne fait pas disparaître le travail des autres.
 *
 * Tout part d'un coup, en cascade depuis `groupes` : membres, bulletins,
 * blocages, favoris, classements, commentaires, prénoms « déjà pris ». Un code
 * cadeau qui l'avait débloquée perd sa liste (clé `set null`) et part à la
 * purge suivante. Le départ déjà consommé reste compté au compte de chacun
 * (trg_bulletins_depart, migration 0005) : supprimer puis recréer une liste
 * ne rend pas le premier lot gratuit.
 *
 * Le déblocage part avec elle : il appartenait à cette liste, pas au compte
 * (conditions, § 4). L'écran le dit avant, et nomme les autres membres.
 *
 * Confirmation tapée en toutes lettres, comme pour le compte
 * (moi/supprimer.post.ts) : c'est irréversible, et pas seulement pour soi.
 */
export default defineEventHandler(async (e) => {
  const gid = groupeIdDepuisRoute(e)
  const moi = await exigerMembre(e, gid)
  if (moi.role !== 'parent') throw createError({ statusCode: 403, statusMessage: 'reserve_aux_parents' })
  const { confirmation } = await readBody<{ confirmation?: string }>(e) ?? {}
  if (String(confirmation ?? '').trim().toUpperCase() !== 'SUPPRIMER') {
    throw createError({ statusCode: 400, statusMessage: 'confirmation_requise' })
  }
  await ecrire(`delete from groupes where id = ?1`, [gid])
  return { ok: true }
})
