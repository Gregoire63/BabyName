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

/**
 * La version de l'API, epinglee.
 *
 * Sans `Stripe-Version`, chaque requete prend la version par defaut du compte
 * — fixee a la premiere requete, puis modifiable d'un clic dans le Dashboard.
 * Un clic sur « mettre a jour » changerait donc la forme des reponses sous le
 * code sans qu'aucune ligne n'ait bouge. Epinglee, elle ne change que quand
 * on la change ici, apres avoir lu le changelog. Le webhook se cree avec la
 * meme, pour que les evenements aient la forme que le code attend.
 */
export const VERSION_API = '2026-08-26.dahlia'

function cles() {
  const c = useRuntimeConfig()
  return {
    secret: c.stripeSecretKey as string,
    webhook: c.stripeWebhookSecret as string,
    price: c.stripePriceId as string,
    api: ((c.stripeApiBase as string) || 'https://api.stripe.com/v1').replace(/\/$/, ''),
    managed: ['1', 'true', 'oui'].includes(String(c.stripeManagedPayments ?? '').toLowerCase())
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
  const r = await fetch(`${k.api}/${chemin}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${k.secret}`,
      'content-type': 'application/x-www-form-urlencoded',
      'stripe-version': VERSION_API
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
    // `{CHECKOUT_SESSION_ID}` est remplace par Stripe : au retour, l'app peut
    // demander elle-meme si c'est paye, sans attendre le webhook.
    success_url: `${opts.siteUrl}/g/${opts.gid}/swipe?paye=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.siteUrl}/g/${opts.gid}/swipe?paye=0`,
    allow_promotion_codes: true,
    customer_email: opts.email || undefined,
    // La liste se lit AUSSI sur le paiement, pas seulement sur la session : le
    // Dashboard affiche les metadonnees du paiement. Quand quelqu'un ecrit
    // « j'ai paye et rien ne s'est debloque », c'est la que l'on cherche.
    // (Sans effet pour un code a 100 % : aucun paiement n'est alors cree.)
    payment_intent_data: {
      description: `babyNames — liste ${opts.gid}`,
      metadata: { groupe_id: String(opts.gid) }
    },
    // Rien d'autre ne change en passant a Managed Payments : on n'envoie aucun
    // des parametres qu'il refuse (custom_text, invoice_creation,
    // payment_method_types, statement_descriptor…). Le basculement tient donc
    // dans une variable d'environnement.
    managed_payments: k.managed ? { enabled: true } : undefined
  })
}

/** Relit une session chez Stripe. Seul le serveur peut le faire : clé secrète. */
export async function lireSession(id: string): Promise<any | null> {
  const k = cles()
  if (!k.secret) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return null
  const r = await fetch(`${k.api}/checkout/sessions/${id}`, {
    headers: { authorization: `Bearer ${k.secret}`, 'stripe-version': VERSION_API }
  })
  if (r.status === 404) return null
  const j: any = await r.json().catch(() => null)
  if (!r.ok || !j) {
    console.error('[stripe]', r.status, j?.error?.message ?? j)
    throw createError({ statusCode: 502, statusMessage: 'paiement_indisponible' })
  }
  return j
}

/**
 * Livre une liste pour une session Stripe. Un seul endroit, deux appelants :
 * le webhook (signé) et le retour du navigateur (session relue chez Stripe).
 *
 * « Payé » ne veut pas dire `paid` : un code promo à 100 % donne une session
 * à 0 € que Stripe termine sans moyen de paiement, avec `no_payment_required`.
 * La règle de Stripe est l'inverse d'une liste blanche : tout ce qui n'est
 * pas `unpaid` se livre. Idempotent — Stripe rejoue, le navigateur recharge.
 */
export async function livrer(session: any): Promise<{ livre: boolean; raison?: string; groupe?: number; offert?: boolean }> {
  if (!session || session.object !== 'checkout.session') return { livre: false, raison: 'pas_une_session' }
  if (session.status && session.status !== 'complete') return { livre: false, raison: 'pas_terminee' }
  if (!session.payment_status || session.payment_status === 'unpaid') return { livre: false, raison: 'en_attente' }

  const gid = Number(session.metadata?.groupe_id ?? session.client_reference_id)
  if (!Number.isInteger(gid) || gid <= 0) return { livre: false, raison: 'sans_groupe' }
  const uid = session.metadata?.user_id ?? null

  // Un code à 100 % marque la liste comme offerte, pas comme vendue : c'est ce
  // qui permet plus tard de compter les ventes sans compter les cadeaux.
  const offert = session.payment_status === 'no_payment_required' || session.amount_total === 0
  // `where paye_le is null` : un second passage ne réécrit ni la date ni
  // l'acheteur.
  await q(`update groupes set paye_le = now(), paye_par = $2, offert = $3
            where id = $1 and paye_le is null`, [gid, uid, offert])
  return { livre: true, groupe: gid, offert }
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
  let t = 0
  const signatures: string[] = []
  for (const morceau of entete.split(',')) {
    const i = morceau.indexOf('=')
    if (i < 0) continue
    const cle = morceau.slice(0, i).trim(), val = morceau.slice(i + 1).trim()
    if (cle === 't') t = Number(val)
    // Plusieurs `v1` quand on fait tourner le secret dans Stripe : il signe
    // alors avec l'ancien ET le nouveau pendant 24 h. Ne garder que le dernier
    // rejetait tous les paiements de la journee si le notre etait le premier.
    else if (cle === 'v1') signatures.push(val)
  }
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false
  const attendu = Buffer.from(
    createHmac('sha256', k.webhook).update(`${t}.${corps}`).digest('hex'))
  return signatures.some(sig => {
    const recu = Buffer.from(sig)
    return recu.length === attendu.length && timingSafeEqual(recu, attendu)
  })
}
