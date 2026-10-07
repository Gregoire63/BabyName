import { Platform } from 'react-native'

import { EXPO_GO } from './site'

/**
 * L'achat intégré de l'App Store — iPhone seulement.
 *
 * Le natif ne vend rien de lui-même et ne sait pas ce qu'il vend : c'est la
 * page qui nomme le produit, et le serveur du site qui décide de ce qu'un
 * achat débloque. Ici, quatre gestes prêtés à la page (pont.ts) :
 *  - le PRIX d'un produit, tel qu'Apple le formule (« 7,99 € ») ;
 *  - ACHETER : la feuille d'achat d'Apple, avec le jeton que le serveur a tiré
 *    pour cette liste — Apple le rend dans la transaction signée, et c'est par
 *    lui que le serveur saura quoi débloquer ;
 *  - les transactions EN SUSPENS : payées, et que le site n'a pas encore dit
 *    avoir traitées ;
 *  - FINIR une transaction, quand le site l'a traitée.
 *
 * ON NE FINIT JAMAIS UNE TRANSACTION DE SOI-MÊME. Tant qu'elle n'est pas
 * finie, StoreKit la garde et la représente à chaque lancement : c'est ce qui
 * rattrape l'app fermée entre le paiement et le déblocage (plus de réseau,
 * plus de batterie, la page tuée sous la feuille d'Apple). La finir avant que
 * le serveur ait répondu, c'est perdre l'argent de quelqu'un.
 *
 * Android : rien. Le module n'y est même pas compilé (package.json,
 * « autolinking ») — l'app Android ne vend pas, et ne porte donc ni la
 * bibliothèque de facturation de Google ni sa permission. Expo Go : rien non
 * plus, le module n'y existe pas. D'où le chargement à la main, comme pour les
 * notifications : ailleurs que sur un iPhone construit pour de bon, le seul
 * fait de le charger arrêterait l'app.
 */
type Iap = typeof import('expo-iap')
/** Une transaction telle que StoreKit la rend. `finir` en a besoin entière. */
type Achat = { id?: unknown; productId?: unknown; appAccountToken?: unknown; transactionDate?: unknown }

const iap: Iap | null = Platform.OS === 'ios' && !EXPO_GO ? require('expo-iap') : null

/** Comment la feuille d'achat s'est refermée. */
export type IssueAchat =
  /** Payé. La transaction reste en suspens jusqu'à `finir`. */
  | { etat: 'achete'; transaction: string }
  /** Refermée sans acheter. */
  | { etat: 'annule' }
  /** À valider par un tiers (partage familial, banque) : elle arrivera plus tard. */
  | { etat: 'attente' }
  | { etat: 'erreur' }

/** Un numéro de transaction d'Apple : des chiffres. */
const numero = (a: Achat | null | undefined): string | null =>
  a && (typeof a.id === 'string' || typeof a.id === 'number') && /^[0-9]{1,32}$/.test(String(a.id)) ? String(a.id) : null

/** Les transactions que StoreKit nous a montrées, par numéro. */
const connues = new Map<string, Achat>()
/** Celles qu'un achat lancé d'ici a déjà rendues à la page. */
const remises = new Set<string>()
/** Des feuilles d'achat ouvertes d'ici, dont on attend l'issue. */
let enVol = 0

/** La boutique, ouverte une fois. Une panne ne reste pas : on réessaiera. */
let connexion: Promise<boolean> | null = null
function connecter(): Promise<boolean> {
  if (!iap) return Promise.resolve(false)
  connexion ??= iap.initConnection().then(ok => ok !== false).catch(() => false)
  return connexion.then((ok) => { if (!ok) connexion = null; return ok })
}

/**
 * Une transaction arrivée sans qu'on l'ait demandée à l'instant : un achat
 * validé plus tard par un tiers, repris par StoreKit. La page n'en sait rien
 * tant qu'on ne le lui dit pas (`achat.arrivee`) — elle viendra alors
 * chercher les transactions en suspens. L'issue d'un achat lancé d'ici part,
 * elle, par sa propre réponse : pas d'annonce en double.
 */
