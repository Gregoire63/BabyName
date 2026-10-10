// @ts-check
const { existsSync } = require('node:fs')
const { join } = require('node:path')

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
 *
 * En JavaScript et non en TypeScript : eas-cli, lancé par npx, lit ce fichier
 * avec sa propre version de @expo/config, qui ne savait pas lire `import type`
 * (« Unexpected token '{' », 10/10/2026).
 *
 * @param {import('expo/config').ConfigContext} contexte
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
  const firebase = process.env.GOOGLE_SERVICES_JSON
    ?? (existsSync(join(__dirname, 'google-services.json')) ? './google-services.json' : undefined)
  return {
    ...config,
    name: config.name ?? 'babyNamed',
    slug: config.slug ?? 'babynamed',
    android: { ...config.android, ...(firebase ? { googleServicesFile: firebase } : {}) }
  }
}
