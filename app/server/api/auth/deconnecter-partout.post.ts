/**
 * « Deconnecter mes autres appareils ».
 *
 * La generation des sessions monte d'un cran : tous les cookies emis avant
 * cessent de valoir a leur prochaine requete (voir garde.ts). Celui de cet
 * appareil est remplace dans la meme reponse — on ne se deconnecte pas
 * soi-meme en le demandant.
 *
 * A faire apres un telephone perdu, ou si quelqu'un a pu utiliser le compte.
 */
export default defineEventHandler(async (e) => {
  const moi = await exigerCompte(e)
  const r = await q1<{ gen: number }>(
    `update utilisateurs set session_gen = session_gen + 1 where id = $1 returning session_gen as gen`,
    [moi.id])
  poserSession(e, moi.id, r!.gen)
  return { ok: true }
})
