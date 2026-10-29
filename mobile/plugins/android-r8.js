// @ts-check
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins')

/**
 * R8 au complet sur Android (Play Console, « Actions recommandées », 29/10/2026).
 *
 * expo-build-properties allume déjà la minification et la réduction des
 * ressources (app.json). Il restait deux choses que Play signale :
 *  - « L'optimisation n'est pas activée » : le gabarit d'Expo prend
 *    proguard-android.txt, qui coupe l'optimisation de R8. On prend
 *    proguard-android-optimize.txt à la place.
 *  - « La réduction optimisée des ressources n'est pas activée » :
 *    android.r8.optimizedResourceShrinking (AGP 8.6 et plus).
 *
 * Le dossier android/ n'est pas dans le dépôt (prebuild le refait à chaque
 * construction) : d'où ce plugin, plutôt qu'une retouche à la main.
 *
 * À VÉRIFIER après chaque montée d'Expo : un build « preview » qui démarre,
 * affiche le site, reçoit une notification et partage un lien. L'optimisation
 * peut casser une bibliothèque qui s'appuie sur la réflexion sans livrer ses
 * règles ProGuard.
 */
module.exports = function androidR8(config) {
  config = withAppBuildGradle(config, cfg => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /getDefaultProguardFile\(["']proguard-android\.txt["']\)/g,
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    )
    return cfg
  })
  config = withGradleProperties(config, cfg => {
    const cle = 'android.r8.optimizedResourceShrinking'
    cfg.modResults = cfg.modResults.filter(p => !(p.type === 'property' && p.key === cle))
    cfg.modResults.push({ type: 'property', key: cle, value: 'true' })
    return cfg
  })
  return config
}
