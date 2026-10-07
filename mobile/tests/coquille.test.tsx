/**
 * La coquille (src/Coquille.tsx), sans téléphone : la vue web et les modules
 * natifs sont remplacés par des doublures qui notent ce qu'on leur demande.
 * On joue la page (ses messages), le téléphone (un lien, une notification, le
 * bouton « Retour », une panne) et on regarde ce que le natif en fait.
 *
 * Ce que ça ne prouve pas : que l'app se construit et se comporte ainsi sur
 * un vrai téléphone. Ça, seul un essai sur appareil le dit (LISEZMOI).
 *
 *     npm run essais
 */
import * as Boutique from 'expo-iap'
import * as Linking from 'expo-linking'
import * as Notifications from 'expo-notifications'
import * as Sharing from 'expo-sharing'
import * as SplashScreen from 'expo-splash-screen'
import { AppState, BackHandler, Platform, Share, useColorScheme } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { Coquille } from '../src/Coquille'

// ----------------------------------------------------------- les doublures --
// (jest n'admet, dans la fabrique d'une doublure, que des variables « mock… ».)
/**
 * La vue web : ses propriétés, ce que le natif lui fait faire — et la page
 * qu'elle contient, qui exécute pour de bon les scripts qu'on lui injecte :
 *  - 'vide'   : rien n'est encore arrivé du réseau (l'état de départ) : pas
 *               de document du site, donc pas de pont ;
 *  - 'charge' : un document du site, où il n'a pas (encore) démarré ;
 *  - 'ecoute' : le site y tourne, il entend le natif ;
 *  - 'morte'  : le téléphone a tué son processus. Plus rien ne s'exécute.
 */
const mockVueWeb = {
  props: null as any, scripts: [] as string[], reculs: 0, arrets: 0, montages: 0,
  page: 'vide' as 'vide' | 'charge' | 'ecoute' | 'morte',
  /** Ce que le natif a voulu dire à la page, qu'elle l'entende ou non. */
  envois: [] as any[],
  /** Ce que la page a entendu. */
  entendus: [] as any[],
  /** Ce qu'elle a posté en retour, pas encore remis au natif (les accusés de réception). */
  courrier: [] as string[],
  assignations: [] as string[]
}
jest.mock('react-native-webview', () => {
  const React = require('react')
  const { View } = require('react-native')
  const WebView = React.forwardRef((props: any, ref: any) => {
    mockVueWeb.props = props
    React.useEffect(() => { mockVueWeb.montages++ }, [])
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (s: string) => {
        mockVueWeb.scripts.push(s)
        const executer = (fenetre: any, adresse: any) => {
          try { new Function('window', 'location', s)(fenetre, adresse) } catch { /* comme la vue web : sans bruit */ }
        }
        executer({ __babyNamedNatif: (brut: string) => { mockVueWeb.envois.push(JSON.parse(brut)) } }, { assign() {} })
        if (mockVueWeb.page === 'morte') return
        const fenetre: any = {}
        if (mockVueWeb.page !== 'vide') {
          fenetre.ReactNativeWebView = { postMessage: (t: string) => { mockVueWeb.courrier.push(t) } }
        }
        if (mockVueWeb.page === 'ecoute') {
          fenetre.__babyNamedNatif = (brut: string) => { mockVueWeb.entendus.push(JSON.parse(brut)) }
        }
        executer(fenetre, { assign: (a: string) => { mockVueWeb.assignations.push(a) } })
      },
      goBack: () => { mockVueWeb.reculs++ },
      stopLoading: () => { mockVueWeb.arrets++ }
    }))
    return React.createElement(View, { testID: 'vue-web' })
  })
  return { WebView }
})
// Une vraie construction, pas Expo Go (qui a son essai à lui : expo-go.test.tsx).
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 })
}))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3', extra: { eas: { projectId: 'projet-d-essai' } } } }
}))
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true), setOptions: jest.fn(), hide: jest.fn()
}))
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))
jest.mock('expo-navigation-bar', () => ({ NavigationBar: () => null }))
jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(async () => {}) }))
jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' }, ImpactFeedbackStyle: { Light: 'light' }
}))
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }))
const mockFichiers: { nom: string; contenu: string }[] = []
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache://' },
  File: class {
    uri: string
    nom: string
    constructor(...morceaux: string[]) { this.nom = morceaux[1]!; this.uri = morceaux.join('') }
    create() {}
    write(contenu: string) { mockFichiers.push({ nom: this.nom, contenu }) }
  }
}))
jest.mock('expo-linking', () => ({
  getLinkingURL: jest.fn(() => null),
  addEventListener: jest.fn(() => ({ remove() {} })),
  openURL: jest.fn(async () => true),
  openSettings: jest.fn(async () => {})
}))
/**
 * StoreKit (iPhone). `arrivee` : ce que le natif a branché sur « une
 * transaction arrive » — il le fait en se chargeant, une fois, d'où une
 * variable tenue par la doublure elle-même.
 */
jest.mock('expo-iap', () => {
  const branche: { arrivee: any } = { arrivee: null }
  return {
    branche,
    initConnection: jest.fn(async () => true),
    fetchProducts: jest.fn(async () => [{ id: 'fr.babynamed.app.deblocage', displayPrice: '7,99 €' }]),
    requestPurchase: jest.fn(async () => null),
    getPendingTransactionsIOS: jest.fn(async () => []),
    finishTransaction: jest.fn(async () => {}),
    purchaseUpdatedListener: (f: any) => { branche.arrivee = f; return { remove() {} } }
  }
})
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[essai]' })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove() {} })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn()
}))

// -------------------------------------------------------------- outillage --
const SITE = 'https://babynamed.fr'
let rendu: ReactTestRenderer

let monte = false
async function monter() {
  await act(async () => { rendu = create(<Coquille />) })
  monte = true
}
/**
 * La page remet au natif ce qu'elle a posté : les accusés de réception. Dans
 * une vraie vue web ils arrivent d'eux-mêmes, un instant après le message.
 */
