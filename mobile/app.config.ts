import type { ConfigContext, ExpoConfig } from 'expo/config'
import { existsSync } from 'node:fs'

/**
 * Tout ce qui est fixe est dans app.json — c'est lui que `eas init` complète
 * (l'identifiant du projet Expo). Ici, la seule chose qui dépend de la
 * machine : le fichier de Firebase, sans lequel Android ne reçoit aucune
 * notification.
 *
 * Il ne se committe pas (le dépôt est public). Sur EAS : une variable
 * d'environnement de type « fichier », GOOGLE_SERVICES_JSON. Sur une machine :
 * le fichier posé à côté de celui-ci, google-services.json. Absent, l'app se
 * construit quand même ; Android ne prévient simplement pas.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const firebase = process.env.GOOGLE_SERVICES_JSON
    ?? (existsSync(`${__dirname}/google-services.json`) ? './google-services.json' : undefined)
  return {
    ...config,
    name: config.name ?? 'babyNamed',
    slug: config.slug ?? 'babynamed',
    android: { ...config.android, ...(firebase ? { googleServicesFile: firebase } : {}) }
  }
}
