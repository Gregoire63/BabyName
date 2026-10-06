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
  // Les téléphones à prévenir partent avec les sessions : un appareil perdu
  // ne doit plus recevoir « Vous avez un nouvel accord ». Celui-ci, s'il est
  // une app des stores, redonne son jeton à sa prochaine ouverture.
  const [r] = await lot([
    [`update utilisateurs set session_gen = session_gen + 1 where id = ?1 returning session_gen as gen`, [moi.id]],
    [`delete from appareils where user_id = ?1`, [moi.id]]
  ])
  poserSession(e, moi.id, (r!.rows[0] as { gen: number }).gen)
  return { ok: true }
})
