/**
 * Qui suis-je ? Appelee a chaque ouverture de l'app.
 *
 * C'est aussi la que l'activite se note le plus surement (voir
 * NOTER_ACTIVITE) — et que l'on range une session orpheline : si le compte a
 * ete efface depuis un autre appareil, on retire le cookie ici plutot que de
 * le laisser echouer ailleurs.
 */
export default defineEventHandler(async (e) => {
  const id = userIdOuNull(e)
  if (!id) return { connecte: false }
  const u = await q1(
    `with activite as (${NOTER_ACTIVITE})
     select id, pseudo, cle_acces_hash is not null as a_une_cle
       from utilisateurs where id = $1`, [id])
  if (!u) { retirerSession(e); return { connecte: false } }
  return { connecte: true, utilisateur: u }
})
