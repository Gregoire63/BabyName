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
 * Les langues de l'app (app.json « locales », langues/<code>.json) : sur
 * iPhone, elles disent à iOS quelles langues l'app parle — la vue web reçoit
 * celle qu'il retient (une autre que celles-là : l'anglais,
 * CFBundleDevelopmentRegion). Leur seul contenu, CFBundleDisplayName, est une
 * clé iOS : sur Android, prebuild en fait des chaînes res/values-b+<code> sans valeur par
 * défaut, et lint bloque le build release (ExtraTranslation, 11/10/2026).
 * EAS_BUILD_PLATFORM est posé par EAS sur la machine de build.
 *
 * L'orientation : « portrait » dans app.json vaut pour l'iPhone. Sur Android,
 * aucun verrou dans le manifeste (Android 16 l'ignore sur les grands écrans et
 * Play le signale) : le portrait des téléphones se pose à l'exécution
 * (src/orientation.ts).
 *
 * @param {import('expo/config').ConfigContext} contexte
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = ({ config }) => {
  const firebase = process.env.GOOGLE_SERVICES_JSON
    ?? (existsSync(join(__dirname, 'google-services.json')) ? './google-services.json' : undefined)
  const android = process.env.EAS_BUILD_PLATFORM === 'android'
  return {
    ...config,
    ...(android ? { locales: undefined, orientation: 'default' } : {}),
    name: config.name ?? 'babyNamed',
    slug: config.slug ?? 'babynamed',
    android: { ...config.android, ...(firebase ? { googleServicesFile: firebase } : {}) }
  }
}