async function laPageRepond() {
  while (mockVueWeb.courrier.length) {
    const data = mockVueWeb.courrier.shift()!
    await act(async () => { await mockVueWeb.props.onMessage({ nativeEvent: { url: `${SITE}/`, data } }) })
  }
}
/** Le téléphone fait quelque chose ; la page, si elle vit, en accuse réception. */
async function agir<T>(geste: () => T): Promise<T> {
  let resultat!: T
  await act(async () => { resultat = await geste() })
  await laPageRepond()
  return resultat
}
/** La page dit quelque chose au natif, depuis l'adresse `depuis`. Une page du site qui parle est un site qui tourne. */
async function laPageDit(message: object, depuis = `${SITE}/`) {
  if (depuis === `${SITE}/`) mockVueWeb.page = 'ecoute'
  await act(async () => {
    await mockVueWeb.props.onMessage({ nativeEvent: { url: depuis, data: JSON.stringify({ v: 1, ...message }) } })
  })
  await laPageRepond()
}
const laPageDemarre = () => laPageDit({ type: 'pret', sombre: false, fond: '#fbfaf9' })
/** Les messages que le natif a remis à la page (dans l'ordre). */
const remis = () => mockVueWeb.envois
const dernierRemis = () => remis().at(-1)
const texteAffiche = () => JSON.stringify(rendu.toJSON())
const doublure = <T extends (...a: any[]) => any>(f: T) => f as unknown as jest.MockedFunction<T>
/** Un chargement raté, tel que la vue web l'annonce. */
const echec = (url: string, code = -1009) => ({ nativeEvent: { url, code, description: 'x' }, preventDefault: jest.fn() })
/** Le temps passe (chronomètres de jest), et la page répond à ce qui s'est dit entre-temps. */
async function attendre(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms) })
  await laPageRepond()
}

/**
 * Le téléphone passe en sombre, en clair, ou ne dit plus rien de son
 * apparence — comme il le fait le soir, ou quand on change son réglage.
 */
async function telephone(apparence: 'dark' | 'light' | null) {
  doublure(useColorScheme).mockReturnValue(apparence as any)
  // La doublure que React Native donne de ce crochet ne prévient personne :
  // on redessine, comme le vrai le ferait faire.
  if (monte) await act(async () => { rendu.update(<Coquille />) })
  await laPageRepond()
}

/** Les abonnements du téléphone : ce que la coquille y a branché. */
let etatApp: jest.SpyInstance
let retour: jest.SpyInstance
let quitter: jest.SpyInstance
let partage: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  // Posées à chaque essai et jamais « restaurées » : restaurer une doublure
  // que React Native fournit déjà la laisserait sans réponse.
  etatApp = jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove() {} }) as any)
  retour = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove() {} }) as any)
  quitter = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {})
  partage = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any)
  Object.assign(mockVueWeb, { props: null, scripts: [], reculs: 0, arrets: 0, montages: 0,
    page: 'vide', envois: [], entendus: [], courrier: [], assignations: [] })
  mockFichiers.length = 0
  doublure(useColorScheme).mockReturnValue('light')
  doublure(Linking.getLinkingURL).mockReturnValue(null)
  doublure(Notifications.getLastNotificationResponse).mockReturnValue(null)
  doublure(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: true } as any)
  doublure(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as any)
})
afterEach(async () => {
  await act(async () => { rendu?.unmount() })
  monte = false
  jest.useRealTimers()
})

// ================================================================ l'ouverture
test('à l’ouverture : l’accueil du site, et l’agent utilisateur auquel il reconnaît l’app', async () => {
  await monter()
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/` })
  expect(mockVueWeb.props.applicationNameForUserAgent).toBe('babyNamedApp/1.2.3 (ios) apparence/claire')
  expect(SplashScreen.hide).not.toHaveBeenCalled()
})

// ================================================== l'apparence du téléphone
// La page ne sait pas toujours si le téléphone est en sombre (la vue web
// d'Android répond « clair » à tort) : c'est le natif qui le lui dit.
test('un téléphone en sombre : l’agent de la vue web le dit, pour que la page le sache avant son premier affichage', async () => {
  await telephone('dark')
  await monter()
  expect(mockVueWeb.props.applicationNameForUserAgent).toBe('babyNamedApp/1.2.3 (ios) apparence/sombre')
  // … et la page qui démarre n'a rien à apprendre de plus.
  await laPageDemarre()
  expect(remis().filter(m => m.type === 'apparence')).toEqual([])
})

test('le téléphone bascule pendant que l’app est ouverte : la page l’apprend, et la vue web n’est pas touchée', async () => {
  await monter()
  await laPageDemarre()
  const agent = mockVueWeb.props.applicationNameForUserAgent
  await telephone('dark')
  expect(dernierRemis()).toEqual({ type: 'apparence', sombre: true })
  await telephone('light')
  expect(dernierRemis()).toEqual({ type: 'apparence', sombre: false })
  // Dit une fois par bascule, pas à chaque rendu.
  await laPageDit({ type: 'theme', sombre: false, fond: '#fbfaf9' })
  expect(remis().filter(m => m.type === 'apparence')).toHaveLength(2)
  // Changer l'agent d'une vue web en plein chargement la ferait recharger (Android).
  expect(mockVueWeb.props.applicationNameForUserAgent).toBe(agent)
  expect(mockVueWeb.montages).toBe(1)
})

test('la page se recharge dans la même vue après une bascule : son agent date, on lui redit l’apparence', async () => {
  await monter()
  await laPageDemarre()
  await telephone('dark')
  const avant = remis().length
  // (Android recharge la page après la connexion : elle relit le vieil agent.)
  await laPageDemarre()
  expect(remis().slice(avant)).toEqual([{ type: 'apparence', sombre: true }])
})

test('une vue web neuve naît avec l’apparence du moment', async () => {
  await monter()
  await laPageDemarre()
  await telephone('dark')
  await act(async () => { mockVueWeb.props.onRenderProcessGone() })
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.applicationNameForUserAgent).toBe('babyNamedApp/1.2.3 (ios) apparence/sombre')
})

test('au retour au premier plan, « actif » porte l’apparence : elle a pu basculer pendant la veille', async () => {
  await monter()
  await laPageDemarre()
  const changer = etatApp.mock.calls[0]![1] as (etat: string) => void
  await agir(() => changer('background'))
  await telephone('dark')
  await agir(() => changer('active'))
  expect(dernierRemis()).toEqual({ type: 'actif', sombre: true })
})

test('un téléphone qui ne dit pas son apparence : la marque seule, et rien n’est affirmé à la page', async () => {
  await telephone(null)
  await monter()
  expect(mockVueWeb.props.applicationNameForUserAgent).toBe('babyNamedApp/1.2.3 (ios)')
  await laPageDemarre()
  const changer = etatApp.mock.calls[0]![1] as (etat: string) => void
  await agir(() => changer('background'))
  await agir(() => changer('active'))
  expect(dernierRemis()).toEqual({ type: 'actif' })
  expect(remis().filter(m => m.type === 'apparence')).toEqual([])
})

test('ouverte par un lien d’invitation : on y va directement', async () => {
  doublure(Linking.getLinkingURL).mockReturnValue(`${SITE}/rejoindre/K7QMX3XPD9`)
  await monter()
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/rejoindre/K7QMX3XPD9` })
})

