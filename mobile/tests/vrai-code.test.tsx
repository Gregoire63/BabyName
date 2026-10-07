/**
 * L'app entière, avec le vrai code de ses bibliothèques.
 *
 * Partout ailleurs dans ces essais, la vue web et les modules d'Expo sont des
 * doublures : on y voit ce que la coquille leur demande, pas ce qu'ils en
 * font. Ici c'est leur propre code qui tourne, dans la version installée,
 * pour Android puis pour iOS — la vue web (react-native-webview), l'écran de
 * démarrage, les barres du téléphone, les liens, les notifications. N'est
 * remplacé que ce qui n'existe que sur un téléphone : le composant natif de
 * la vue web, par un témoin qui note ce qui lui arrive ; les modules natifs
 * d'Expo, par les doublures de jest-expo ; l'achat intégré, absent d'elles.
 *
 * D'abord : L'APP DÉMARRE, sans une erreur ni un avertissement.
 *
 * Ensuite : CE QUI ARRIVE AU CODE NATIF DE LA VUE WEB A LA FORME QU'IL
 * ATTEND. Ce code lit chaque réglage en le forçant au type écrit dans sa
 * spécification (RNCWebViewNativeComponent) : une liste, un oui ou non, un
 * mot, un nombre. Une autre forme, et l'app s'arrête à l'ouverture, avant son
 * premier écran. C'est arrivé le 07/10/2026 sur Android, au premier lancement
 * sur un vrai téléphone : `dataDetectorTypes="none"` — un mot, comme la
 * documentation l'écrit, que la vue web d'iOS change en liste et que celle
 * d'Android transmet tel quel (« String cannot be cast to ReadableArray »).
 *
 * La spécification est lue dans la bibliothèque elle-même : l'essai suit ses
 * mises à jour.
 *
 *     npm run essais
 */
import { readFileSync } from 'node:fs'

type Forme = 'liste' | 'oui-non' | 'mot' | 'nombre' | 'fonction' | 'objet'

/** La spécification du composant natif : pour chaque réglage, la forme que son code attend. */
function specification(): Record<string, Forme> {
  const texte = readFileSync(require.resolve('react-native-webview/lib/RNCWebViewNativeComponent.d.ts'), 'utf8')
  const lignes = texte.slice(texte.indexOf('export interface NativeProps')).split('\n')
  const formes: Record<string, Forme> = {}
  for (const ligne of lignes.slice(1)) {
    if (ligne.startsWith('}')) break                       // la fin de la spécification
    const m = ligne.match(/^ {4}(\w+)\??: (.+)$/)          // un réglage ; plus loin dans la marge, le détail d'un objet
    if (!m) continue
    const type = m[2]!.replace(/^WithDefault</, '')
    formes[m[1]!] = /^ReadonlyArray</.test(type) ? 'liste'
      : /^boolean\b/.test(type) ? 'oui-non'
      : /^(string\b|')/.test(type) ? 'mot'
      : /^(Int32|Double|Float)\b/.test(type) ? 'nombre'
      : /EventHandler</.test(type) ? 'fonction'
      : 'objet'
  }
  return formes
}

const aLaForme = (valeur: unknown, forme: Forme): boolean =>
  forme === 'liste' ? Array.isArray(valeur)
    : forme === 'oui-non' ? typeof valeur === 'boolean'
      : forme === 'mot' ? typeof valeur === 'string'
        : forme === 'nombre' ? typeof valeur === 'number'
          : forme === 'fonction' ? typeof valeur === 'function'
            : typeof valeur === 'object' && !Array.isArray(valeur)

// ----------------------------------------------------------- les doublures --
// (jest n'admet, dans la fabrique d'une doublure, que des variables « mock… ».)
/** Le témoin : ce qui arrive au composant natif de la vue web. */
const mockTemoin = { props: null as Record<string, unknown> | null }
jest.mock('react-native-webview/lib/RNCWebViewNativeComponent', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      mockTemoin.props = props
      return React.createElement(View, { ref })
    }),
    Commands: new Proxy({}, { get: () => () => {} })
  }
})
jest.mock('react-native-webview/lib/NativeRNCWebViewModule', () => ({
  __esModule: true,
  default: { isFileUploadSupported: async () => true, shouldStartLoadWithLockIdentifier() {} }
}))
// L'achat intégré : son module natif n'est pas de ceux que jest-expo sait doubler.
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(async () => true), purchaseUpdatedListener: jest.fn(() => ({ remove() {} })),
  fetchProducts: jest.fn(async () => []), getPendingTransactionsIOS: jest.fn(async () => []),
  requestPurchase: jest.fn(), finishTransaction: jest.fn()
}))
// Les marges de l'écran : la doublure que la bibliothèque fournit elle-même
// (la vraie attend, pour afficher quoi que ce soit, une mesure du téléphone).
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

