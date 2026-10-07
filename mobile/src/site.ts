import { isRunningInExpoGo } from 'expo'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

/**
 * Le site que l'app affiche. Toujours https://babynamed.fr, sauf pour une
 * version d'essai construite avec EXPO_PUBLIC_SITE (un déploiement de test,
 * le serveur de développement d'une machine du réseau — voir LISEZMOI).
 */
export const ORIGINE = (process.env.EXPO_PUBLIC_SITE || 'https://babynamed.fr').replace(/\/+$/, '')

/** La version de l'app installée (app.json), pas celle du site. */
export const VERSION = Constants.expoConfig?.version ?? '1.0.0'

/**
 * Ce que l'app ajoute à son agent utilisateur : c'est à cela que le site la
 * reconnaît (app/shared/utils/coquille.ts) — pour ne rien y vendre, et pour
 * lui parler par le pont. À garder tel quel : « babyNamedApp/1.0.0 (ios) ».
 */
export const AGENT = `babyNamedApp/${VERSION} (${Platform.OS === 'ios' ? 'ios' : 'android'})`

/**
 * Le projet Expo (app.json → extra.eas.projectId, posé par `eas init`) : sans
 * lui, pas de jeton de notification — l'app marche, sans prévenir.
 */
export const PROJET_EAS: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined

/**
 * Expo Go : l'app d'essai d'Expo, qui fait tourner la coquille sans rien
 * construire (`npx expo start`). Tout n'y est pas : ni notifications (leur
 * module y arrête même l'app, voir notifications.ts), ni liens qui ouvrent
 * l'app, ni écran de démarrage réglable. Assez pour voir le site dans la vue
 * web ; le reste demande une vraie construction (LISEZMOI).
 */
export const EXPO_GO = isRunningInExpoGo()

/**
 * Une construction à inspecter : la vue web s'ouvre aux outils du navigateur
 * (chrome://inspect sur Android, Safari sur un Mac). Toujours en
 * développement ; ailleurs seulement si la construction le demande
 * (EXPO_PUBLIC_DEBOGAGE=1, le profil « preview » d'eas.json). Jamais en
 * production : n'importe qui, un câble branché, lirait la session.
 */
export const INSPECTABLE = __DEV__ || process.env.EXPO_PUBLIC_DEBOGAGE === '1'
