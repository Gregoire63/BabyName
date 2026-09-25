/**
 * Les en-têtes de sécurité — une seule source pour les trois endroits qui les
 * posent : le module de build (fichiers statiques servis par Vercel), le
 * serveur en développement (server/middleware/entetes.ts), et la politique
 * de contenu de la coquille de l'app (server/plugins/securite.ts).
 *
 * Fichier simple, sans import automatique : le module de build le lit aussi.
 */

/** Pour toutes les réponses. */
export const ENTETES_COMMUNES: Record<string, string> = {
  // Un fichier est ce que son type dit : pas de « devinette » du navigateur,
  // qui peut transformer une image téléversée en script.
  'x-content-type-options': 'nosniff',
  // Aucun site tiers ne voit l'adresse complète d'une page de l'app (celle
  // d'un lien de connexion, par exemple) ; seulement le domaine.
  'referrer-policy': 'strict-origin-when-cross-origin',
  // L'app ne se laisse pas encadrer par un autre site (détournement de clic).
  'x-frame-options': 'DENY',
  // Rien de tout ça ne sert : on le coupe, pour l'app et tout ce qu'elle charge.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  // HTTPS seulement, deux ans, sous-domaines compris.
  'strict-transport-security': 'max-age=63072000; includeSubDomains'
}

const BASE_CSP = [
  "default-src 'self'",
  // Les styles en ligne restent permis : Vue en pose (attributs `style`), et
  // la page de chargement en embarque. Un style injecté ne vole rien ; c'est
  // le script qu'il faut tenir.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
]

/**
 * La politique de l'app : un script ne s'exécute que s'il vient du site ou
 * s'il porte le « nonce » tiré au sort pour CETTE page. Un script injecté
 * par une faille (XSS) n'a pas le nonce : il ne s'exécute pas. Il ne pourrait
 * donc ni lire un lien de connexion, ni créer une passkey pour quelqu'un
 * d'autre.
 */
export function politiqueApp(nonce: string): string {
  return [...BASE_CSP, `script-src 'self' 'nonce-${nonce}'`].join('; ')
}

/** Les pages statiques (fiches prénoms) : aucun script exécutable en ligne. */
export const POLITIQUE_STATIQUE = [...BASE_CSP, "script-src 'self'"].join('; ')

/** Les chemins des pages statiques générées par scripts/seo.mjs. */
export const PAGES_STATIQUES = '/(prenoms|prenom|lettre|origine|choisir-un-prenom-a-deux)(/.*)?'
