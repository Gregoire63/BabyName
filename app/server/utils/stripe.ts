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
    // Seulement si l'on est assujetti a la TVA : le taux « TVA FR 20 % »
    // (inclusive) cree dans le Dashboard. Vide en franchise : la facture porte
    // alors la mention de l'article 293 B, et aucun taux.
    taxRate: String(c.stripeTaxRateId ?? ''),
    api: ((c.stripeApiBase as string) || 'https://api.stripe.com/v1').replace(/\/$/, ''),
    managed: ['1', 'true', 'oui'].includes(String(c.stripeManagedPayments ?? '').toLowerCase())
  }
}

/** Le paiement est-il configuré ? Sans ça, l'app doit le dire, pas planter. */
export function paiementPret(): boolean {
  const k = cles()
  return !!(k.secret && k.price)
}

/**
 * Peut-on vendre ? Pas tant que l'identite du vendeur est vide.
 *
 * Vendre a un particulier sans SIRET, sans adresse ni telephone, c'est vendre
 * en infraction — et la facture comme les conditions acceptees a l'achat
 * seraient trouees la ou elles doivent dire qui vend. Le paiement reste donc
 * ferme en production tant que shared/utils/editeur.ts n'a pas ces champs ;
 * /api/sante dit ce qui manque (le mediateur y figure aussi, sans bloquer :
 * voir mentionsBloquantes). En developpement, on laisse passer : les essais
 * doivent pouvoir parcourir le chemin du paiement.
 */
