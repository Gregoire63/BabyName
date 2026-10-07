import type { H3Event } from 'h3'
import type { Instruction } from './db'

/**
 * L'achat dans l'app iOS, vérifié chez Apple — sans SDK.
 *
 * Sur iPhone, une liste se débloque par l'achat intégré de l'App Store
 * (StoreKit, dans la coquille : mobile/src/achats.ts). C'est Apple qui
 * encaisse, qui envoie le reçu, et qui rembourse. Le site n'y gagne ni carte
 * ni adresse : seulement un NUMÉRO de transaction.
 *
 * LE SERVEUR NE CROIT NI L'APP NI LA PAGE. Ce numéro, n'importe qui peut en
 * inventer un. On le relit donc soi-même chez Apple (App Store Server API),
 * avec une clé que seul le serveur détient, et c'est la réponse d'Apple qui
 * dit tout : quelle app, quel produit, pour quel jeton, remboursée ou non.
 * La réponse est un jeton signé (JWS) ; reçue d'Apple même, sur sa connexion
 * chiffrée et sous notre clé, on en lit le contenu sans revérifier la chaîne
 * de certificats — un JWS apporté par l'app, lui, ne serait pas cru.
 *
 * QUELLE LISTE ? Avant d'ouvrir la feuille d'achat, le serveur tire un jeton
 * (UUID) et note pour qui et pour quelle liste (achat-apple.post.ts). L'app
 * le confie à StoreKit (`appAccountToken`), Apple le rend dans la transaction
 * signée. Le navigateur et l'app ne décident donc de rien — et une
 * transaction retrouvée au lancement suivant, l'app ayant été fermée en plein
 * achat, sait encore pour quelle liste elle était.
 *
 * PRODUCTION PUIS BAC À SABLE. Une transaction n'existe que dans son
 * environnement. Les achats d'essai (TestFlight, comptes « Sandbox », et
 * l'équipe de validation d'Apple) vivent dans le bac à sable : on demande à
 * la production, puis au bac à sable si elle ne connaît pas. Un achat du bac
 * à sable débloque pour de bon — sans cela Apple ne pourrait pas valider
 * l'app — mais la liste est notée « offerte », pas vendue.
 *
 * TANT QUE L'APP N'EST JAMAIS SORTIE, LA PRODUCTION REFUSE TOUT. Apple ne
 * l'écrit pas dans sa documentation, ses ingénieurs le disent sur son forum
 * (fils 751045 et 806452) : avant la première version publiée sur l'App
 * Store, son API de production répond 401 à toute demande, même signée d'une
 * bonne clé — et non « inconnue ». Or c'est exactement l'état dans lequel
 * l'app est essayée (TestFlight) puis validée par Apple. Un 401 de la
 * production ne dit donc PAS « la clé est fausse » : on demande au bac à
 * sable, et c'est seulement s'il refuse lui aussi qu'elle l'est.
 */
const HOTES = {
  Production: 'https://api.storekit.apple.com',
  Sandbox: 'https://api.storekit-sandbox.apple.com'
} as const
type Environnement = keyof typeof HOTES

function reglages() {
  const c = useRuntimeConfig()
  const sansBarre = (x: unknown) => String(x ?? '').replace(/\/+$/, '')
  return {
    cle: String(c.appleIapCle ?? ''),
    cleId: String(c.appleIapCleId ?? '').trim(),
    emetteur: String(c.appleIapEmetteur ?? '').trim(),
    paquet: String(c.appleBundle || 'fr.babynamed.app').trim(),
    produit: String(c.public.appleProduit ?? '').trim(),
    // Pour les essais seulement : un faux Apple, sur la machine.
    hotes: {
      Production: sansBarre(c.appleIapApi) || HOTES.Production,
      Sandbox: sansBarre(c.appleIapApiBac) || HOTES.Sandbox
    }
  }
}

/** L'achat par l'App Store est-il réglé ? Sans cela, l'app iOS ne propose rien.
 *  (Réglé ne veut pas dire accepté par Apple : voir `appleRepond`.) */
export function applePret(): boolean {
  const r = reglages()
  return !!(r.cle && r.cleId && r.emetteur && r.paquet && r.produit)
}

/** Le produit à vendre dans l'app iOS, et le paquet qui le vend. */
export function produitApple() {
  const r = reglages()
  return { produit: r.produit, paquet: r.paquet }
}

/** La référence d'un achat Apple sur la liste qu'il a débloquée (groupes.paiement_ref). */
const REF = (transaction: string) => `apple:${transaction}`

