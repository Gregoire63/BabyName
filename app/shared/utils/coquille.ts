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
  /**
   * Le téléphone est-il en sombre ? L'app le dit, à la suite de sa marque :
   *
   *     … babyNamedApp/1.0.0 (android) apparence/sombre
   *
   * LA PAGE NE PEUT PAS LE SAVOIR SEULE. Dans une vue web, la question
   * `prefers-color-scheme` ne suit pas toujours le téléphone : celle d'Android
   * répond d'après le thème de l'app qui l'héberge, et disait « clair » sur un
   * téléphone en sombre (vu le 07/10/2026). Le natif, lui, le sait ; il le
   * glisse ici parce que c'est le seul endroit lisible AVANT le premier
   * affichage, sur les deux systèmes. Absent : une app d'avant, on s'en remet
   * à la vue web. Le réglage « Système » de l'app s'en sert (useTheme).
   */
  apparence?: 'sombre' | 'claire'
}

const MOTIF = /\bbabyNamedApp\/(\d+(?:\.\d+){0,3}) \((ios|android)\)(?: apparence\/(sombre|claire)\b)?/

/** La coquille qui a envoyé cet agent utilisateur, ou null : un navigateur. */
export function coquilleDepuis(agent: string | null | undefined): Coquille | null {
  const m = MOTIF.exec(agent ?? '')
  if (!m) return null
  return {
    version: m[1]!, plateforme: m[2] as Coquille['plateforme'],
    ...(m[3] ? { apparence: m[3] as 'sombre' | 'claire' } : {})
  }
}