/** De quoi démonter ce qui est monté. */
let demonter: (() => Promise<void>) | null = null
async function ranger() {
  await demonter?.()
  demonter = null
  jest.restoreAllMocks()
}
afterEach(ranger)

/** Ce que l'app a écrit d'inquiétant en démarrant : erreurs et avertissements. */
let plaintes: string[] = []

/**
 * L'app, montée sur ce système, avec la vue web de ce système — son vrai
 * code, pas une doublure. Rend ce qui est arrivé à son composant natif.
 *
 * Tout est rechargé à neuf pour chaque système (la coquille choisit ses
 * réglages selon lui) : React et son moteur de rendu aussi, sans quoi ils ne
 * se reconnaîtraient pas. Pas de `jest.isolateModules` : React Native charge
 * `Platform` à la demande, au moment du rendu — hors de l'enclos, il
 * retrouverait celui d'iOS.
 */
async function monter(plateforme: 'android' | 'ios'): Promise<Record<string, unknown>> {
  await ranger()
  jest.resetModules()
  mockTemoin.props = null
  plaintes = []
  for (const voie of ['error', 'warn'] as const) {
    jest.spyOn(console, voie).mockImplementation((...mots: unknown[]) => { plaintes.push(`${voie} : ${mots.map(String).join(' ').slice(0, 300)}`) })
  }
  jest.replaceProperty(require('react-native').Platform, 'OS', plateforme)
  jest.doMock('react-native-webview', () => {
    const vraie = require(`react-native-webview/lib/WebView.${plateforme}`).default
    return { __esModule: true, WebView: vraie, default: vraie }
  })
  const React = require('react')
  const { act, create } = require('react-test-renderer')
  const App = require('../App').default
  let rendu: { unmount(): void } | null = null
  await act(async () => { rendu = create(React.createElement(App)) })
  demonter = async () => { await act(async () => { rendu?.unmount() }) }
  if (!mockTemoin.props) throw new Error('la vue web n’a pas monté son composant natif')
  return mockTemoin.props
}

describe.each(['android', 'ios'] as const)('le vrai code des bibliothèques, sur %s', (plateforme) => {
  test('l’app démarre, sans erreur ni avertissement, et affiche le site', async () => {
    const recu = await monter(plateforme)
    expect(plaintes).toEqual([])
    expect(recu.newSource).toMatchObject({ uri: 'https://babynamed.fr/' })
    expect(recu.applicationNameForUserAgent).toBe(`babyNamedApp/1.0.0 (${plateforme}) apparence/claire`)
    expect(typeof recu.onMessage).toBe('function')
  })

  test('chaque réglage arrive au code natif de la vue web sous la forme qu’il attend', async () => {
    const attendu = specification()
    // La spécification a bien été lue : assez de réglages, et celui par qui c'est arrivé.
    expect(Object.keys(attendu).length).toBeGreaterThan(60)
    expect(attendu).toMatchObject({
      dataDetectorTypes: 'liste', bounces: 'oui-non', overScrollMode: 'mot', textZoom: 'nombre',
      onMessage: 'fonction', newSource: 'objet'
    })

    const recu = await monter(plateforme)
    const fautes = Object.entries(recu)
      .filter(([nom, valeur]) => attendu[nom] && valeur !== undefined && valeur !== null && !aLaForme(valeur, attendu[nom]!))
      .map(([nom, valeur]) => `${nom} : ${attendu[nom]} attendu, reçu ${JSON.stringify(valeur)}`)
    expect(fautes).toEqual([])
  })
})

test('chaque système ne reçoit que ses réglages : rien d’iOS sur Android, rien d’Android sur iOS', async () => {
  const D_IOS = ['bounces', 'allowsBackForwardNavigationGestures', 'allowsLinkPreview', 'dataDetectorTypes',
    'keyboardDisplayRequiresUserAction', 'contentInsetAdjustmentBehavior', 'automaticallyAdjustContentInsets']
  const D_ANDROID = ['overScrollMode', 'setSupportMultipleWindows', 'textZoom']

  const android = await monter('android')
  expect(D_IOS.filter(nom => android[nom] !== undefined)).toEqual([])
  expect(android).toMatchObject({ overScrollMode: 'never', setSupportMultipleWindows: false, textZoom: 100 })

  const ios = await monter('ios')
  expect(D_ANDROID.filter(nom => ios[nom] !== undefined)).toEqual([])
  expect(ios).toMatchObject({
    bounces: false, allowsBackForwardNavigationGestures: false, allowsLinkPreview: false, dataDetectorTypes: ['none'],
    keyboardDisplayRequiresUserAction: false, contentInsetAdjustmentBehavior: 'never', automaticallyAdjustContentInsets: false
  })
})
