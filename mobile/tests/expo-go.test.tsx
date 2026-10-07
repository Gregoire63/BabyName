/**
 * Dans Expo Go (`npx expo start`, sans rien construire) : la coquille démarre
 * quand même, sans notifications.
 *
 * Le module des notifications y arrête l'app dès qu'on le charge, sur
 * Android : « Runtime not ready », avant le premier écran. Sa doublure fait
 * ici la même chose — si la coquille le charge, l'essai casse comme le
 * téléphone.
 *
 *     npm run essais
 */
import * as SplashScreen from 'expo-splash-screen'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { Coquille } from '../src/Coquille'

jest.mock('expo', () => ({ isRunningInExpoGo: () => true }))
jest.mock('expo-notifications', () => {
  throw new Error('expo-notifications: Android Push notifications (remote notifications) functionality '
    + 'provided by expo-notifications was removed from Expo Go with the release of SDK 53.')
})
// L'achat intégré n'existe pas davantage dans Expo Go : le charger casserait de même.
jest.mock('expo-iap', () => {
  throw new Error('Cannot find native module \'ExpoIap\'')
})

const mockVueWeb = { props: null as any, envois: [] as any[] }
jest.mock('react-native-webview', () => {
  const React = require('react')
  const { View } = require('react-native')
  const WebView = React.forwardRef((props: any, ref: any) => {
    mockVueWeb.props = props
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (s: string) => {
        new Function('window', s)({ __babyNamedNatif: (brut: string) => { mockVueWeb.envois.push(JSON.parse(brut)) } })
      },
      goBack() {}, stopLoading() {}
    }))
    return React.createElement(View, { testID: 'vue-web' })
  })
  return { WebView }
})
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }))
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true), setOptions: jest.fn(), hide: jest.fn()
}))
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))
jest.mock('expo-navigation-bar', () => ({ NavigationBar: () => null }))
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(async () => {}) }))
jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-haptics', () => ({}))
jest.mock('expo-sharing', () => ({}))
jest.mock('expo-file-system', () => ({ Paths: {}, File: class {} }))
jest.mock('expo-linking', () => ({
  // Expo Go ouvre l'app par une adresse à lui : ce n'est pas un lien pour elle.
  getLinkingURL: jest.fn(() => 'exp://192.168.1.20:8081'),
  addEventListener: jest.fn(() => ({ remove() {} })),
  openURL: jest.fn(async () => true), openSettings: jest.fn(async () => {})
}))

const SITE = 'https://babynamed.fr'
let rendu: ReactTestRenderer
const laPageDit = (message: object) => act(async () => {
  await mockVueWeb.props.onMessage({ nativeEvent: { url: `${SITE}/`, data: JSON.stringify({ v: 1, ...message }) } })
})
afterEach(async () => { await act(async () => { rendu?.unmount() }) })

test('Expo Go : la coquille démarre, affiche le site, et dit à la page qu’ici on ne prévient pas et qu’on ne vend pas', async () => {
  await act(async () => { rendu = create(<Coquille />) })
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/` })
  // L'écran de démarrage d'Expo Go ne se règle pas : on ne le lui demande pas.
  expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled()
  expect(SplashScreen.setOptions).not.toHaveBeenCalled()

  await laPageDit({ type: 'pret', sombre: false, fond: '#fbfaf9' })
  expect(SplashScreen.hide).toHaveBeenCalled()

  // La page demande où en sont les notifications, puis les demande : « pas possible ici », sans rien casser.
  await laPageDit({ type: 'push.etat', id: 'q1' })
  await laPageDit({ type: 'push.demander', id: 'q2' })
  expect(mockVueWeb.envois).toEqual([
    { type: 'push.etat', id: 'q1', ok: false },
    { type: 'push.demander', id: 'q2', ok: false }
  ])

  // Et l'achat intégré : « pas ici » à tout, la page ne proposera rien.
  mockVueWeb.envois.length = 0
  await laPageDit({ type: 'achat.produit', id: 'q3', produit: 'fr.babynamed.app.deblocage' })
  await laPageDit({ type: 'achat.acheter', id: 'q4', produit: 'fr.babynamed.app.deblocage', jeton: '6f7da3b0-1c2d-4e5f-8a9b-0c1d2e3f4a5b' })
  await laPageDit({ type: 'achat.attente', id: 'q5' })
  await laPageDit({ type: 'achat.finir', id: 'q6', transaction: '2000000100000001' })
  expect(mockVueWeb.envois).toEqual([
    { type: 'achat.produit', id: 'q3', ok: false },
    { type: 'achat.acheter', id: 'q4', ok: false },
    { type: 'achat.attente', id: 'q5', ok: false },
    { type: 'achat.finir', id: 'q6', ok: false }
  ])
})
