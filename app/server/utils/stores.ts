import { coquilleDepuis } from '../../shared/utils/coquille'

/**
 * Le lien court des réseaux, babynamed.fr/app (server/routes/app.ts) : où
 * envoyer quelqu'un selon son appareil.
 *
 * La bio TikTok n'a qu'un lien, et ce ne peut pas être celui de l'App Store :
 * sur Android, il ouvre une page web de l'App Store qui ne mène à rien — et la
 * plupart des téléphones, en France, sont sous Android. Le serveur lit donc
 * l'agent utilisateur et renvoie :
 *
 *  - iPhone, iPad : la page produit personnalisée « Vidéo de lancement »
 *    (App Store Connect → Pages produit personnalisées), celle qui montre la
 *    vidéo. App Store Connect y compte ses vues et ses téléchargements à part ;
 *  - Android : la fiche Google Play, la provenance en paramètres UTM (Play
 *    Console les range dans ses sources d'acquisition) ;
 *  - l'app des stores elle-même, si le lien y est touché : son accueil ;
 *  - le reste (ordinateur, iPad qui se dit Mac dans Safari) : le site, avec
 *    `?ref=`, la provenance qu'il garde à la première visite (useProvenance).
 *
 * Pourquoi pas le site sur téléphone : il n'a pas les notifications de l'app
 * (un accord qui prévient l'autre parent), et le navigateur intégré de TikTok
 * garde sa propre session, perdue au passage dans Safari ou Chrome.
 *
 * Fonction pure, sans Nitro : essais/essai-lien-app.mjs l'éprouve sans serveur.
 */

/** L'app iOS (App Store Connect → Informations sur l'app → Identifiant Apple). */
export const APP_STORE_ID = '6821347375'
/**
 * La page produit personnalisée « Vidéo de lancement », approuvée le
 * 02/11/2026. Supprimée ou désactivée, Apple montre la fiche ordinaire : le
 * lien ne casse pas.
 */
export const PAGE_PERSO_IOS = '319eac1d-1d80-4a0b-be58-46ec896ff85b'

export type Plateforme = 'ios' | 'android' | 'app' | 'autre'

export function cibleDuLien(agent: string | null | undefined, provenance: string, paquet: string)
  : { plateforme: Plateforme, adresse: string } {
  const ua = agent ?? ''
  // Avant tout le reste : l'app se présente aussi en iPhone ou en Android.
  if (coquilleDepuis(ua)) return { plateforme: 'app', adresse: '/' }
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) {
    // Sans pays dans l'adresse : l'App Store ouvre la vitrine de la personne
    // (France, Belgique, Suisse, Canada…).
    return { plateforme: 'ios', adresse: `https://apps.apple.com/app/id${APP_STORE_ID}?ppid=${PAGE_PERSO_IOS}` }
  }
  if (/\bAndroid\b/i.test(ua)) {
    const referrer = encodeURIComponent(`utm_source=${provenance}&utm_medium=lien`)
    return {
      plateforme: 'android',
      adresse: `https://play.google.com/store/apps/details?id=${encodeURIComponent(paquet)}&referrer=${referrer}`
    }
  }
  return { plateforme: 'autre', adresse: `/?ref=${encodeURIComponent(provenance)}` }
}
