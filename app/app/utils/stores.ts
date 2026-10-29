/**
 * Les applications mobiles, pour les liens du site (BadgesStores.vue).
 * Mêmes adresses que les pages publiques (scripts/seo.mjs). Vide = pas
 * (encore) publique : le bouton n'apparaît pas. Les deux fiches sont
 * publiques depuis le 29/10/2026.
 */
export const APP_IOS = 'https://apps.apple.com/fr/app/id6821347375'
export const APP_ANDROID = 'https://play.google.com/store/apps/details?id=fr.babynamed.app'

/** Le système du visiteur : iPhone/iPad, Android, ou autre (ordinateur). */
export function systemeVisiteur(): 'ios' | 'android' | 'autre' {
  if (typeof navigator === 'undefined') return 'autre'
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  // Un iPad récent se dit « Macintosh » : on le reconnaît à l'écran tactile.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return 'autre'
}
