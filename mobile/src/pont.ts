/**
 * Le pont entre la page et le natif — la liste des verbes, et rien d'autre.
 *
 * La page (le site, dans la vue web) et le natif se parlent par messages
 * JSON. Le natif ne sait RIEN du produit : il prête au site ce qu'un
 * navigateur n'a pas — les notifications, la feuille de partage, le vibreur,
 * le bouton « Retour » d'Android. Une mise à jour des stores prend des jours,
 * une mise en ligne du site une minute : tout ce qui peut vivre là-bas y vit.
 *
 * La même liste est tenue côté site, dans app/app/composables/useCoquille.ts :
 * à garder identiques. Un verbe inconnu est ignoré, des deux côtés — on peut
 * en ajouter sans casser les apps déjà installées.
 *
 * L'ACCUSÉ DE RÉCEPTION. Le natif ne voit pas la page : elle peut être en
 * train de se charger, ou son processus avoir été tué par le téléphone
 * pendant que l'app dormait — et un message remis à une page absente est un
 * message perdu, sans erreur nulle part. Chaque message du natif revient donc
 * avec un accusé (`accuse`) : « entendu », « personne n'écoute », ou rien du
 * tout, et c'est que la page n'est plus là. Ce n'est pas un verbe du site :
 * c'est le script même qui remet le message (`scriptPour`) qui le poste. Le
 * site n'a rien à faire pour cela, et n'en sait rien.
 *
 * Fichier sans dépendance, exprès : il s'essaie seul (tests/), sans téléphone.
 */

/** Ce que la page dit. */
export type MessagePage =
  /** La page a affiché quelque chose (on retire l'écran de démarrage), ou
   *  change de thème : ses couleurs pour la barre d'état. `bords: 'page'` :
   *  elle sait passer elle-même sous la barre d'état et l'encoche. */
  | { type: 'pret' | 'theme'; sombre: boolean; fond: string; bords: 'natif' | 'page' }
  /** Où en sont les notifications ? Sans rien demander, ou en demandant. */
  | { type: 'push.etat' | 'push.demander'; id: string }
  /** La feuille de partage du téléphone. */
  | { type: 'partager'; id: string; titre: string; texte: string; url: string }
  /** Un fichier à enregistrer ou à envoyer (une page n'y télécharge rien). */
  | { type: 'fichier'; id: string; nom: string; mime: string; texte: string }
  | { type: 'vibrer'; genre: 'succes' | 'leger' }
  /** Les réglages du téléphone, pour cette app. */
  | { type: 'reglages' }
  /** Sortir de l'app (Android : la réponse à `retour`, depuis l'accueil). */
  | { type: 'quitter' }
  // L'achat intégré de l'App Store (iPhone seulement ; achats.ts). C'est la
  // page qui nomme le produit : en changer ne demande pas de nouvelle app.
  /** Le prix du produit, tel qu'Apple le formule. */
  | { type: 'achat.produit'; id: string; produit: string }
  /** Ouvrir la feuille d'achat. `jeton` : l'UUID tiré par le serveur du site,
   *  qu'Apple rendra dans la transaction — c'est lui qui dit quoi débloquer. */
  | { type: 'achat.acheter'; id: string; produit: string; jeton: string }
  /** Les transactions payées que le site n'a pas encore dit avoir traitées. */
  | { type: 'achat.attente'; id: string }
  /** Le site a traité cette transaction : StoreKit peut l'oublier. */
  | { type: 'achat.finir'; id: string; transaction: string }

/** Ce que le natif dit. Une réponse reprend l'`id` de la question. */
export type MessageNatif =
  /** Un lien a ouvert l'app, ou une notification a été touchée. */
  | { type: 'lien'; url: string }
  /** L'app revient au premier plan. */
  | { type: 'actif' }
  /** Le bouton « Retour » d'Android : à la page de dire ce qu'il ferme. */
  | { type: 'retour' }
  | { type: 'push.etat' | 'push.demander'; id: string; ok: boolean;
      permission?: 'accordee' | 'refusee' | 'indeterminee'; jeton?: string }
  | { type: 'partager' | 'fichier'; id: string; ok: boolean }
  // L'achat intégré. `ok: false` : pas d'achat sur ce téléphone (Android, Expo
  // Go), ou on n'a pas pu savoir.
  | { type: 'achat.produit'; id: string; ok: boolean; prix?: string }
  | { type: 'achat.acheter'; id: string; ok: boolean;
      etat?: 'achete' | 'annule' | 'attente' | 'erreur'; transaction?: string }
  | { type: 'achat.attente'; id: string; ok: boolean; transactions?: { id: string; produit: string; le?: number }[] }
  | { type: 'achat.finir'; id: string; ok: boolean }
  /** Une transaction vient d'arriver sans qu'on l'ait achetée à l'instant
   *  (un achat validé plus tard par un tiers) : la page viendra la chercher. */
  | { type: 'achat.arrivee' }

/**
 * L'accusé de réception d'un message du natif (plus haut). `de` : le verbe
 * accusé. `ecoute` : la page avait de quoi l'entendre — faux quand le
 * document est là mais que le site n'y a pas encore démarré.
 */
export type Accuse = { type: 'accuse'; de: string; ecoute: boolean }

