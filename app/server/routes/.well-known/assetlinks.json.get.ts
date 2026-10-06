/**
 * « Cette app est bien celle de ce site » — pour Android (voir le fichier
 * voisin, pour iOS : mêmes deux adresses, même raison).
 *
 * L'app Android ouvre elle-même https://babynamed.fr/rejoindre/… et
 * /connexion/app (ses filtres d'intention, mobile/app.config.ts) — à condition
 * que le site la reconnaisse ici, par l'empreinte SHA-256 du certificat qui la
 * signe. Deux empreintes en pratique : celle de Google Play (Play Console →
 * Intégrité de l'app → Signature) et celle de la clé d'envoi
 * (`eas credentials`), séparées par une virgule dans NUXT_ANDROID_EMPREINTES.
 * Sans elles : 404, et les liens s'ouvrent dans le navigateur.
 */
export default defineEventHandler((e) => {
  const config = useRuntimeConfig()
  const paquet = String(config.androidPaquet || '').trim()
  const empreintes = String(config.androidEmpreintes || '').split(',')
    .map(x => x.trim().toUpperCase()).filter(x => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x))
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(paquet) || !empreintes.length) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  setHeader(e, 'content-type', 'application/json')
  setHeader(e, 'cache-control', 'public, max-age=3600')
  return [{
    relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
    target: { namespace: 'android_app', package_name: paquet, sha256_cert_fingerprints: empreintes }
  }]
})