/** Un numéro de transaction d'Apple : des chiffres, et rien d'autre. */
export const TRANSACTION_APPLE = /^[0-9]{1,32}$/

/** L'achat par l'App Store ne se fait que dans l'app iOS. */
export function exigerAppIos(e: H3Event) {
  if (coquilleDepuis(getHeader(e, 'user-agent'))?.plateforme !== 'ios') {
    throw createError({ statusCode: 403, statusMessage: 'achat_apple_hors_de_l_app' })
  }
}

// --- le jeton d'accès à l'API d'Apple ----------------------------------------

const b64url = (octets: ArrayBuffer | Uint8Array | string): string => {
  const o = typeof octets === 'string' ? new TextEncoder().encode(octets) : new Uint8Array(octets as ArrayBuffer)
  let s = ''
  for (const x of o) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64url(texte: string): string {
  const b = texte.replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(b + '='.repeat((4 - (b.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(brut, c => c.charCodeAt(0)))
}

/**
 * La clé privée (le fichier .p8 d'App Store Connect), prête à signer. Elle
 * arrive telle que le secret a été posé : le fichier entier avec ses lignes
 * « BEGIN / END », ses retours à la ligne devenus « \n », ou son seul contenu.
 */
let cleImportee: { pour: string; cle: Promise<CryptoKey> } | null = null
function cleDeSignature(pem: string): Promise<CryptoKey> {
  if (cleImportee?.pour === pem) return cleImportee.cle
  const nu = pem.replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(nu), c => c.charCodeAt(0))
  const cle = crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  cleImportee = { pour: pem, cle }
  // Une clé illisible ne doit pas rester en mémoire : on la relira (corrigée) au prochain appel.
  cle.catch(() => { if (cleImportee?.pour === pem) cleImportee = null })
  return cle
}

/**
 * Le jeton qui ouvre l'API d'Apple : un JWT signé en ES256, un par requête.
 * Valable cinq minutes, comme ceux de la bibliothèque d'Apple : il ne sert
 * qu'à la requête qui suit, et Apple en refuse un de plus d'une heure.
 */
async function jetonApi(): Promise<string> {
  const r = reglages()
  const maintenant = Math.floor(Date.now() / 1000)
  const entete = b64url(JSON.stringify({ alg: 'ES256', kid: r.cleId, typ: 'JWT' }))
  const corps = b64url(JSON.stringify({
    iss: r.emetteur, iat: maintenant, exp: maintenant + 300, aud: 'appstoreconnect-v1', bid: r.paquet
  }))
  // WebCrypto rend la signature au format que JWS attend (r puis s, 64 octets).
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await cleDeSignature(r.cle), new TextEncoder().encode(`${entete}.${corps}`))
  return `${entete}.${corps}.${b64url(signature)}`
}

// --- la clé ouvre-t-elle vraiment la porte ? ---------------------------------

/** Ce qu'un environnement d'Apple fait de notre clé. */
type Avis = 'oui' | 'refus' | 'panne'

/**
 * La sonde : relire, dans un environnement, une transaction qui n'existe pas
 * (« 0 »). Apple répond « inconnue » (404, ou 400) s'il a accepté le jeton
 * d'accès, 401 s'il le refuse.
 */
async function avisDe(env: Environnement): Promise<Avis> {
  const r = reglages()
  try {
    const rep = await fetch(`${r.hotes[env]}/inApps/v1/transactions/0`, {
      headers: { authorization: `Bearer ${await jetonApi()}`, accept: 'application/json' }
    })
    if (rep.status === 401 || rep.status === 403) return 'refus'
    // 429, 5xx : Apple ne peut rien vérifier pour l'instant.
    if (rep.status === 429 || rep.status >= 500) {
      console.error('[apple] sonde :', env, 'HTTP', rep.status)
      return 'panne'
    }
    return 'oui'
  } catch (err) {
    console.error('[apple] sonde : clé illisible ou Apple injoignable :', env, String((err as any)?.message ?? err).slice(0, 120))
    return 'panne'
  }
}

/**
 * Apple accepte-t-il NOTRE clé ? On le lui demande pour de bon, avant de
 * laisser l'app vendre.
 *
 * Une clé mal collée (le secret tronqué à sa première ligne), un identifiant
 * faux, une clé révoquée : `applePret()` dit oui, la feuille d'Apple encaisse,
 * et le serveur ne peut rien vérifier — de l'argent pris pour rien, jusqu'à ce
 * que quelqu'un s'en aperçoive. Refus, panne d'Apple, clé illisible : pas
 * d'offre, plutôt qu'une offre qui encaisse sans débloquer. Le journal du
 * Worker dit lequel (`npx wrangler tail`, lignes « [apple] »).
 *
 * LA PRODUCTION D'ABORD, ET LE BAC À SABLE SI ELLE REFUSE. Tant que l'app
 * n'est jamais sortie, la production refuse tout (voir en tête) : si le bac
 * à sable accepte la clé, elle est bonne, et l'on ouvre — c'est ainsi que
 * TestFlight et la validation d'Apple peuvent acheter. Une clé vraiment
 * fausse est refusée des deux côtés. `production` dit si la production a
 * accepté : faux avant la sortie, il DOIT passer à vrai après (/api/sante).
 * Une PANNE de la production, elle, ferme : les vrais achats en dépendent.
 *
 * Gardé en mémoire : une heure quand c'est oui (une clé ne se révoque pas
 * toutes les heures), une minute quand c'est non (une panne d'Apple passe).
 * Et oublié dès qu'une vraie lecture échoue (`lireTransactionApple`) : après
 * un achat qu'on n'a pas pu vérifier, on ne laisse pas en lancer un autre
 * sans avoir redemandé. `frais` : redemander de toute façon (/api/sante).
 * En développement, rien n'est gardé : les essais changent le faux Apple
 * d'une ligne à l'autre.
 */
let sonde: { le: number; ok: boolean; production: boolean; pour: string } | null = null
export async function sonderApple(frais = false): Promise<{ ok: boolean; production: boolean }> {
  if (!applePret()) return { ok: false, production: false }
  const r = reglages()
  const pour = `${r.cleId}|${r.emetteur}|${r.paquet}|${r.cle.length}|${r.hotes.Production}|${r.hotes.Sandbox}`
  const duree = import.meta.dev ? 0 : sonde?.ok ? 3_600_000 : 60_000
  if (!frais && sonde && sonde.pour === pour && Date.now() - sonde.le < duree) return sonde
  const production = await avisDe('Production')
  const bac = production === 'refus' ? await avisDe('Sandbox') : null
  const ok = production === 'oui' || bac === 'oui'
  if (bac === 'oui') {
    console.warn('[apple] la production refuse la clé, le bac à sable l’accepte : normal tant que l’app n’est jamais sortie sur l’App Store, anormal après')
  } else if (production === 'refus') {
    console.error('[apple] clé refusée par la production ET par le bac à sable : la clé, son identifiant, l’émetteur ou l’identifiant de l’app sont faux — ou l’app n’existe pas encore dans App Store Connect')
  }
  sonde = { le: Date.now(), ok, production: production === 'oui', pour }
  return sonde
}
export async function appleRepond(): Promise<boolean> {
  return (await sonderApple()).ok
}

// --- lire une transaction chez Apple -----------------------------------------

/** Ce qu'on lit d'une transaction (JWSTransactionDecodedPayload, en partie). */
export interface TransactionApple {
  transactionId: string
  bundleId?: string
  productId?: string
  environment?: string
  appAccountToken?: string
  /** Instants en millisecondes. */
  purchaseDate?: number
  revocationDate?: number
  revocationType?: string
  /** En millièmes de pour cent : 100000 = tout. */
  revocationPercentage?: number
}

/**
 * Le contenu d'un jeton signé d'Apple, SANS en vérifier la signature. À ne
 * croire que s'il vient d'être reçu d'Apple (lireTransactionApple) ; pour une
 * notification, il ne sert qu'à savoir QUELLE transaction relire.
 */
export function contenuJws(jws: unknown): any | null {
  if (typeof jws !== 'string') return null
  const morceaux = jws.split('.')
  if (morceaux.length !== 3 || !morceaux[1]) return null
  try {
    const o = JSON.parse(deB64url(morceaux[1]))
    return o && typeof o === 'object' ? o : null
  } catch { return null }
}

/**
 * Relit une transaction chez Apple, en production puis dans le bac à sable.
 * Trois réponses, et pas deux :
 *  - elle est quelque part : la voici ;
 *  - INCONNUE des deux côtés (null) ;
 *  - ON NE SAIT PAS (`achat_indisponible`) : une panne, ou un des deux côtés
 *    nous a refusés sans que l'autre la connaisse — la production refuse tout
 *    tant que l'app n'est jamais sortie, et l'on ne peut alors pas dire d'une
 *    transaction absente du bac à sable qu'elle n'existe pas. On ne débloque
 *    rien sur un doute, et l'on ne dit pas non plus « inconnue » : l'app garde
 *    la transaction et la représentera.
 */
export async function lireTransactionApple(id: string): Promise<TransactionApple | null> {
  if (!TRANSACTION_APPLE.test(id)) return null
  if (!applePret()) throw createError({ statusCode: 503, statusMessage: 'paiement_non_configure' })
  const r = reglages()
  // On ne sait plus si la porte s'ouvre : `appleRepond` le redemandera.
  const indisponible = () => { sonde = null; return createError({ statusCode: 502, statusMessage: 'achat_indisponible' }) }
  /** Un environnement nous a refusés : lui, on n'a pas pu l'interroger. */
  let refus: string | null = null
  for (const env of ['Production', 'Sandbox'] as Environnement[]) {
    let rep: Response
    try {
      rep = await fetch(`${r.hotes[env]}/inApps/v1/transactions/${id}`, {
        headers: { authorization: `Bearer ${await jetonApi()}`, accept: 'application/json' }
      })
    } catch (err) {
      console.error('[apple] injoignable', env, String((err as any)?.message ?? err))
      throw indisponible()
    }
    // Inconnue ICI (404), ou numéro que cet environnement tient pour mal formé
    // (400) : la transaction est peut-être de l'autre.
    if (rep.status === 404 || rep.status === 400) continue
    // Refusés ICI. De la production, c'est la réponse à tout tant que l'app
    // n'est jamais sortie : le bac à sable connaît peut-être la transaction.
    if (rep.status === 401 || rep.status === 403) {
      refus ??= `${env} ${rep.status} ${(await rep.text().catch(() => '')).slice(0, 200)}`
      continue
    }
    if (!rep.ok) {
      // On ne renvoie rien de cela au navigateur ; les journaux le disent.
      console.error('[apple]', env, rep.status, (await rep.text().catch(() => '')).slice(0, 300))
      throw indisponible()
    }
    const corps: any = await rep.json().catch(() => null)
    const t = contenuJws(corps?.signedTransactionInfo)
    if (!t || String(t.transactionId ?? '') !== id) {
      console.error('[apple] réponse illisible', env)
      throw createError({ statusCode: 502, statusMessage: 'achat_indisponible' })
    }
    return { ...t, transactionId: id, environment: t.environment === 'Sandbox' ? 'Sandbox' : 'Production' }
  }
  if (refus) {
    console.error('[apple] transaction introuvable, et la clé a été refusée :', refus)
    throw indisponible()
  }
  return null
}

// --- débloquer, reprendre ----------------------------------------------------

/**
 * Remboursée en entier ? Comme pour Stripe (reprendrePaiement), un
 * remboursement partiel — un geste — laisse la liste ouverte.
 */
function rembourseeEnEntier(t: TransactionApple): boolean {
  if (!t.revocationDate) return false
  if (t.revocationType === 'REFUND_PRORATED') return false
  return t.revocationPercentage == null || t.revocationPercentage >= 100000
}

export interface EtatAchatApple {
  /** `applique` : la liste est débloquée par cet achat. `avance` : payé, pas
   *  appliqué (la liste l'était déjà, ou n'existe plus) — il servira à une
   *  autre. `rembourse` : Apple a rendu l'argent. */
  etat: 'applique' | 'avance' | 'rembourse'
  groupe: number | null
}

/** Les deux instructions qui appliquent un achat à la liste qu'il vise. */
function appliquer(transaction: string, bac: boolean): Instruction[] {
  return [
    // `paye_le is null` : un second passage, ou la liste débloquée entre-temps
    // par l'autre parent, ne réécrit rien. L'acheteur a pu effacer son compte :
    // la clé étrangère refuserait son id, on ne le note alors pas.
    [`update groupes set paye_le = ${MAINTENANT},
                         paye_par = (select u.id from achats_apple a join utilisateurs u on u.id = a.user_id
                                      where a.transaction_id = ?1),
                         offert = ?2, paiement_ref = ?3,
                         paiement_en_cours_par = null, paiement_en_cours_session = null,
                         paiement_en_cours_jusqu = null
       where paye_le is null
         and id = (select a.groupe_id from achats_apple a
                    where a.transaction_id = ?1 and a.applique_le is null and a.rembourse_le is null)`,
      [transaction, bac, REF(transaction)]],
    [`update achats_apple set applique_le = ${MAINTENANT}
       where transaction_id = ?1 and applique_le is null
         and exists (select 1 from groupes g
                      where g.id = achats_apple.groupe_id and g.paiement_ref = ?2 and g.paye_le is not null)`,
      [transaction, REF(transaction)]]
  ]
}

/**
 * Met la base d'accord avec ce qu'Apple dit d'une transaction. Un seul
 * endroit, trois appelants : l'app qui vient d'acheter, l'app qui retrouve au
 * lancement une transaction restée en suspens, et le courrier d'Apple
 * (remboursement). Rejouable autant qu'on veut : la même transaction ne
 * débloque qu'une liste, une fois.
 *
 * `appelant` : le compte connecté, s'il y en a un. Il ne sert que si la
 * transaction ne porte aucun jeton connu (un achat lancé hors de notre
 * parcours) : l'achat lui revient alors, d'avance.
 */
export async function synchroniserApple(t: TransactionApple, appelant: string | null): Promise<EtatAchatApple> {
  const tx = t.transactionId
  if (rembourseeEnEntier(t)) {
    // Les votes ne bougent pas : on retire le déblocage, pas les données.
    const r = await lot([
      [`update achats_apple set rembourse_le = coalesce(rembourse_le, ${MAINTENANT}) where transaction_id = ?1`, [tx]],
      [`update groupes set paye_le = null, paye_par = null, offert = 0
         where paiement_ref = ?1 and paye_le is not null returning id`, [REF(tx)]]
    ])
    const gid = r[1]!.rows[0]?.id
    return { etat: 'rembourse', groupe: gid === undefined ? null : Number(gid) }
  }

  const jeton = typeof t.appAccountToken === 'string' && t.appAccountToken ? t.appAccountToken.toLowerCase() : null
  const bac = t.environment === 'Sandbox'
  const acheteLe = new Date(Number(t.purchaseDate) || Date.now()).toISOString()
  await lot([
    // L'intention devient un achat : c'est le jeton rendu par Apple qui
    // désigne la ligne, donc la liste et l'acheteur.
    [`update achats_apple set transaction_id = ?1, environnement = ?3, produit = ?4, achete_le = ?5
       where jeton = ?2 and transaction_id is null
         and not exists (select 1 from achats_apple a where a.transaction_id = ?1)`,
      [tx, jeton, t.environment ?? null, t.productId ?? null, acheteLe]],
    // Aucun jeton connu : l'achat revient à qui le présente, d'avance.
    [`insert into achats_apple (user_id, transaction_id, environnement, produit, achete_le)
       select (select id from utilisateurs where id = ?2), ?1, ?3, ?4, ?5
        where not exists (select 1 from achats_apple where transaction_id = ?1)`,
      [tx, appelant, t.environment ?? null, t.productId ?? null, acheteLe]],
    // Un remboursement qu'Apple a annulé : l'achat vaut de nouveau, et se
    // réapplique (la liste avait été reprise).
    [`update achats_apple set rembourse_le = null, applique_le = null
       where transaction_id = ?1 and rembourse_le is not null`, [tx]],
    ...appliquer(tx, bac)
  ])
  const a = await q1<{ groupe_id: number | null; applique_le: string | null }>(
    `select groupe_id, applique_le from achats_apple where transaction_id = ?1`, [tx])
  if (a?.applique_le) return { etat: 'applique', groupe: a.groupe_id === null ? null : Number(a.groupe_id) }
  return { etat: 'avance', groupe: null }
}

/**
 * Un déblocage payé et jamais appliqué sert à cette liste. On relit d'abord
 * la transaction chez Apple : un achat remboursé entre-temps ne débloque rien.
 * Vrai si la liste vient d'être débloquée ainsi.
 */
export async function utiliserAvanceApple(uid: string, gid: number): Promise<boolean> {
  const avances = await q<{ transaction_id: string }>(
    `select transaction_id from achats_apple
      where user_id = ?1 and transaction_id is not null and applique_le is null and rembourse_le is null
      order by achete_le limit 3`, [uid])
  for (const a of avances) {
    const t = await lireTransactionApple(a.transaction_id)
    if (!t) continue
    if (rembourseeEnEntier(t)) { await synchroniserApple(t, uid); continue }
    await lot([
      [`update achats_apple set groupe_id = ?2
         where transaction_id = ?1 and user_id = ?3 and applique_le is null and rembourse_le is null`,
        [a.transaction_id, gid, uid]],
      ...appliquer(a.transaction_id, t.environment === 'Sandbox')
    ])
    const fait = await q1<{ ok: number }>(
      `select 1 as ok from achats_apple where transaction_id = ?1 and groupe_id = ?2 and applique_le is not null`,
      [a.transaction_id, gid])
    if (fait) return true
  }
  return false
}