test('ouverte par une notification touchée : on y va, et un lien du même moment ne passe pas devant', async () => {
  doublure(Notifications.getLastNotificationResponse).mockReturnValue(
    { notification: { request: { identifier: 'n1', content: { data: { chemin: '/g/12/communs' } } } } } as any)
  doublure(Linking.getLinkingURL).mockReturnValue(`${SITE}/rejoindre/K7QMX3XPD9`)
  await monter()
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
  expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled()
})

test('ouverte par un lien qui n’est pas pour l’app : l’accueil', async () => {
  doublure(Linking.getLinkingURL).mockReturnValue('https://ailleurs.exemple.test/rejoindre/K7QMX3XPD9')
  await monter()
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/` })
})

// ======================================================== l'écran de démarrage
test('« prête » retire l’écran de démarrage et donne ses couleurs', async () => {
  await monter()
  await laPageDit({ type: 'pret', sombre: true, fond: '#101321' })
  expect(SplashScreen.hide).toHaveBeenCalledTimes(1)
  expect(texteAffiche()).toContain('#101321')
})

test('une page qui ne dit rien se montre quand même, au bout de huit secondes', async () => {
  jest.useFakeTimers()
  try {
    await monter()
    await act(async () => { jest.advanceTimersByTime(7900) })
    expect(SplashScreen.hide).not.toHaveBeenCalled()
    await act(async () => { jest.advanceTimersByTime(200) })
    expect(SplashScreen.hide).toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

test('le natif tient la page entre la barre d’état et le bas de l’écran — sauf si la page dit s’en charger', async () => {
  await monter()
  await laPageDit({ type: 'pret', sombre: false, fond: '#fbfaf9' })
  expect(texteAffiche()).toContain('"paddingTop":47')
  expect(texteAffiche()).toContain('"paddingBottom":34')
  await laPageDit({ type: 'theme', sombre: false, fond: '#fbfaf9', bords: 'page' })
  expect(texteAffiche()).not.toContain('"paddingTop":47')
})

// ===================================================================== le pont
test('seule NOTRE page parle au natif', async () => {
  await monter()
  await laPageDit({ type: 'pret', sombre: false, fond: '#fbfaf9' }, 'https://ailleurs.exemple.test/')
  await laPageDit({ type: 'push.demander', id: 'q1' }, 'https://ailleurs.exemple.test/')
  await laPageDit({ type: 'reglages' }, `${SITE}/prenoms/`)
  // Surtout pas la feuille d'achat d'Apple.
  await laPageDit({ type: 'achat.acheter', id: 'q2', produit: 'fr.babynamed.app.deblocage',
    jeton: '6f7da3b0-1c2d-4e5f-8a9b-0c1d2e3f4a5b' }, 'https://ailleurs.exemple.test/')
  expect(SplashScreen.hide).not.toHaveBeenCalled()
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(Linking.openSettings).not.toHaveBeenCalled()
  expect(Boutique.requestPurchase).not.toHaveBeenCalled()
  expect(mockVueWeb.scripts).toHaveLength(0)
})

test('les notifications : l’état se lit sans rien demander ; la question ne se pose que sur demande', async () => {
  await monter()
  await laPageDit({ type: 'push.etat', id: 'q1' })
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(dernierRemis()).toEqual({ type: 'push.etat', id: 'q1', ok: true, permission: 'indeterminee' })

  await laPageDit({ type: 'push.demander', id: 'q2' })
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'projet-d-essai' })
  expect(dernierRemis()).toEqual(
    { type: 'push.demander', id: 'q2', ok: true, permission: 'accordee', jeton: 'ExponentPushToken[essai]' })
  // Les canaux sont une affaire d'Android.
  expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled()
})

test('les notifications refusées pour de bon : on le dit, sans reposer la question', async () => {
  doublure(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: false } as any)
  await monter()
  await laPageDit({ type: 'push.demander', id: 'q1' })
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(dernierRemis()).toEqual({ type: 'push.demander', id: 'q1', ok: true, permission: 'refusee' })
})

test('les notifications en panne (pas de réseau, pas de service) : « pas possible », et rien de cassé', async () => {
  doublure(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as any)
  doublure(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('pas de réseau'))
  await monter()
  await laPageDit({ type: 'push.etat', id: 'q1' })
  expect(dernierRemis()).toEqual({ type: 'push.etat', id: 'q1', ok: false })
})

test('partager : la feuille du téléphone, avec le lien', async () => {
  await monter()
  await laPageDit({ type: 'partager', id: 'q1', titre: 'babyNamed', texte: 'Aide-moi à choisir un prénom',
    url: `${SITE}/rejoindre/K7QMX3XPD9` })
  expect(partage).toHaveBeenCalledWith(
    { message: 'Aide-moi à choisir un prénom', url: `${SITE}/rejoindre/K7QMX3XPD9` }, { subject: 'babyNamed' })
  expect(dernierRemis()).toEqual({ type: 'partager', id: 'q1', ok: true })

  // Le lien déjà dans le texte : on ne le donne pas deux fois.
  await laPageDit({ type: 'partager', id: 'q2', titre: '', texte: `Viens voir : ${SITE}/rejoindre/AB5E0BAD`,
    url: `${SITE}/rejoindre/AB5E0BAD` })
  expect(partage).toHaveBeenLastCalledWith({ message: `Viens voir : ${SITE}/rejoindre/AB5E0BAD` }, { subject: undefined })
})

test('partager qui échoue : la page l’apprend (elle copiera le lien)', async () => {
  partage.mockRejectedValue(new Error('rien pour partager'))
  await monter()
  await laPageDit({ type: 'partager', id: 'q1', titre: '', texte: '', url: `${SITE}/rejoindre/K7QMX3XPD9` })
  expect(dernierRemis()).toEqual({ type: 'partager', id: 'q1', ok: false })
})

test('un fichier à remettre : écrit dans le cache, puis proposé par la feuille du téléphone', async () => {
  await monter()
  await laPageDit({ type: 'fichier', id: 'q1', nom: 'babynamed-mes-donnees-2026-10-06.json',
    mime: 'application/json', texte: '{"moi":true}' })
  expect(mockFichiers).toEqual([{ nom: 'babynamed-mes-donnees-2026-10-06.json', contenu: '{"moi":true}' }])
  expect(Sharing.shareAsync).toHaveBeenCalledWith('cache://babynamed-mes-donnees-2026-10-06.json',
    expect.objectContaining({ mimeType: 'application/json', UTI: 'public.json' }))
  expect(dernierRemis()).toEqual({ type: 'fichier', id: 'q1', ok: true })
})

test('les réglages du téléphone', async () => {
  await monter()
  await laPageDit({ type: 'reglages' })
  expect(Linking.openSettings).toHaveBeenCalledTimes(1)
})

// ======================================================= l'achat intégré (iPhone)
// (Ce que StoreKit fait de chaque demande : tests/achats.test.ts. Ici, le pont.)
const PRODUIT = 'fr.babynamed.app.deblocage'
const JETON = '6f7da3b0-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const achatRendu = (id: string) => ({ id, transactionId: id, productId: PRODUIT, purchaseState: 'purchased' })

test('l’achat intégré : le prix d’Apple, pour le produit que la page nomme', async () => {
  await monter()
  await laPageDit({ type: 'achat.produit', id: 'q1', produit: PRODUIT })
  expect(Boutique.fetchProducts).toHaveBeenCalledWith({ skus: [PRODUIT], type: 'in-app' })
  expect(dernierRemis()).toEqual({ type: 'achat.produit', id: 'q1', ok: true, prix: '7,99 €' })
  // Un produit qu'Apple ne connaît pas : « pas d'offre », et non un prix vide.
  await laPageDit({ type: 'achat.produit', id: 'q2', produit: 'un.autre.produit' })
  expect(dernierRemis()).toEqual({ type: 'achat.produit', id: 'q2', ok: false })
})

test('l’achat intégré : la feuille d’Apple s’ouvre avec le jeton du serveur, et la page apprend comment elle s’est refermée', async () => {
  doublure(Boutique.requestPurchase).mockResolvedValueOnce(achatRendu('2000000100000001') as any)
  await monter()
  await laPageDit({ type: 'achat.acheter', id: 'q1', produit: PRODUIT, jeton: JETON })
  expect(Boutique.requestPurchase).toHaveBeenCalledWith(
    { request: { apple: { sku: PRODUIT, appAccountToken: JETON } }, type: 'in-app' })
  expect(dernierRemis()).toEqual({ type: 'achat.acheter', id: 'q1', ok: true, etat: 'achete', transaction: '2000000100000001' })
  // Rendue à la page, pas finie : c'est le site qui dira quand.
  expect(Boutique.finishTransaction).not.toHaveBeenCalled()

  doublure(Boutique.requestPurchase).mockRejectedValueOnce(Object.assign(new Error('annulé'), { code: 'user-cancelled' }))
  await laPageDit({ type: 'achat.acheter', id: 'q2', produit: PRODUIT, jeton: JETON })
  expect(dernierRemis()).toEqual({ type: 'achat.acheter', id: 'q2', ok: true, etat: 'annule' })
})

test('l’achat intégré : un jeton qui n’est pas un UUID, un produit douteux — aucune feuille ne s’ouvre', async () => {
  await monter()
  await laPageDit({ type: 'achat.acheter', id: 'q1', produit: PRODUIT, jeton: 'liste-12' })
  await laPageDit({ type: 'achat.acheter', id: 'q2', produit: 'un produit; rm -rf', jeton: JETON })
  await laPageDit({ type: 'achat.acheter', id: 'q3', produit: PRODUIT })
  expect(Boutique.requestPurchase).not.toHaveBeenCalled()
})

test('l’achat intégré : les transactions en suspens, puis « finir » quand le site les a traitées', async () => {
  const gardee = achatRendu('2000000100000011')
  doublure(Boutique.getPendingTransactionsIOS).mockResolvedValue([gardee] as any)
  await monter()
  await laPageDit({ type: 'achat.attente', id: 'q1' })
  expect(dernierRemis()).toEqual({ type: 'achat.attente', id: 'q1', ok: true,
    transactions: [{ id: '2000000100000011', produit: PRODUIT }] })
  expect(Boutique.finishTransaction).not.toHaveBeenCalled()

  await laPageDit({ type: 'achat.finir', id: 'q2', transaction: '2000000100000011' })
  expect(Boutique.finishTransaction).toHaveBeenCalledWith({ purchase: gardee, isConsumable: true })
  expect(dernierRemis()).toEqual({ type: 'achat.finir', id: 'q2', ok: true })

  // StoreKit ne sait plus dire ce qu'il garde : « on n'a pas pu savoir », pas « rien ».
  doublure(Boutique.getPendingTransactionsIOS).mockRejectedValueOnce(new Error('?'))
  await laPageDit({ type: 'achat.attente', id: 'q3' })
  expect(dernierRemis()).toEqual({ type: 'achat.attente', id: 'q3', ok: false })
  // Un numéro de transaction qui n'en est pas un ne va pas jusqu'à StoreKit.
  await laPageDit({ type: 'achat.finir', id: 'q4', transaction: 'tout' })
  expect(Boutique.finishTransaction).toHaveBeenCalledTimes(1)
})

test('l’achat intégré : une transaction arrivée d’elle-même est annoncée à la page', async () => {
  await monter()
  await laPageDemarre()
  await agir(() => (Boutique as any).branche.arrivee(achatRendu('2000000100000021')))
  expect(mockVueWeb.entendus).toEqual([{ type: 'achat.arrivee' }])
})

// =============================================================== la navigation
test('ce qui s’affiche dans l’app, ce qui part dehors, ce qui ne s’ouvre pas', async () => {
  await monter()
  const passe = (url: string, isTopFrame = true) => mockVueWeb.props.onShouldStartLoadWithRequest({ url, isTopFrame })
  expect(passe(`${SITE}/g/12/swipe`)).toBe(true)
  expect(passe(`${SITE}/connexion?mode=connexion`)).toBe(true)
  expect(Linking.openURL).not.toHaveBeenCalled()

  expect(passe(`${SITE}/prenoms/`)).toBe(false)
  expect(Linking.openURL).toHaveBeenLastCalledWith(`${SITE}/prenoms/`)
  expect(passe('https://www.cnil.fr/fr/plaintes')).toBe(false)
  expect(Linking.openURL).toHaveBeenLastCalledWith('https://www.cnil.fr/fr/plaintes')
  expect(passe('mailto:contact@babynamed.fr')).toBe(false)
  expect(Linking.openURL).toHaveBeenLastCalledWith('mailto:contact@babynamed.fr')
  expect(Linking.openURL).toHaveBeenCalledTimes(3)

  expect(passe(`${SITE}/api/moi/donnees`)).toBe(false)
  expect(passe('javascript:alert(1)')).toBe(false)
  // Un cadre dans la page n'ouvre rien dehors à l'insu de la personne.
  expect(passe('https://ailleurs.exemple.test/', false)).toBe(false)
  expect(Linking.openURL).toHaveBeenCalledTimes(3)
  expect(mockVueWeb.props.originWhitelist).toEqual(['*'])
})

test('une page du dehors qui s’est chargée malgré tout (Android, délai dépassé) est sortie de la vue web', async () => {
  await monter()
  const dehors = { url: 'https://www.cnil.fr/fr/plaintes', canGoBack: true, loading: true, title: '', canGoForward: false }
  await act(async () => { mockVueWeb.props.onNavigationStateChange(dehors) })
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ ...dehors, loading: false }) })
  expect(mockVueWeb.arrets).toBe(2)
  expect(mockVueWeb.reculs).toBe(2)
  expect(Linking.openURL).toHaveBeenCalledTimes(1)           // signalée deux fois, ouverte une
  expect(Linking.openURL).toHaveBeenCalledWith('https://www.cnil.fr/fr/plaintes')
})

test('un lien pour un nouvel onglet (iOS) : dehors s’il est du dehors, dans la page sinon', async () => {
  await monter()
  await act(async () => { mockVueWeb.props.onOpenWindow({ nativeEvent: { targetUrl: 'https://stripe.com/fr/privacy' } }) })
  expect(Linking.openURL).toHaveBeenCalledWith('https://stripe.com/fr/privacy')
  await act(async () => { mockVueWeb.props.onOpenWindow({ nativeEvent: { targetUrl: `${SITE}/conditions` } }) })
  expect(mockVueWeb.scripts.at(-1)).toBe(`location.assign("${SITE}/conditions");true;`)
  expect(mockVueWeb.assignations).toEqual([`${SITE}/conditions`])
})

// ========================================================== liens, notifications
/** Ce que la coquille a branché sur les liens du téléphone. */
const recevoirUnLien = () => doublure(Linking.addEventListener).mock.calls.at(-1)![1] as (e: { url: string }) => void

test('un lien reçu pendant que l’app tourne : remis à la page si elle écoute, chargé sinon', async () => {
  await monter()
  const recevoir = recevoirUnLien()

  // La page n'a encore rien dit : on charge l'adresse.
  await agir(() => recevoir({ url: `${SITE}/connexion/app#t=abc_DEF-123` }))
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/connexion/app#t=abc_DEF-123` })
  expect(mockVueWeb.scripts).toHaveLength(0)

  // Elle écoute : son routeur y va, sans rechargement.
  await laPageDemarre()
  const montages = mockVueWeb.montages
  await agir(() => recevoir({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))
  expect(mockVueWeb.entendus).toEqual([{ type: 'lien', url: `${SITE}/rejoindre/K7QMX3XPD9` }])
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/connexion/app#t=abc_DEF-123` })
  expect(mockVueWeb.montages).toBe(montages)

  // Un lien qui n'est pas pour l'app ne fait rien.
  const avant = mockVueWeb.scripts.length
  await agir(() => recevoir({ url: 'https://ailleurs.exemple.test/rejoindre/x' }))
  await agir(() => recevoir({ url: 'babynamed://rejoindre/K7QMX3XPD9' }))
  expect(mockVueWeb.scripts).toHaveLength(avant)
})

test('le téléphone annonce deux fois le lien qui a ouvert l’app : un seul chargement', async () => {
  doublure(Linking.getLinkingURL).mockReturnValue(`${SITE}/rejoindre/K7QMX3XPD9`)
  await monter()
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))
  expect(mockVueWeb.montages).toBe(1)
  expect(mockVueWeb.scripts).toHaveLength(0)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/rejoindre/K7QMX3XPD9` })
})

test('un lien pendant que la page se recharge : elle n’écoute plus, il n’est pas perdu pour autant', async () => {
  await monter()
  await laPageDemarre()
  // La connexion, sur Android, recharge la page : le natif n'en sait rien et la croit à l'écoute.
  mockVueWeb.page = 'charge'
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/AB5E0BAD` }))
  expect(mockVueWeb.entendus).toEqual([])
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/rejoindre/AB5E0BAD` })

  // Détrompé, il ne lui confie plus rien tant qu'elle n'a pas reparlé.
  const avant = mockVueWeb.scripts.length
  await agir(() => recevoirUnLien()({ url: `${SITE}/g/12/communs` }))
  expect(mockVueWeb.scripts).toHaveLength(avant)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
})

test('la même invitation touchée deux fois : la seconde recharge, d’une vue neuve s’il le faut', async () => {
  doublure(Linking.getLinkingURL).mockReturnValue(`${SITE}/rejoindre/K7QMX3XPD9`)
  await monter()
  await laPageDemarre()
  // Le site a suivi l'invitation jusqu'à la liste, puis se recharge.
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/g/12/swipe`, canGoBack: true, loading: false }) })
  mockVueWeb.page = 'charge'
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))
  // La vue web a déjà reçu cette adresse : la lui redonner ne la ferait pas bouger.
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/rejoindre/K7QMX3XPD9` })
})

test('une notification touchée mène à son écran — un chemin de l’app, rien d’autre', async () => {
  await monter()
  await laPageDemarre()
  const toucher = doublure(Notifications.addNotificationResponseReceivedListener).mock.calls[0]![0] as (r: any) => void
  const reponse = (id: string, chemin: unknown) =>
    ({ notification: { request: { identifier: id, content: { data: { chemin } } } } })
  await agir(() => toucher(reponse('t1', '/g/12/communs')))
  expect(mockVueWeb.entendus).toEqual([{ type: 'lien', url: `${SITE}/g/12/communs` }])
  const avant = mockVueWeb.scripts.length
  await agir(() => toucher(reponse('t1', '/g/12/communs')))            // la même, remise deux fois
  await agir(() => toucher(reponse('t2', '//ailleurs.exemple.test/')))
  await agir(() => toucher(reponse('t3', undefined)))
  expect(mockVueWeb.scripts).toHaveLength(avant)
})

// ============================================== la page que le téléphone a tuée
/** Ce que la coquille a branché sur l'état de l'app (au premier plan, en veille). */
const changerDEtat = () => etatApp.mock.calls.at(-1)![1] as (etat: string) => void

test('le retour au premier plan est toujours dit à la page ; son accusé remet le pari d’aplomb', async () => {
  await monter()
  const changer = changerDEtat()
  // Elle charge encore : on le lui dit quand même, elle répond « personne n'écoute ».
  await agir(() => changer('active'))
  expect(remis()).toEqual([{ type: 'actif', sombre: false }])
  expect(mockVueWeb.entendus).toEqual([])

  await laPageDemarre()
  await agir(() => changer('background'))
  await agir(() => changer('active'))
  expect(mockVueWeb.entendus).toEqual([{ type: 'actif', sombre: false }])
})

test('au retour d’une longue veille, la page n’est plus là et personne ne l’a dit : on repart, où l’on était', async () => {
  jest.useFakeTimers()
  await monter()
  await laPageDemarre()
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/g/12/communs`, canGoBack: true, loading: false }) })
  await agir(() => changerDEtat()('background'))
  mockVueWeb.page = 'morte'
  await agir(() => changerDEtat()('active'))
  await attendre(3900)
  expect(mockVueWeb.montages).toBe(1)
  await attendre(200)
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
})

