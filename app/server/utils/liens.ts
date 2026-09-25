import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Les liens de connexion reçus par e-mail, et leur code à 6 chiffres.
 *
 * Deux moyens pour la même preuve (« je lis cette boîte mail ») :
 *  - le LIEN, pour qui ouvre l'e-mail sur l'appareil où il veut entrer ;
 *  - le CODE, pour tout le reste — et surtout pour l'app installée sur l'écran
 *    d'accueil : elle a ses propres cookies, et le lien s'ouvrirait dans le
 *    navigateur, pas dans elle.
 *
 * Rien n'est gardé en clair : le jeton du lien est haché (SHA-256 — 32 octets
 * au hasard n'ont pas besoin de sel), le code est signé (HMAC avec le secret
 * du serveur — un million de valeurs se retrouveraient en un instant à partir
 * d'un simple hachage). Un seul lien valable à la fois par adresse et par
 * but ; quinze minutes ; un seul usage ; cinq codes faux et le lien meurt.
 */
export type ButLien = 'connexion' | 'verification'
const ESSAIS_MAX = 5

const hacher = (jeton: string) => createHash('sha256').update(jeton).digest('base64url')
const signerCode = (code: string, email: string) => empreinteSignee(code, `code:${email}`)

export async function creerLien(o: { email: string; userId: string; but: ButLien }) {
  const jeton = randomBytes(32).toString('base64url')
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  // Le précédent lien pour la même adresse et le même but cesse de valoir :
  // seul le dernier e-mail reçu fonctionne, et il n'y a jamais deux codes
  // valables à deviner en même temps.
  await q(`update liens_connexion set utilise_le = now()
            where email = $1 and but = $2 and utilise_le is null`, [o.email, o.but])
  await q(`insert into liens_connexion (id, email, user_id, but, code_hash, expire_le)
           values ($1, $2, $3, $4, $5, now() + make_interval(mins => $6::int))`,
    [hacher(jeton), o.email, o.userId, o.but, signerCode(code, o.email), CONSERVATION.lienMinutes])
  return { jeton, code }
}

/** Le jeton d'un lien : valable, il est consommé et dit pour qui. */
export async function consommerJeton(jeton: string) {
  if (typeof jeton !== 'string' || !/^[A-Za-z0-9_-]{30,60}$/.test(jeton)) return null
  return q1<{ email: string; user_id: string; but: ButLien }>(
    `update liens_connexion set utilise_le = now()
      where id = $1 and utilise_le is null and expire_le > now()
      returning email, user_id, but`, [hacher(jeton)])
}

export type ResultatCode =
  | { ok: true; email: string; user_id: string }
  | { ok: false; raison: 'aucun' | 'faux' | 'epuise'; restants?: number }

/** Le code tapé dans l'app, contre le dernier lien valable de l'adresse. */
export async function consommerCode(email: string, but: ButLien, code: string): Promise<ResultatCode> {
  const propre = String(code ?? '').replace(/\D/g, '')
  const l = await q1<{ id: string; code_hash: string; user_id: string }>(
    `select id, code_hash, user_id from liens_connexion
      where email = $1 and but = $2 and utilise_le is null and expire_le > now()
      order by cree_le desc limit 1`, [email, but])
  if (!l) return { ok: false, raison: 'aucun' }
  const attendu = Buffer.from(l.code_hash)
  const recu = Buffer.from(signerCode(propre, email))
  if (propre.length === 6 && attendu.length === recu.length && timingSafeEqual(attendu, recu)) {
    const r = await q1<{ user_id: string }>(
      `update liens_connexion set utilise_le = now()
        where id = $1 and utilise_le is null returning user_id`, [l.id])
    return r ? { ok: true, email, user_id: r.user_id } : { ok: false, raison: 'aucun' }
  }
  const e = await q1<{ essais: number }>(
    `update liens_connexion
        set essais = essais + 1,
            utilise_le = case when essais + 1 >= $2 then now() else utilise_le end
      where id = $1 returning essais`, [l.id, ESSAIS_MAX])
  const n = e?.essais ?? ESSAIS_MAX
  return n >= ESSAIS_MAX ? { ok: false, raison: 'epuise' } : { ok: false, raison: 'faux', restants: ESSAIS_MAX - n }
}

/**
 * L'adresse du site, pour les liens envoyés. JAMAIS l'en-tête Host de la
 * requête en production : quelqu'un qui demande un lien pour VOTRE adresse
 * en forgeant cet en-tête recevrait sinon, par votre clic, un lien vers son
 * site à lui — et votre jeton avec (« empoisonnement de lien »).
 */
export function adresseSite(e: Parameters<typeof partieConfiante>[0]): string {
  return partieConfiante(e).origine
}

/** Le lien lui-même. Le jeton voyage après le « # » : il n'apparaît dans
 *  aucun journal de serveur ni aucun en-tête Referer. */
export function lienDe(e: Parameters<typeof partieConfiante>[0], jeton: string): string {
  return `${adresseSite(e)}/connexion/lien#t=${jeton}`
}

/**
 * Une adresse vérifiée devient celle du compte. Déjà prise ailleurs : 409.
 * L'ANCIENNE adresse est prévenue (voir alerteAdresse) : remplacer l'adresse
 * d'un compte, c'est pouvoir y revenir par lien — son titulaire doit le savoir.
 */
export async function enregistrerEmail(userId: string, email: string) {
  const avant = await q1<{ email: string | null; pseudo: string }>(
    `select email, pseudo from utilisateurs where id = $1`, [userId])
  try {
    await q(`update utilisateurs set email = $2, email_verifie_le = now() where id = $1`, [userId, email])
  } catch (err: any) {
    if (err?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'adresse_prise' })
    throw err
  }
  if (avant?.email && avant.email !== email) {
    await prevenir(alerteAdresse({ a: avant.email, pseudo: avant.pseudo, nouvelle: email }))
  }
}