export function venteOuverte(): boolean {
  return import.meta.dev || mentionsBloquantes().length === 0
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
 * Ce que dit la facture, en pied de page.
 *
 * Elle est le « support durable » que le Code de la consommation exige
 * (art. L221-13) : l'acheteur doit recevoir, par e-mail, la confirmation qu'il
 * a demande l'execution immediate et renonce a la retractation. Sans cette
 * confirmation, la renonciation ne vaut rien — et il garde quatorze jours pour
 * se faire rembourser une liste deja utilisee. Stripe envoie la facture ; on
 * lui donne le texte.
 */
function piedFacture(siteUrl: string, consentementLe: string): string {
  const e = EDITEUR
  const qui = [
    `${e.marque} — ${e.nom}, ${e.forme.toLowerCase()}`,
    e.siret ? `SIRET ${e.siret}` : '',
    e.adresse
  ].filter(Boolean).join(' · ')
  const jour = new Date(consentementLe).toLocaleDateString('fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
  return [
    qui,
    mentionTva() + '.',
    `Contenu numérique fourni dès le paiement. Le ${jour}, vous avez demandé l’accès immédiat et renoncé à votre droit de rétractation (art. L221-28 13° du Code de la consommation).`,
    `Conditions générales, version du ${VERSIONS_TEXTES.conditions} : ${siteUrl}/conditions`,
    e.mediateur.nom ? `Médiateur de la consommation : ${e.mediateur.nom} — ${e.mediateur.site}` : ''
  ].filter(Boolean).join('\n')
}

/**
 * Une session de paiement pour UNE liste. `client_reference_id` porte l'id de
 * la liste et `metadata.user_id` celui de l'acheteur : c'est ce que le webhook
 * relira. On ne fait jamais confiance à ce que le navigateur renverra ensuite.
 *
 * Le consentement (conditions acceptees, execution immediate demandee) part
 * dans les metadonnees de la session ET du paiement : en cas de litige, c'est
 * la preuve, lisible dans le Dashboard, de ce qui a ete accepte et quand.
 */
export async function creerSession(opts: {
  gid: number, uid: string, siteUrl: string, email?: string | null, consentementLe: string
}) {
  const k = cles()
  const direct = !k.managed
  const meta = {
    groupe_id: String(opts.gid),
    user_id: opts.uid,
    conditions_version: VERSIONS_TEXTES.conditions,
    execution_immediate: 'demandee',
    retractation: 'renonciation art. L221-28 13 C. conso',
    consentement_le: opts.consentementLe
  }
  return appel('checkout/sessions', {
    mode: 'payment',
    line_items: [{
      price: k.price, quantity: 1,
      tax_rates: direct && k.taxRate ? [k.taxRate] : undefined
    }],
    // L'app n'existe qu'en francais : une page de paiement en anglais, parce
    // que le navigateur l'est, casserait le parcours au pire moment.
    locale: 'fr',
    client_reference_id: String(opts.gid),
    metadata: meta,
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
      metadata: meta
    },
    // Managed Payments refuse custom_text (verifie en live), et envoie lui-meme
    // recus et factures, en son nom : facture, texte et habillage ne partent
    // qu'en vente directe. Le basculement tient toujours dans une variable.
    ...(direct ? {
      custom_text: {
        submit: {
          message: 'Accès immédiat : la liste est débloquée dès le paiement, pour tous ses membres. ' +
            'Vous avez demandé cette exécution immédiate et renoncé à votre droit de rétractation ' +
            '(art. L221-28 13° du Code de la consommation).'
        },
        after_submit: {
          message: 'Paiement traité par Stripe : babyNames ne voit jamais votre carte. ' +
            'La facture vous est envoyée par e-mail.'
        }
      },
      // La facture : preuve d'achat pour l'acheteur, piece comptable pour le
      // vendeur, et support durable de la renonciation (voir piedFacture).
      // 0,4 % du montant chez Stripe, soit 2,4 centimes par liste.
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `Déblocage de la liste n° ${opts.gid} sur babyNames — accès immédiat, sans abonnement.`,
          footer: piedFacture(opts.siteUrl, opts.consentementLe),
          custom_fields: [
            { name: 'Liste', value: `n° ${opts.gid}` },
            { name: 'Conditions générales', value: `version du ${VERSIONS_TEXTES.conditions}` }
          ],
          metadata: { groupe_id: String(opts.gid) },
          rendering_options: k.taxRate ? { amount_tax_display: 'include_inclusive_tax' } : undefined
        }
      },
      // Les couleurs de l'app sur la page de Stripe : un acheteur qui ne
      // reconnait pas l'endroit ou il paie abandonne, ou conteste ensuite.
      // Le logo, lui, se pose dans le Dashboard (Parametres → Image de marque) :
      // il sert aussi aux recus et aux factures.
      branding_settings: {
        display_name: 'babyNames',
        font_family: 'nunito',
        border_style: 'pill',
        button_color: '#1a234e',
        background_color: '#fbfaf9'
      }
    } : {}),
    // TOUJOURS explicite, dans les deux sens. Le compte a Managed Payments
    // « active par defaut » : une session qui ne dit rien part en Managed
    // Payments (3,5 % de plus, Stripe vendeur) — et, avec la facture ou le
    // texte personnalise ci-dessus, Stripe la REFUSE : plus aucune vente.
    // Verifie contre l'API live le 25/09/2026. Comme la version de l'API,
    // ce choix ne doit pas dependre d'un reglage du Dashboard.
    managed_payments: { enabled: k.managed }
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
  // La reference du paiement : c'est par elle qu'un remboursement retrouvera
  // la liste. Absente pour un code a 100 % — il n'y a rien a rembourser.
  const ref = typeof session.payment_intent === 'string' ? session.payment_intent
    : typeof session.payment_intent?.id === 'string' ? session.payment_intent.id : null
  // `where paye_le is null` : un second passage ne réécrit ni la date ni
  // l'acheteur. L'acheteur peut avoir efface son compte entre-temps : la
  // cle etrangere refuserait son id, on ne le note alors pas.
  await q(`update groupes set paye_le = now(),
                  paye_par = (select id from utilisateurs where id = $2::uuid),
                  offert = $3, paiement_ref = $4
            where id = $1 and paye_le is null`, [gid, uid, offert, ref])
  return { livre: true, groupe: gid, offert }
}

/**
 * Reprendre une liste dont le paiement est defait.
 *
 * Deux cas, et deux seulement :
 *  - remboursement TOTAL (`charge.refunded` avec `refunded: true`) : c'est
 *    l'annulation de la vente. Un remboursement partiel — un geste
 *    commercial — laisse la liste ouverte.
 *  - litige PERDU (`charge.dispute.closed`, statut `lost`) : l'argent est
 *    reparti. Un litige ouvert ne reprend rien : on peut encore le gagner, et
 *    punir un acheteur de bonne foi pendant l'instruction serait pire que
 *    perdre six euros.
 *
 * Les votes, eux, ne bougent pas : on retire le deblocage, pas les donnees.
 */
export async function reprendrePaiement(ev: any): Promise<{ repris: boolean; raison?: string; groupe?: number }> {
  const o = ev?.data?.object
  if (ev?.type === 'charge.refunded') {
    if (!o?.refunded) return { repris: false, raison: 'remboursement_partiel' }
  } else if (ev?.type === 'charge.dispute.closed') {
    if (o?.status !== 'lost') return { repris: false, raison: `litige_${o?.status ?? 'inconnu'}` }
  } else {
    return { repris: false, raison: 'evenement_ignore' }
  }
  const pi = typeof o?.payment_intent === 'string' ? o.payment_intent : o?.payment_intent?.id
  if (typeof pi !== 'string' || !pi.startsWith('pi_')) return { repris: false, raison: 'sans_paiement' }
  const r = await q<{ id: number }>(
    `update groupes set paye_le = null, paye_par = null, offert = false
      where paiement_ref = $1 and paye_le is not null returning id`, [pi])
  return r.length ? { repris: true, groupe: Number(r[0]!.id) } : { repris: false, raison: 'liste_inconnue' }
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
