import { I18nManager } from 'react-native'

/**
 * Les rares textes que l'app dessine elle-même (l'écran hors ligne, Panne.tsx ;
 * les canaux de notification d'Android, notifications.ts), dans la langue du
 * téléphone. Tout le reste est le site, qui choisit sa langue lui-même
 * (app/composables/useLangue.ts) — et ces langues-ci sont les siennes.
 *
 * La langue : celle que donne Intl (Hermes la tient du système ; sur iPhone,
 * c'est celle que iOS a retenue pour l'app parmi celles d'app.json
 * « locales », réglage « Langue » de l'app compris), sinon celle d'Android
 * (I18nManager). Une langue que l'app ne parle pas : l'anglais, comme le site.
 */
export type Langue = 'fr' | 'en' | 'de' | 'nl' | 'sv' | 'nb' | 'pl' | 'lv'

export interface Textes {
  panneTitre: string
  panneTexte: string
  reessayer: string
  canalAccords: string
  canalActivite: string
}

export const TEXTES: Record<Langue, Textes> = {
  fr: {
    panneTitre: 'Pas de connexion',
    panneTexte: 'babyNamed n’a pas pu s’ouvrir. Vérifiez votre connexion, puis réessayez.',
    reessayer: 'Réessayer',
    canalAccords: 'Accords et invitations',
    canalActivite: 'Activité de vos listes'
  },
  en: {
    panneTitre: 'No connection',
    panneTexte: 'babyNamed couldn’t open. Check your connection, then try again.',
    reessayer: 'Try again',
    canalAccords: 'Matches and invitations',
    canalActivite: 'Activity in your lists'
  },
  de: {
    panneTitre: 'Keine Verbindung',
    panneTexte: 'babyNamed konnte nicht geöffnet werden. Prüfen Sie Ihre Verbindung und versuchen Sie es dann erneut.',
    reessayer: 'Erneut versuchen',
    canalAccords: 'Matches und Einladungen',
    canalActivite: 'Aktivität in Ihren Listen'
  },
  nl: {
    panneTitre: 'Geen verbinding',
    panneTexte: 'babyNamed kon niet worden geopend. Controleer uw verbinding en probeer het opnieuw.',
    reessayer: 'Opnieuw proberen',
    canalAccords: 'Matches en uitnodigingen',
    canalActivite: 'Activiteit in uw lijsten'
  },
  sv: {
    panneTitre: 'Ingen anslutning',
    panneTexte: 'babyNamed kunde inte öppnas. Kontrollera din anslutning och försök sedan igen.',
    reessayer: 'Försök igen',
    canalAccords: 'Matcher och inbjudningar',
    canalActivite: 'Aktivitet i era listor'
  },
  nb: {
    panneTitre: 'Ingen tilkobling',
    panneTexte: 'babyNamed kunne ikke åpnes. Sjekk tilkoblingen din, og prøv igjen.',
    reessayer: 'Prøv igjen',
    canalAccords: 'Matcher og invitasjoner',
    canalActivite: 'Aktivitet i listene deres'
  },
  pl: {
    panneTitre: 'Brak połączenia',
    panneTexte: 'Nie udało się otworzyć babyNamed. Sprawdź połączenie i spróbuj ponownie.',
    reessayer: 'Spróbuj ponownie',
    canalAccords: 'Dopasowania i zaproszenia',
    canalActivite: 'Aktywność na Waszych listach'
  },
  lv: {
    panneTitre: 'Nav savienojuma',
    panneTexte: 'babyNamed neizdevās atvērt. Pārbaudiet savienojumu un mēģiniet vēlreiz.',
    reessayer: 'Mēģināt vēlreiz',
    canalAccords: 'Sakritības un ielūgumi',
    canalActivite: 'Aktivitāte Jūsu sarakstos'
  }
}

/** « fr-FR », « nb_NO », « no » → la langue de l'app ; inconnue : l'anglais. */
export function langueDe(locale: string | null | undefined): Langue {
  let c = String(locale ?? '').slice(0, 2).toLowerCase()
  if (c === 'no' || c === 'nn') c = 'nb'          // norvégien : une seule forme, comme le site
  return Object.prototype.hasOwnProperty.call(TEXTES, c) ? c as Langue : 'en'
}

/** La locale du téléphone, telle qu'on peut la lire sans module natif de plus. */
function localeDuTelephone(): string | null {
  try {
    const l = Intl.DateTimeFormat().resolvedOptions().locale
    if (l) return l
  } catch { /* pas d'Intl : on demande à Android */ }
  try {
    return (I18nManager.getConstants() as { localeIdentifier?: string }).localeIdentifier ?? null
  } catch { return null }
}

/** La langue du téléphone, lue à chaque fois : elle peut changer pendant que l'app vit. */
export const langueDuTelephone = (): Langue => langueDe(localeDuTelephone())

/** Les textes dans la langue du téléphone (ou celle donnée). */
export const textes = (l: Langue = langueDuTelephone()): Textes => TEXTES[l]