/** Les couleurs de l'app avant que la page ait rien dit (celles du site). */
export const FOND_CLAIR = '#fbfaf9'
export const FOND_SOMBRE = '#101321'

const texte = (x: unknown, max: number): string => typeof x === 'string' ? x.slice(0, max) : ''
const identifiant = (x: unknown): string | null =>
  typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x) ? x : null

/** Un produit de l'App Store (« fr.babynamed.app.deblocage »). */
const produit = (x: unknown): string | null =>
  typeof x === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(x) ? x : null
/** Le jeton d'un achat : un UUID, la seule forme qu'Apple accepte et rende. */
const uuid = (x: unknown): string | null =>
  typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x) ? x.toLowerCase() : null
/** Un numéro de transaction d'Apple : des chiffres. */
const transaction = (x: unknown): string | null =>
  typeof x === 'string' && /^[0-9]{1,32}$/.test(x) ? x : null

/** Un nom de fichier sans chemin ni surprise : « babynamed-mes-donnees.json ». */
export function nomDeFichier(x: unknown): string {
  const propre = texte(x, 120).replace(/[^A-Za-z0-9._-]/g, '-').replace(/^[.-]+/, '').slice(0, 80)
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]{1,8}$/.test(propre) ? propre : 'babynamed.txt'
}

/**
 * Lit ce que la page envoie. Rend null pour tout ce qui n'est pas un verbe
 * connu et bien formé : on ne fait rien d'un message qu'on ne comprend pas.
 */
export function lireMessage(brut: string): MessagePage | Accuse | null {
  let m: any
  try { m = JSON.parse(brut) } catch { return null }
  if (!m || typeof m !== 'object' || typeof m.type !== 'string') return null
  switch (m.type) {
    case 'pret':
    case 'theme': {
      const sombre = m.sombre === true
      const fond = typeof m.fond === 'string' && /^#[0-9a-f]{6}$/i.test(m.fond)
        ? m.fond.toLowerCase() : (sombre ? FOND_SOMBRE : FOND_CLAIR)
      return { type: m.type, sombre, fond, bords: m.bords === 'page' ? 'page' : 'natif' }
    }
    case 'push.etat':
    case 'push.demander': {
      const id = identifiant(m.id)
      return id ? { type: m.type, id } : null
    }
    case 'partager': {
      const id = identifiant(m.id)
      const url = texte(m.url, 2000)
      if (!id || !/^https?:\/\/[^\s]+$/.test(url)) return null
      return { type: 'partager', id, titre: texte(m.titre, 200), texte: texte(m.texte, 2000), url }
    }
    case 'fichier': {
      const id = identifiant(m.id)
      // Cinq millions de caractères : très au-delà d'un export de compte.
      if (!id || typeof m.texte !== 'string' || !m.texte || m.texte.length > 5_000_000) return null
      const mime = /^[a-z]+\/[a-z0-9.+-]+$/i.test(texte(m.mime, 80)) ? m.mime : 'text/plain'
      return { type: 'fichier', id, nom: nomDeFichier(m.nom), mime, texte: m.texte }
    }
    case 'vibrer':
      return { type: 'vibrer', genre: m.genre === 'succes' ? 'succes' : 'leger' }
    case 'reglages':
      return { type: 'reglages' }
    case 'quitter':
      return { type: 'quitter' }
    case 'achat.produit': {
      const id = identifiant(m.id), p = produit(m.produit)
      return id && p ? { type: 'achat.produit', id, produit: p } : null
    }
    case 'achat.acheter': {
      const id = identifiant(m.id), p = produit(m.produit), jeton = uuid(m.jeton)
      return id && p && jeton ? { type: 'achat.acheter', id, produit: p, jeton } : null
    }
    case 'achat.attente': {
      const id = identifiant(m.id)
      return id ? { type: 'achat.attente', id } : null
    }
    case 'achat.finir': {
      const id = identifiant(m.id), t = transaction(m.transaction)
      return id && t ? { type: 'achat.finir', id, transaction: t } : null
    }
    case 'accuse':
      return { type: 'accuse', de: texte(m.de, 40), ecoute: m.ecoute === true }
    default:
      return null
  }
}

/**
 * Le script à faire exécuter par la page pour lui remettre un message, et en
 * rapporter l'accusé de réception — même si la page ne l'écoute pas, même si
 * elle échoue en le traitant (`finally`).
 *
 * Le message voyage en texte JSON (deux fois sérialisé : rien de ce qu'il
 * contient ne peut sortir de sa chaîne). `true` à la fin : la vue web d'iOS
 * réclame une valeur.
 */
export function scriptPour(m: MessageNatif): string {
  const message = JSON.stringify(JSON.stringify(m))
  const accuse = (ecoute: boolean) => JSON.stringify(JSON.stringify({ type: 'accuse', de: m.type, ecoute }))
  return '(function(w){'
    + 'var f=w.__babyNamedNatif,p=w.ReactNativeWebView,e=typeof f==="function";'
    + `try{if(e)f(${message})}`
    + `finally{if(p&&p.postMessage)p.postMessage(e?${accuse(true)}:${accuse(false)})}`
    + '})(window);true;'
}
