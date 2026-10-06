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
