import { createHash, randomInt } from 'node:crypto'

/**
 * Les cadeaux : un code qui débloque UNE liste — déjà commencée, ou créée
 * pour l'occasion. Voir la migration 0003 et LISEZMOI, « Offrir babyNamed ».
 *
 * Le code est tiré au moment où l'on ouvre la page de paiement : il part
 * chez Stripe (métadonnées, facture) et ne revient ici qu'en empreinte, une
 * fois le paiement encaissé.
 */

/** Un code cadeau neuf, nu (12 caractères, voir shared/utils/codes.ts). */
export function nouveauCodeCadeau(): string {
  let c = ''
  for (let i = 0; i < LONGUEUR_CADEAU; i++) c += ALPHABET_CODE[randomInt(ALPHABET_CODE.length)]
  return c
}

/**
 * L'empreinte stockée. Un SHA-256 simple, pas le HMAC du secret de session :
 * changer ce secret (une fuite, une rotation) rendrait sinon muets tous les
 * codes déjà vendus. 30^12 valeurs : même la base en main, les retrouver
 * coûterait plus que ce qu'ils valent.
 */
export function empreinteCadeau(codeNu: string): string {
  return createHash('sha256').update(`cadeau\u0000${codeNu}`).digest('hex')
}

/** Ce que l'acheteur peut écrire : un nom, un mot. Bornés, facultatifs. */
export function texteOffrant(brut: unknown, max: number): string | null {
  if (typeof brut !== 'string') return null
  const t = brut.replace(/\s+/g, ' ').trim().slice(0, max)
  return t || null
}

/**
 * Enregistre le cadeau d'une session payée. Deux appelants, comme pour une
 * liste : le webhook signé, et le retour du navigateur (session relue chez
 * Stripe). Idempotent : la seconde arrivée ne change rien.
 *
 * « Payé » : tout ce qui n'est pas `unpaid` (un prélèvement en attente ne
 * donne pas encore de code valable ; son encaissement, plus tard, si).
 */
export async function livrerCadeau(session: any): Promise<{ livre: boolean; raison?: string }> {
  if (!session || session.object !== 'checkout.session') return { livre: false, raison: 'pas_une_session' }
  if (session.metadata?.type !== 'cadeau') return { livre: false, raison: 'pas_un_cadeau' }
  if (session.status && session.status !== 'complete') return { livre: false, raison: 'pas_terminee' }
  if (!session.payment_status || session.payment_status === 'unpaid') return { livre: false, raison: 'en_attente' }
  const code = normaliserCodeCadeau(session.metadata?.code)
  if (!code || typeof session.id !== 'string') return { livre: false, raison: 'sans_code' }
  const ref = typeof session.payment_intent === 'string' ? session.payment_intent
    : typeof session.payment_intent?.id === 'string' ? session.payment_intent.id : null
  await ecrire(
    `insert into cadeaux (code_hash, session_ref, paiement_ref, de_la_part, message, expire_le)
     values (?1, ?2, ?3, ?4, ?5, ${decale('?6')})
     on conflict do nothing`,
    [empreinteCadeau(code), session.id, ref,
      texteOffrant(session.metadata?.de_la_part, 40), texteOffrant(session.metadata?.message, 200),
      `+${CONSERVATION.cadeauMois} months`])
  return { livre: true }
}

/**
 * Pourquoi un code n'a pas servi — lu APRÈS l'échec, pour le dire juste.
 * L'écriture, elle, ne se fie qu'à ses propres conditions (un seul passage
 * gagne, même à deux au même instant).
 */
export async function refusCadeau(codeHash: string, gid?: number): Promise<never> {
  const c = await q1<{ utilise_le: string | null; annule_le: string | null; expire: boolean }>(
    `select utilise_le, annule_le, (expire_le <= ${MAINTENANT}) as expire
       from cadeaux where code_hash = ?1`, [codeHash])
  const raison = !c ? 'cadeau_inconnu'
    : c.annule_le ? 'cadeau_annule'
    : c.utilise_le ? 'cadeau_utilise'
    : c.expire ? 'cadeau_expire'
    : gid ? 'liste_deja_debloquee'
    : 'cadeau_indisponible'
  throw createError({ statusCode: raison === 'cadeau_inconnu' ? 404 : 409, statusMessage: raison })
}