test('la notification touchée après une longue veille : la page est morte, on arrive quand même à son écran', async () => {
  jest.useFakeTimers()
  await monter()
  await laPageDemarre()
  const toucher = doublure(Notifications.addNotificationResponseReceivedListener).mock.calls[0]![0] as (r: any) => void
  await agir(() => changerDEtat()('background'))
  mockVueWeb.page = 'morte'
  // Le lien arrive AVANT que l'app se sache revenue au premier plan.
  await agir(() => toucher({ notification: { request: { identifier: 'v1', content: { data: { chemin: '/g/12/communs' } } } } }))
  await agir(() => changerDEtat()('active'))
  expect(mockVueWeb.entendus).toEqual([])
  await attendre(4100)
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
})

test('une page vivante n’est jamais rechargée : elle répond, même lente à démarrer, même muette depuis longtemps', async () => {
  jest.useFakeTimers()
  await monter()
  await laPageDemarre()
  // À l'écoute.
  await agir(() => changerDEtat()('background'))
  await agir(() => changerDEtat()('active'))
  await attendre(60_000)
  // En plein rechargement : elle n'écoute pas, mais elle est là.
  mockVueWeb.page = 'charge'
  await agir(() => changerDEtat()('background'))
  await agir(() => changerDEtat()('active'))
  await attendre(60_000)
  expect(mockVueWeb.montages).toBe(1)
})

