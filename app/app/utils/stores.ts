/**
 * Les applications mobiles, pour les liens du site (BadgesStores.vue).
 * Mêmes adresses que les pages publiques (scripts/seo.mjs). Vide = pas
 * (encore) publique : le bouton n'apparaît pas. Google Play reste vide tant
 * que l'app n'est qu'en test fermé — la fiche n'existe que pour les testeurs.
 */
export const APP_IOS = 'https://apps.apple.com/fr/app/id6821347375'
export const APP_ANDROID = ''
/** Tant que la fiche Play n'est pas publique : le groupe des testeurs (bêta). */
export const ANDROID_BETA = 'https://groups.google.com/g/babynamed-testeurs'

/** Le système du visiteur : iPhone/iPad, Android, ou autre (ordinateur). */
export function systemeVisiteur(): 'ios' | 'android' | 'autre' {
  if (typeof navigator === 'undefined') return 'autre'
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  // Un iPad récent se dit « Macintosh » : on le reconnaît à l'écran tactile.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return 'autre'
}
