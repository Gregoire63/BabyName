/**
 * Stripe, sans SDK.
 *
 * Deux raisons de ne pas installer `stripe` : le paquet pèse plus d'un mégaoctet
 * dans une fonction serverless qui en fait 2,8 au total, et on n'a besoin ici
 * que de deux choses — créer une session de paiement, et vérifier une
 * signature. Les deux tiennent en quarante lignes de `fetch` et de `crypto`.
 *
 * CE QUI NE PASSE JAMAIS PAR L'APP : le numéro de carte. On crée une session
 * chez Stripe, on renvoie l'URL de SA page, et c'est lui qui encaisse. L'app
 * ne voit ni carte, ni CVC, ni rien qui ressemble à un moyen de paiement.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const API = 'https://api.stripe.com/v1'

function cles() {
  const c = useRuntimeConfig()
  return {
    secret: c.stripeSecretKey as string,
    webhook: c.stripeWebhookSecret as string,
    price: c.stripePriceId as string
  }
}

/** Le paiement est-il configuré ? Sans ça, l'app doit le dire, pas planter. */
export function paiementPret(): boolean {
  const k = cles()
  return !!(k.secret && k.price)
}

/** Stripe n'accepte que du form-urlencoded, y compris pour les objets imbriqués. */
function aplatir(o: Record<string, any>, prefixe = ''): [string, string][] {
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue
    const cle = prefixe ? `${prefixe}[${k}]` : k
    if (Array.isArray(v)) v.forEach((x, i) => out.push(...aplatir({ [i]: x }, cle)))
    else if (typeof v === 'object') out.push(...aplatir(v, cle))
    else out.push([cle, String(v)])
  }
  return out
}

async function appel(chemin: string, corps: Record<string, any>) {
  const k = cles()
  if (!k.secret) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  const r = await fetch(`${API}/${chemin}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${k.secret}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(aplatir(corps)).toString()
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) {
    // On ne renvoie pas le message de Stripe au navigateur : il peut contenir
    // des détails de compte. Il part dans les logs, le client reçoit un code.
    console.error('[stripe]', r.status, j?.error?.message ?? j)
    throw createError({ statusCode: 502, statusMessage: 'paiement_indisponible' })
  }
  return j
}

/**
 * Une session de paiement pour UNE liste. `client_reference_id` porte l'id de
 * la liste et `metadata.user_id` celui de l'acheteur : c'est ce que le webhook
 * relira. On ne fait jamais confiance à ce que le navigateur renverra ensuite.
 */
export async function creerSession(opts: {
  gid: number, uid: string, siteUrl: string, email?: string | null
}) {
  const k = cles()
  return appel('checkout/sessions', {
    mode: 'payment',
    line_items: [{ price: k.price, quantity: 1 }],
    client_reference_id: String(opts.gid),
    metadata: { groupe_id: String(opts.gid), user_id: opts.uid },
    success_url: `${opts.siteUrl}/g/${opts.gid}/swipe?paye=1`,
    cancel_url: `${opts.siteUrl}/g/${opts.gid}/swipe?paye=0`,
    allow_promotion_codes: true,
    customer_email: opts.email || undefined
  })
}

/**
 * Vérifie la signature d'un webhook Stripe.
 *
 * Sans elle, n'importe qui pourrait appeler l'URL du webhook et débloquer
 * toutes les listes gratuitement : c'est la seule chose qui sépare un
 * paiement d'une requête POST. On compare en temps constant, et on refuse
 * un horodatage vieux de plus de cinq minutes (rejeu).
 */
export function signatureValide(corps: string, entete: string | undefined): boolean {
  const k = cles()
  if (!k.webhook || !entete) return false
  const parts = Object.fromEntries(
    entete.split(',').map(p => p.split('=', 2) as [string, string]))
  const t = Number(parts.t)
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false
  const attendu = createHmac('sha256', k.webhook).update(`${t}.${corps}`).digest('hex')
  const recu = parts.v1 ?? ''
  if (recu.length !== attendu.length) return false
  return timingSafeEqual(Buffer.from(recu), Buffer.from(attendu))
}