test('un premier chargement lent n’est pas interrompu : tant que la page n’a rien dit, on ne guette rien', async () => {
  jest.useFakeTimers()
  await monter()
  // Rien n'est encore arrivé du réseau ; la personne sort de l'app et y revient.
  await agir(() => changerDEtat()('background'))
  await agir(() => changerDEtat()('active'))
  await attendre(60_000)
  expect(mockVueWeb.montages).toBe(1)
})

test('le guet ne court pas pendant la veille : il sonnerait à tort au réveil', async () => {
  jest.useFakeTimers()
  await monter()
  await laPageDemarre()
  mockVueWeb.page = 'morte'               // elle ne répondra pas…
  await agir(() => changerDEtat()('active'))
  await attendre(1000)
  await agir(() => changerDEtat()('background'))   // … mais l'app repart en veille avant le délai
  await attendre(3_600_000)
  expect(mockVueWeb.montages).toBe(1)
  // Au réveil suivant, le guet reprend de zéro.
  await agir(() => changerDEtat()('active'))
  await attendre(3900)
  expect(mockVueWeb.montages).toBe(1)
  await attendre(200)
  expect(mockVueWeb.montages).toBe(2)
})

test('un lien resté sans réponse ne se rejoue pas longtemps après', async () => {
  jest.useFakeTimers()
  await monter()
  await laPageDemarre()
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/g/12/swipe`, canGoBack: false, loading: false }) })
  mockVueWeb.page = 'morte'
  await agir(() => changerDEtat()('background'))
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))     // remis en veille : pas de guet
  await attendre(120_000)
  expect(mockVueWeb.montages).toBe(1)
  await agir(() => changerDEtat()('active'))
  await attendre(4100)
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/swipe` })
})