const abonnes = new Set<() => void>()
iap?.purchaseUpdatedListener((achat) => {
  const id = numero(achat as Achat)
  if (!id) return
  connues.set(id, achat as Achat)
  if (enVol || remises.has(id)) return
  for (const f of abonnes) { try { f() } catch { /* un abonné fautif n'arrête pas les autres */ } }
})
export function surArrivee(f: () => void): () => void {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

/** Le prix du produit, tel qu'Apple le formule pour ce compte. Null : pas de vente ici. */
export async function prixDuProduit(produit: string): Promise<string | null> {
  try {
    if (!iap || !(await connecter())) return null
    const produits = await iap.fetchProducts({ skus: [produit], type: 'in-app' }) as
      { id?: unknown; displayPrice?: unknown }[] | null
    const p = (produits ?? []).find(x => x?.id === produit)
    return typeof p?.displayPrice === 'string' && p.displayPrice ? p.displayPrice : null
  } catch { return null }
}

/** Une transaction en suspens, telle qu'on la rend à la page. `le` : la date de l'achat (ms), si StoreKit la donne. */
export type EnSuspens = { id: string; produit: string; le?: number }

/**
 * Les transactions payées et pas encore finies. Null : on n'a pas pu le
 * savoir (la page redemandera).
 */
export async function enSuspens(): Promise<EnSuspens[] | null> {
  try {
    if (!iap || !(await connecter())) return null
    const vues: EnSuspens[] = []
    for (const a of (await iap.getPendingTransactionsIOS() ?? []) as Achat[]) {
      const id = numero(a)
      if (!id) continue
      connues.set(id, a)
      vues.push({
        id, produit: typeof a.productId === 'string' ? a.productId : '',
        ...(typeof a.transactionDate === 'number' ? { le: a.transactionDate } : {})
      })
    }
    return vues
  } catch { return null }
}

/**
 * L'achat est-il passé malgré une issue incompréhensible ? On cherche, parmi
 * les transactions en suspens, celle qui porte NOTRE jeton. Sans cela, une
 * erreur de transmission après le paiement se lirait « l'achat n'a pas pu se
 * faire » — et la personne paierait une seconde fois.
 */
async function retrouver(jeton: string): Promise<IssueAchat | null> {
  await enSuspens()
  for (const [id, a] of connues) {
    if (typeof a.appAccountToken === 'string' && a.appAccountToken.toLowerCase() === jeton.toLowerCase()) {
      remises.add(id)
      return { etat: 'achete', transaction: id }
    }
  }
  return null
}

/**
 * Ouvre la feuille d'achat d'Apple. `jeton` : l'UUID tiré par le serveur du
 * site (« appAccountToken »). Null : pas d'achat intégré sur ce téléphone.
 */
export async function acheter(produit: string, jeton: string): Promise<IssueAchat | null> {
  if (!iap) return null
  if (!(await connecter())) return { etat: 'erreur' }
  enVol++
  try {
    const rendu = await iap.requestPurchase({ request: { apple: { sku: produit, appAccountToken: jeton } }, type: 'in-app' })
    const achat = (Array.isArray(rendu) ? rendu[0] : rendu) as Achat | null | undefined
    const id = numero(achat)
    if (id) {
      connues.set(id, achat as Achat)
      remises.add(id)
      return { etat: 'achete', transaction: id }
    }
    return (await retrouver(jeton)) ?? { etat: 'erreur' }
  } catch (e) {
    const code = String((e as { code?: unknown } | null)?.code ?? '')
    if (code === 'user-cancelled') return { etat: 'annule' }
    if (code === 'deferred-payment') return { etat: 'attente' }
    return (await retrouver(jeton).catch(() => null)) ?? { etat: 'erreur' }
  } finally {
    enVol--
  }
}

/**
 * Le site a traité cette transaction : StoreKit peut l'oublier. Vrai aussi si
 * StoreKit ne la connaît plus — c'est ce qu'on voulait. Faux : elle reste en
 * suspens, et reviendra.
 */
export async function finir(transaction: string): Promise<boolean> {
  try {
    if (!iap || !(await connecter())) return false
    let achat = connues.get(transaction)
    if (!achat) {
      // L'app a redémarré depuis : on redemande à StoreKit ce qu'il garde.
      if (!(await enSuspens())) return false
      achat = connues.get(transaction)
    }
    if (!achat) return true
    // « Consommable » : le même produit se rachète pour la liste suivante.
    await iap.finishTransaction({ purchase: achat as never, isConsumable: true })
    connues.delete(transaction)
    remises.delete(transaction)
    return true
  } catch { return false }
}
