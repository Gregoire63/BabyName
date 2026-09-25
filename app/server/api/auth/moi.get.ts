/**
 * Qui suis-je ? Appelee a chaque ouverture de l'app.
 *
 * C'est aussi la que l'activite se note le plus surement (voir
 * NOTER_ACTIVITE) — et que l'on range une session morte : compte efface
 * depuis un autre appareil, ou « Deconnecter mes autres appareils ».
 *
 * `moyens` dit comment ce compte peut etre retrouve ailleurs : aucun, et
 * l'accueil le signale (il n'existe alors que sur cet appareil).
 */
export default defineEventHandler(async (e) => {
  const s = sessionOuNull(e)
  if (!s) return { connecte: false }
  const u = await q1<any>(
    `with activite as (${NOTER_ACTIVITE})
     select u.id, u.pseudo, u.email, u.session_gen as gen,
            u.cle_acces_hash is not null as a_une_cle,
            (select count(*)::int from passkeys p where p.user_id = u.id) as passkeys
       from utilisateurs u where u.id = $1`, [s.u])
  if (!u || u.gen !== s.g) { retirerSession(e); return { connecte: false } }
  return {
    connecte: true,
    utilisateur: {
      id: u.id, pseudo: u.pseudo, email: u.email, a_une_cle: u.a_une_cle,
      passkeys: u.passkeys,
      moyens: (u.email ? 1 : 0) + (u.passkeys > 0 ? 1 : 0) + (u.a_une_cle ? 1 : 0)
    }
  }
})