test('le processus de la vue web tué par le système, qui le dit : on repart, là où l’on était', async () => {
  for (const annonce of ['onContentProcessDidTerminate', 'onRenderProcessGone']) {
    await monter()
    await laPageDemarre()
    await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/g/12/communs`, canGoBack: true, loading: false }) })
    const montages = mockVueWeb.montages
    await act(async () => { mockVueWeb.props[annonce]({ nativeEvent: {} }) })
    expect(mockVueWeb.montages).toBe(montages + 1)
    expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
    await act(async () => { rendu.unmount() })
  }
})

test('… tué alors qu’un lien venait de lui être remis : on repart vers ce lien', async () => {
  await monter()
  await laPageDemarre()
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/g/12/swipe`, canGoBack: true, loading: false }) })
  mockVueWeb.page = 'morte'
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))
  await act(async () => { mockVueWeb.props.onContentProcessDidTerminate({ nativeEvent: {} }) })
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/rejoindre/K7QMX3XPD9` })
})

test('… tué bien après un lien qu’elle avait entendu : là où l’on était, pas vers ce vieux lien', async () => {
  await monter()
  await laPageDemarre()
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))
  expect(mockVueWeb.entendus).toEqual([{ type: 'lien', url: `${SITE}/rejoindre/K7QMX3XPD9` }])
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/g/12/swipe`, canGoBack: true, loading: false }) })
  await act(async () => { mockVueWeb.props.onRenderProcessGone({ nativeEvent: {} }) })
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/swipe` })
})

test('une page du dehors dans la vue web : on ne lui confie pas un lien, on le charge', async () => {
  await monter()
  await laPageDemarre()
  await act(async () => {
    mockVueWeb.props.onNavigationStateChange({ url: 'https://www.cnil.fr/fr/plaintes', canGoBack: true, loading: true })
  })
  const avant = mockVueWeb.scripts.length
  await agir(() => recevoirUnLien()({ url: `${SITE}/connexion/app#t=abc_DEF-123` }))
  expect(mockVueWeb.scripts).toHaveLength(avant)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/connexion/app#t=abc_DEF-123` })
})

