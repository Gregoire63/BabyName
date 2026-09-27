import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Les liens reçus par e-mail, et leur code à 6 chiffres : pour se connecter,
 * pour confirmer l'adresse d'un compte, pour s'inscrire.
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
export type ButLien = 'connexion' | 'verification' | 'inscription'
const ESSAIS_MAX = 5

const hacher = (jeton: string) => createHash('sha256').update(jeton).digest('base64url')
const signerCode = (code: string, email: string) => empreinteSignee(code, `code:${email}`)

/**
 * Un lien vise un compte (`userId`) ; celui d'une inscription n'en a pas
 * encore : il porte le prénom choisi (`pseudo`), et le compte naîtra de lui.
 */
export async function creerLien(o: { email: string; but: ButLien; userId?: string; pseudo?: string }) {
  const jeton = randomBytes(32).toString('base64url')
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  // Le précédent lien pour la même adresse et le même but cesse de valoir :
  // seul le dernier e-mail reçu fonctionne, et il n'y a jamais deux codes
  // valables à deviner en même temps.
  await lot([
    [`update liens_connexion set utilise_le = ${MAINTENANT}
       where email = ?1 and but = ?2 and utilise_le is null`, [o.email, o.but]],
    [`insert into liens_connexion (id, email, user_id, pseudo, but, code_hash, expire_le)
      values (?1, ?2, ?3, ?4, ?5, ?6, ${decale('?7')})`,
      [hacher(jeton), o.email, o.but === 'inscription' ? null : o.userId ?? null,
        o.but === 'inscription' ? o.pseudo ?? null : null, o.but, signerCode(code, o.email),
        `+${CONSERVATION.lienMinutes} minutes`]]
  ])
  return { jeton, code }
}

/** Le jeton d'un lien : valable, il est consommé et dit pour qui. */
export async function consommerJeton(jeton: string) {
  if (typeof jeton !== 'string' || !/^[A-Za-z0-9_-]{30,60}$/.test(jeton)) return null
  return q1<{ email: string; user_id: string | null; pseudo: string | null; but: ButLien }>(
    `update liens_connexion set utilise_le = ${MAINTENANT}
      where id = ?1 and utilise_le is null and expire_le > ${MAINTENANT}
      returning email, user_id, pseudo, but`, [hacher(jeton)])
}

export type ResultatCode =
  | { ok: true; email: string; but: ButLien; user_id: string | null; pseudo: string | null }
  | { ok: false; raison: 'aucun' | 'faux' | 'epuise'; restants?: number }

/**
 * Le code tapé dans l'app, contre le dernier lien valable de l'adresse — pour
 * l'un des buts donnés : l'écran d'inscription accepte aussi un code de
 * connexion (l'adresse avait déjà un compte, voir inscription.post.ts), et
 * inversement.
 */
export async function consommerCode(email: string, buts: ButLien | ButLien[], code: string): Promise<ResultatCode> {
  const propre = String(code ?? '').replace(/\D/g, '')
  const liste = Array.isArray(buts) ? buts : [buts]
  const l = await q1<{ id: string; code_hash: string; but: ButLien }>(
    `select id, code_hash, but from liens_connexion
      where email = ?1 and but in (${liste.map((_, i) => `?${i + 2}`).join(', ')})
        and utilise_le is null and expire_le > ${MAINTENANT}
      order by cree_le desc limit 1`, [email, ...liste])
  if (!l) return { ok: false, raison: 'aucun' }
  const attendu = Buffer.from(l.code_hash)
  const recu = Buffer.from(signerCode(propre, email))
  if (propre.length === 6 && attendu.length === recu.length && timingSafeEqual(attendu, recu)) {
    const r = await q1<{ user_id: string | null; pseudo: string | null }>(
      `update liens_connexion set utilise_le = ${MAINTENANT}
        where id = ?1 and utilise_le is null returning user_id, pseudo`, [l.id])
    return r ? { ok: true, email, but: l.but, user_id: r.user_id, pseudo: r.pseudo } : { ok: false, raison: 'aucun' }
  }
  const e = await q1<{ essais: number }>(
    `update liens_connexion
        set essais = essais + 1,
            utilise_le = case when essais + 1 >= ?2 then ${MAINTENANT} else utilise_le end
      where id = ?1 returning essais`, [l.id, ESSAIS_MAX])
  const n = e?.essais ?? ESSAIS_MAX
  return n >= ESSAIS_MAX ? { ok: false, raison: 'epuise' } : { ok: false, raison: 'faux', restants: ESSAIS_MAX - n }
}

/**
 * L'adresse du site, pour les liens envoyés : celle de la requête, qui sur
 * Cloudflare est forcément l'un des noms du Worker (voir partieConfiante).
 * Le risque à écarter est « l'empoisonnement de lien » : quelqu'un demande un
 * lien pour VOTRE adresse en forgeant l'hôte, et votre clic lui porterait
 * votre jeton. Sur Cloudflare, une requête à l'hôte forgé n'arrive pas ici ;
 * et X-Forwarded-Host n'est jamais lu.
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
    `select email, pseudo from utilisateurs where id = ?1`, [userId])
  try {
    await ecrire(`update utilisateurs set email = ?2, email_verifie_le = ${MAINTENANT} where id = ?1`, [userId, email])
  } catch (err: any) {
    if (estDoublon(err)) throw createError({ statusCode: 409, statusMessage: 'adresse_prise' })
    throw err
  }
  if (avant?.email && avant.email !== email) {
    await prevenir(alerteAdresse({ a: avant.email, pseudo: avant.pseudo, nouvelle: email }))
  }
}

/**
 * Une inscription prouvée (code ou lien) : le compte naît, adresse confirmée.
 *
 * L'adresse a pu trouver un compte entre la demande et la preuve (le même
 * jour, sur un autre appareil) : on entre alors dans CELUI-LÀ. La boîte mail
 * est prouvée, c'est la sienne ; en créer un second serait impossible
 * (adresse unique) et inutile.
 */
export async function ouvrirCompteInscrit(email: string, pseudo: string) {
  type Compte = { id: string; pseudo: string; gen: number }
  const retrouver = () => q1<Compte>(
    `update utilisateurs set vu_le = ${MAINTENANT} where email = ?1
     returning id, pseudo, session_gen as gen`, [email])
  const deja = await retrouver()
  if (deja) return { ...deja, nouveau: false }
  try {
    const u = await q1<Compte>(
      `insert into utilisateurs (pseudo, email, email_verifie_le) values (?1, ?2, ${MAINTENANT})
       returning id, pseudo, session_gen as gen`, [pseudo, email])
    if (!u) throw createError({ statusCode: 500, statusMessage: 'creation_impossible' })
    return { ...u, nouveau: true }
  } catch (err: any) {
    if (!estDoublon(err)) throw err
    const u = await retrouver()
    if (!u) throw err
    return { ...u, nouveau: false }
  }
}
