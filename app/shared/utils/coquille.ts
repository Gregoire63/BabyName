/**
 * La coquille : l'app des stores (iOS, Android), qui affiche CE site dans une
 * vue web — dossier `mobile/` du dépôt. Elle n'a pas de code d'écran à elle :
 * une mise en ligne ici vaut pour le web et pour les deux apps.
 *
 * On la reconnaît à ce qu'elle ajoute à son agent utilisateur :
 *
 *     … Mobile/15E148 babyNamedApp/1.0.0 (ios)
 *
 * Partagé entre l'app (ce qu'on montre) et le serveur (ce qu'on refuse) :
 * dans une app des stores, LA CAISSE DU SITE N'EXISTE PAS, et rien n'y mène —
 * ni bouton, ni lien, ni code cadeau. Un lien vers un paiement web y est
 * exactement ce qu'Apple et Google taxent et font déclarer (voir LISEZMOI,
 * « Les apps des stores »). Sur iPhone, une liste se débloque par l'achat
 * intégré de l'App Store ; sur Android, seulement depuis le site. Débloquée
 * quelque part, elle l'est partout.
 *
 * Ce n'est pas une barrière de sécurité : n'importe quel navigateur peut
 * s'annoncer ainsi, et n'y gagne que des écrans d'achat en moins.
 */
export const MARQUE_COQUILLE = 'babyNamedApp'

export interface Coquille {
  plateforme: 'ios' | 'android'
  /** La version de l'app installée (pas celle du site), « 1.0.0 ». */
  version: string
}

const MOTIF = /\bbabyNamedApp\/(\d+(?:\.\d+){0,3}) \((ios|android)\)/

/** La coquille qui a envoyé cet agent utilisateur, ou null : un navigateur. */
export function coquilleDepuis(agent: string | null | undefined): Coquille | null {
  const m = MOTIF.exec(agent ?? '')
  return m ? { version: m[1]!, plateforme: m[2] as Coquille['plateforme'] } : null
}