// ======================================================================= la panne
test('pas de réseau à l’ouverture : un écran pour le dire, et « Réessayer » repart d’une vue web neuve', async () => {
  await monter()
  expect(texteAffiche()).not.toContain('Pas de connexion')
  const erreur = echec(`${SITE}/`)
  await act(async () => { mockVueWeb.props.onError(erreur) })
  expect(texteAffiche()).toContain('Pas de connexion')
  expect(SplashScreen.hide).toHaveBeenCalled()
  // La vue web ne passe pas à son propre écran d'erreur : c'est le nôtre qui se montre.
  expect(erreur.preventDefault).toHaveBeenCalled()
  // … et ce qu'elle affiche dessous (la page d'erreur du téléphone) est caché aux lecteurs d'écran.
  const dessous = () => rendu.root.findByProps({ testID: 'vue-web' }).parent!.parent!
  const cache = (n: any): boolean => !!n && (n.props.importantForAccessibility === 'no-hide-descendants' || cache(n.parent))
  expect(cache(dessous())).toBe(true)

  const montages = mockVueWeb.montages
  const bouton = rendu.root.find(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')
  await act(async () => { bouton.props.onPress() })
  expect(texteAffiche()).not.toContain('Pas de connexion')
  expect(mockVueWeb.montages).toBe(montages + 1)
  expect(cache(dessous())).toBe(false)
})

test('iPhone, sans réseau à l’ouverture : l’erreur arrive sans adresse, et c’est bien notre panne', async () => {
  // Ouverte par une notification touchée, pour voir d'où « Réessayer » repart.
  doublure(Notifications.getLastNotificationResponse).mockReturnValue(
    { notification: { request: { identifier: 'n2', content: { data: { chemin: '/g/12/communs' } } } } } as any)
  await monter()
  await act(async () => { mockVueWeb.props.onNavigationStateChange({ url: '', canGoBack: false, loading: false }) })
  await act(async () => { mockVueWeb.props.onError(echec('')) })
  expect(texteAffiche()).toContain('Pas de connexion')
  // … de la page demandée, pas de nulle part.
  const bouton = rendu.root.find(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')
  await act(async () => { bouton.props.onPress() })
  expect(mockVueWeb.montages).toBe(2)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
})

test('en panne, le retour au premier plan retente tout seul ; un lien touché aussi, fût-ce le même', async () => {
  doublure(Linking.getLinkingURL).mockReturnValue(`${SITE}/rejoindre/K7QMX3XPD9`)
  await monter()
  await act(async () => { mockVueWeb.props.onError(echec(`${SITE}/rejoindre/K7QMX3XPD9`)) })
  await agir(() => changerDEtat()('active'))
  expect(mockVueWeb.montages).toBe(2)
  expect(texteAffiche()).not.toContain('Pas de connexion')

  // La même invitation, touchée de nouveau depuis l'écran de panne.
  await act(async () => { mockVueWeb.props.onError(echec(`${SITE}/rejoindre/K7QMX3XPD9`)) })
  await agir(() => recevoirUnLien()({ url: `${SITE}/rejoindre/K7QMX3XPD9` }))
  expect(mockVueWeb.montages).toBe(3)
  expect(texteAffiche()).not.toContain('Pas de connexion')

  // Une page qui écoutait, puis une panne (un rechargement sans réseau) : on
  // ne confie plus rien à ce qu'il en reste, on charge.
  await laPageDemarre()
  await act(async () => { mockVueWeb.props.onError(echec(`${SITE}/`)) })
  const avant = mockVueWeb.scripts.length
  await agir(() => recevoirUnLien()({ url: `${SITE}/g/12/communs` }))
  expect(mockVueWeb.scripts).toHaveLength(avant)
  expect(mockVueWeb.montages).toBe(4)
  expect(mockVueWeb.props.source).toEqual({ uri: `${SITE}/g/12/communs` })
})

test('le site en panne (erreur 500) : le même écran ; une page introuvable, non', async () => {
  await monter()
  await act(async () => { mockVueWeb.props.onHttpError({ nativeEvent: { url: `${SITE}/g/1/swipe`, statusCode: 404 } }) })
  expect(texteAffiche()).not.toContain('Pas de connexion')
  await act(async () => { mockVueWeb.props.onHttpError({ nativeEvent: { url: `${SITE}/`, statusCode: 503 } }) })
  expect(texteAffiche()).toContain('Pas de connexion')
})

test('l’erreur d’une page du dehors n’est pas notre panne', async () => {
  await monter()
  const erreur = echec('https://www.cnil.fr/', -2)
  await act(async () => { mockVueWeb.props.onError(erreur) })
  expect(texteAffiche()).not.toContain('Pas de connexion')
  expect(erreur.preventDefault).toHaveBeenCalled()
})

// ====================================================== Android : les canaux
describe('les notifications d’Android', () => {
  let android: { restore: () => void }
  beforeEach(async () => {
    android = jest.replaceProperty(Platform, 'OS', 'android')
    await monter()
  })
  afterEach(() => { android.restore() })

  test('deux canaux — les accords sonnent, l’activité se coupe à part, sans bruit', async () => {
    await laPageDemarre()
    await laPageDit({ type: 'push.etat', id: 'q1' })
    const canaux = doublure(Notifications.setNotificationChannelAsync).mock.calls
    // Les noms que le serveur écrit dans ses messages (app/server/utils/push.ts).
    expect(canaux.map(c => c[0])).toEqual(['accords', 'activite'])
    expect(canaux[0]![1]).toEqual({ name: 'Accords et invitations', importance: 4 })
    expect(canaux[1]![1]).toEqual({ name: 'Activité de vos listes', importance: 3, sound: null })
  })
})

// ============================================================ Android : « Retour »
describe('le bouton « Retour » d’Android', () => {
  let appuyer: () => boolean | null | undefined
  let android: { restore: () => void }
  beforeEach(async () => {
    android = jest.replaceProperty(Platform, 'OS', 'android')
    await monter()
    appuyer = retour.mock.calls.at(-1)![1] as () => boolean
  })
  afterEach(() => { android.restore() })

  test('la page écoute : c’est elle qui dit ce qu’il ferme', async () => {
    await laPageDemarre()
    expect(await agir(appuyer)).toBe(true)
    expect(mockVueWeb.entendus).toEqual([{ type: 'retour' }])
    expect(quitter).not.toHaveBeenCalled()
    expect(mockVueWeb.reculs).toBe(0)
    // De l'accueil, elle répond « quitter ».
    await laPageDit({ type: 'quitter' })
    expect(quitter).toHaveBeenCalledTimes(1)
  })

  test('la page n’écoute pas encore : l’historique de la vue web, sinon le système', async () => {
    expect(appuyer()).toBe(false)
    await act(async () => {
      mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/connexion`, canGoBack: true, loading: true })
    })
    expect(appuyer()).toBe(true)
    expect(mockVueWeb.reculs).toBe(1)
    expect(mockVueWeb.scripts).toHaveLength(0)
  })

  test('on la croyait à l’écoute, elle se rechargeait : « Retour » recule quand même', async () => {
    await laPageDemarre()
    await act(async () => {
      mockVueWeb.props.onNavigationStateChange({ url: `${SITE}/connexion`, canGoBack: true, loading: false })
    })
    mockVueWeb.page = 'charge'
    expect(await agir(appuyer)).toBe(true)
    expect(mockVueWeb.reculs).toBe(1)
    expect(quitter).not.toHaveBeenCalled()
    // Détrompé : l'appui suivant ne passe plus par elle.
    const avant = mockVueWeb.scripts.length
    expect(await agir(appuyer)).toBe(true)
    expect(mockVueWeb.reculs).toBe(2)
    expect(mockVueWeb.scripts).toHaveLength(avant)
  })

  test('… et sans page d’avant, il sort de l’app : on n’y reste jamais enfermé', async () => {
    await laPageDemarre()
    mockVueWeb.page = 'charge'
    expect(await agir(appuyer)).toBe(true)
    expect(mockVueWeb.reculs).toBe(0)
    expect(quitter).toHaveBeenCalledTimes(1)
  })

  test('sur l’écran de panne : le système ferme l’app', async () => {
    await act(async () => { mockVueWeb.props.onError(echec(`${SITE}/`, -2)) })
    expect(appuyer()).toBe(false)
  })
})

test('iPhone : « quitter » ne ferme rien (Apple ne veut pas d’une app qui se ferme seule), et aucun bouton « Retour » n’est écouté', async () => {
  await monter()
  await laPageDit({ type: 'quitter' })
  expect(quitter).not.toHaveBeenCalled()
  expect(retour).not.toHaveBeenCalled()
})
