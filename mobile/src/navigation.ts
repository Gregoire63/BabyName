/**
 * Où s'ouvre une adresse : dans l'app, dehors, ou nulle part.
 *
 * L'app n'affiche que L'APP du site — l'accueil, la connexion, les listes,
 * les textes légaux. Tout le reste part dans le navigateur du téléphone : les
 * autres sites (la CNIL, un prestataire), une adresse e-mail, et les pages
 * PUBLIQUES de babynamed.fr elles-mêmes. Ce dernier point n'est pas un
 * détail : ces pages vendent, et rien ne se vend dans une app des stores
 * (voir app/shared/utils/coquille.ts, côté site).
 *
 * Comment les reconnaître sans tenir ici la carte du site — qui changerait
 * sans que l'app installée le sache : les pages de l'app n'ont ni barre
 * finale ni extension (« /g/12/swipe », « /connexion ») ; les pages
 * publiques sont des dossiers (« /prenoms/ », « /prenom/louise/ ») ou des
 * fichiers (« /sitemap.xml »). Une route ajoutée à l'app demain passe donc
 * sans mise à jour des stores.
 *
 * Fichier sans dépendance, exprès : il s'essaie seul (tests/), sans téléphone.
 */
export type Destination = 'app' | 'dehors' | 'rien'

/** Ce qu'on confie au téléphone sans y regarder de plus près. */
const VERS_UNE_AUTRE_APP = new Set(['mailto:', 'tel:', 'sms:'])

export function destination(adresse: string, origine: string): Destination {
  let u: URL
  try { u = new URL(adresse) } catch { return 'rien' }

  // Une page vide que la vue web s'ouvre à elle-même : sans effet, on laisse.
  if (u.protocol === 'about:') return 'app'
  if (VERS_UNE_AUTRE_APP.has(u.protocol)) return 'dehors'
  // javascript:, data:, blob:, file:, intent:… : rien de tout cela ne se suit.
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'rien'
  if (u.origin !== origine) return 'dehors'

  const chemin = u.pathname
  // L'API se lit, elle ne s'affiche pas : y naviguer remplacerait l'app par
  // du texte brut, sans retour possible.
  if (chemin.startsWith('/api/')) return 'rien'
  if (chemin === '/') return 'app'
  if (chemin.endsWith('/')) return 'dehors'
  const dernier = chemin.slice(chemin.lastIndexOf('/') + 1)
  return dernier.includes('.') ? 'dehors' : 'app'
}

/**
 * Un lien qui OUVRE l'app (lien universel, lien d'app Android) : l'adresse à
 * afficher, ou null s'il n'est pas pour elle. Le téléphone ne nous confie que
 * les deux adresses déclarées dans app.json — l'invitation et le lien de
 * connexion — mais on ne le croit pas sur parole.
 */
export function adresseDuLien(lien: string | null | undefined, origine: string): string | null {
  if (!lien) return null
  let u: URL
  try { u = new URL(lien) } catch { return null }
  if (u.origin !== origine || destination(u.href, origine) !== 'app') return null
  return u.href
}

/**
 * Une notification touchée porte un CHEMIN de l'app (« /g/12/communs »), posé
 * par le serveur du site. Rien d'autre qu'un chemin : ni « //ailleurs.fr »,
 * ni une adresse entière.
 */
export function adresseDuChemin(chemin: unknown, origine: string): string | null {
  if (typeof chemin !== 'string' || !/^\/(?!\/)[^\s\\]*$/.test(chemin) || chemin.length > 300) return null
  return adresseDuLien(origine + chemin, origine)
}
