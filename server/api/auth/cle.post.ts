/**
 * Genere une nouvelle cle d'acces depuis un appareil deja connecte.
 * L'ancienne cesse immediatement de fonctionner : c'est le seul moyen de
 * s'en sortir si elle a ete perdue ou vue par quelqu'un d'autre.
 */
export default defineEventHandler(async (e) => {
  const uid = await exigerUtilisateur(e)
  const { cle, hash } = nouvelleCle()
  await q(`update utilisateurs set cle_acces_hash = $2 where id = $1`, [uid, hash])
  return { cle }
})
