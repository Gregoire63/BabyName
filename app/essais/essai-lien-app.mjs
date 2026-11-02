/**
 * Le lien court des réseaux, babynamed.fr/app (server/utils/stores.ts), sans
 * navigateur ni serveur : le même module que la route, compilé ici par
 * esbuild.
 *
 * Ce qui se vérifie ici, avec de vrais agents utilisateurs (TikTok compris) :
 *  - un iPhone, un iPad, et le navigateur intégré de TikTok sur iPhone vont à
 *    la page produit personnalisée de l'App Store, sans pays dans l'adresse ;
 *  - un Android, et le navigateur intégré de TikTok sur Android, vont à
 *    Google Play, la provenance en UTM dans `referrer` ;
 *  - l'app des stores (qui se dit aussi iPhone ou Android) reste chez elle ;
 *  - un ordinateur, un iPad qui se dit Mac, un agent vide : le site, avec
 *    `?ref=` ;
 *  - la provenance suit (instagram), et ce qui n'est pas un mot ne passe pas.
 *
 *   node essais/essai-lien-app.mjs
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ok = [], ko = []
const dit = (c, m) => { (c ? ok : ko).push(m); console.log((c ? '  OK   ' : '  ECHEC') + '  ' + m) }

const esbuild = await import('esbuild')
const r = await esbuild.build({
  stdin: {
    contents: `import { cibleDuLien, APP_STORE_ID, PAGE_PERSO_IOS } from './server/utils/stores'
import { provenanceValide } from './server/utils/provenance'
globalThis.__lien = { cibleDuLien, APP_STORE_ID, PAGE_PERSO_IOS, provenanceValide }`,
    resolveDir: RACINE, loader: 'ts'
  },
  bundle: true, write: false, format: 'iife', target: 'es2019'
})
new Function(r.outputFiles[0].text)()
const { cibleDuLien, APP_STORE_ID, PAGE_PERSO_IOS, provenanceValide } = globalThis.__lien

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  tiktokIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR isDarkMode/0 WKWebView/1 RevealType/Dialog BytedanceWebview/d8a21c6',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  ipadMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.102 Mobile Safari/537.36',
  tiktokAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 trill_370504 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/37.5.4 ByteLocale/fr ByteFullLocale/fr Region/FR Spark/1.6.3 AppVersion/37.5.4 BytedanceWebview/d8a21c6',
  appIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 babyNamedApp/1.1.0 (ios) apparence/claire',
  appAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 babyNamedApp/1.1.0 (android) apparence/sombre',
  pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
}
const PAQUET = 'fr.babynamed.app'
const vers = (ua, p = 'tiktok') => cibleDuLien(ua, p, PAQUET)
const PAGE_APPLE = `https://apps.apple.com/app/id${APP_STORE_ID}?ppid=${PAGE_PERSO_IOS}`

const ios = ['iphone', 'tiktokIos', 'ipad'].map(k => vers(UA[k]))
dit(ios.every(c => c.plateforme === 'ios' && c.adresse === PAGE_APPLE),
  `iPhone, iPad et TikTok sur iPhone : la page produit personnalisée de l’App Store (${ios[1].adresse})`)
dit(!/apps\.apple\.com\/[a-z]{2}\//.test(PAGE_APPLE) && /^\d+$/.test(APP_STORE_ID) && /^[0-9a-f-]{36}$/.test(PAGE_PERSO_IOS),
  'sans pays dans l’adresse (l’App Store ouvre la vitrine de chacun), un identifiant et une page bien formés')

const andro = ['android', 'tiktokAndroid'].map(k => vers(UA[k]))
const play = new URL(andro[1].adresse, 'https://babynamed.fr')
dit(andro.every(c => c.plateforme === 'android' && c.adresse === andro[0].adresse)
    && play.origin + play.pathname === 'https://play.google.com/store/apps/details'
    && play.searchParams.get('id') === PAQUET
    && play.searchParams.get('referrer') === 'utm_source=tiktok&utm_medium=lien',
  `Android et TikTok sur Android : Google Play, la provenance en UTM (${play.searchParams.get('referrer')})`)

const app = ['appIos', 'appAndroid'].map(k => vers(UA[k]))
dit(app.every(c => c.plateforme === 'app' && c.adresse === '/'),
  'dans l’app des stores (qui se dit aussi iPhone ou Android) : son accueil, pas un store')

const site = [UA.pc, UA.ipadMac, '', undefined].map(u => vers(u))
dit(site.every(c => c.plateforme === 'autre' && c.adresse === '/?ref=tiktok'),
  'ordinateur, iPad qui se dit Mac, agent vide ou absent : le site, avec ?ref=tiktok')

const insta = [vers(UA.android, 'instagram'), vers(UA.pc, 'instagram')]
dit(new URL(insta[0].adresse, 'https://babynamed.fr').searchParams.get('referrer') === 'utm_source=instagram&utm_medium=lien'
    && insta[1].adresse === '/?ref=instagram',
  'un autre réseau (?ref=instagram) : sa provenance suit, sur Play comme sur le site')

dit(provenanceValide('Instagram') === 'instagram'
    && ['https://exemple.test', 'a b', '', '../x', ['tiktok'], 42].every(x => provenanceValide(x) === null),
  'une provenance qui n’est pas un mot (adresse, espace, tableau…) ne passe pas : la route prend alors tiktok')

console.log(`\n${ok.length} OK, ${ko.length} ECHEC`)
process.exit(ko.length ? 1 : 0)
