/**
 * L'achat intégré (src/achats.ts), sans téléphone : StoreKit est remplacé par
 * une doublure qu'on règle essai par essai.
 *
 * Ce qui se vérifie ici : ce que le natif demande à StoreKit, ce qu'il en
 * rend à la page, et surtout ce qu'il ne fait JAMAIS — finir une transaction
 * de lui-même, ou charger le module là où il n'existe pas.
 *
 * Ce que ça ne prouve pas : que la feuille d'Apple s'ouvre et encaisse. Seul
 * un iPhone, avec un compte d'essai, le dit (LISEZMOI).
 *
 *     npm run essais
 */
type Achats = typeof import('../src/achats')

const PRODUIT = 'fr.babynamed.app.deblocage'
const JETON = '6f7da3b0-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
/** Une transaction comme StoreKit la rend (en partie) — `finir` la veut entière. */
const transaction = (id: string, plus: object = {}) => ({
  id, transactionId: id, productId: PRODUIT, purchaseState: 'purchased', quantity: 1, store: 'apple',
  isAutoRenewing: false, transactionDate: 1791331200000, purchaseToken: 'jws.signé.parApple', ...plus
})

/** StoreKit, tel que l'essai le règle. */
function boutique() {
  const b = {
    initConnection: jest.fn(async () => true),
    fetchProducts: jest.fn(async (_: unknown): Promise<unknown> => [{ id: PRODUIT, displayPrice: '7,99 €', title: 'Débloquer une liste' }]),
    requestPurchase: jest.fn(async (_: unknown): Promise<unknown> => transaction('2000000100000001', { appAccountToken: JETON.toUpperCase() })),
    getPendingTransactionsIOS: jest.fn(async (): Promise<unknown> => []),
    finishTransaction: jest.fn(async (_: unknown) => {}),
    /** Ce que le natif a branché sur « une transaction arrive ». */
    arrivee: null as null | ((achat: unknown) => void),
    purchaseUpdatedListener: jest.fn((f: (achat: unknown) => void) => { b.arrivee = f; return { remove() {} } })
  }
  return b
}

/** Charge src/achats.ts comme sur ce téléphone-là. `boutique` nul : le module n'y existe pas. */
function charger(plateforme: 'ios' | 'android', { expoGo = false, storekit = boutique() as ReturnType<typeof boutique> | null } = {}) {
  let achats!: Achats
  jest.isolateModules(() => {
    // Le téléphone de CET essai : le module lit la plateforme en se chargeant.
    jest.replaceProperty(require('react-native').Platform, 'OS', plateforme)
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => expoGo }))
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }))
    jest.doMock('expo-iap', () => {
      if (!storekit) throw new Error('expo-iap : module natif absent de cette app')
      return storekit
    })
    achats = require('../src/achats')
  })
  return { achats, storekit: storekit! }
}

// ===================================================================== le prix
test('le prix : celui d’Apple, tel qu’il le formule, pour le produit que la page nomme', async () => {
  const { achats, storekit } = charger('ios')
  expect(await achats.prixDuProduit(PRODUIT)).toBe('7,99 €')
  expect(storekit.fetchProducts).toHaveBeenCalledWith({ skus: [PRODUIT], type: 'in-app' })
  // La boutique ne s'ouvre qu'une fois.
  await achats.prixDuProduit(PRODUIT)
  expect(storekit.initConnection).toHaveBeenCalledTimes(1)
})

test('un produit que l’App Store ne connaît pas, ou une boutique en panne : pas de prix, donc pas d’offre', async () => {
  const { achats, storekit } = charger('ios')
  storekit.fetchProducts.mockResolvedValueOnce([{ id: 'un.autre.produit', displayPrice: '1,99 €' }])
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
  storekit.fetchProducts.mockResolvedValueOnce([{ id: PRODUIT, displayPrice: '' }])
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
  storekit.fetchProducts.mockResolvedValueOnce(null)
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
  storekit.fetchProducts.mockRejectedValueOnce(new Error('pas de réseau'))
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
})

test('la boutique qui ne s’ouvre pas : rien, et l’on réessaie la fois suivante', async () => {
  const { achats, storekit } = charger('ios')
  storekit.initConnection.mockRejectedValueOnce(new Error('achats interdits sur ce téléphone'))
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
  expect(storekit.fetchProducts).not.toHaveBeenCalled()
  expect(await achats.prixDuProduit(PRODUIT)).toBe('7,99 €')
  expect(storekit.initConnection).toHaveBeenCalledTimes(2)
})

// ===================================================================== acheter
test('acheter : la feuille d’Apple, avec le produit et le jeton du serveur ; la transaction est rendue, pas finie', async () => {
  const { achats, storekit } = charger('ios')
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'achete', transaction: '2000000100000001' })
  expect(storekit.requestPurchase).toHaveBeenCalledWith(
    { request: { apple: { sku: PRODUIT, appAccountToken: JETON } }, type: 'in-app' })
  // Jamais de soi-même : tant que le site n'a pas répondu, StoreKit doit la garder.
  expect(storekit.finishTransaction).not.toHaveBeenCalled()
})

test('la feuille refermée, ou un accord à donner : ni achat ni erreur', async () => {
  const { achats, storekit } = charger('ios')
  storekit.requestPurchase.mockRejectedValueOnce(Object.assign(new Error('annulé'), { code: 'user-cancelled' }))
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'annule' })
  storekit.requestPurchase.mockRejectedValueOnce(Object.assign(new Error('en attente'), { code: 'deferred-payment' }))
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'attente' })
  // Ni l'un ni l'autre n'a payé : inutile de chercher une transaction.
  expect(storekit.getPendingTransactionsIOS).not.toHaveBeenCalled()
})

test('une erreur APRÈS le paiement : on retrouve la transaction à son jeton, au lieu de dire « échec »', async () => {
  const { achats, storekit } = charger('ios')
  storekit.requestPurchase.mockRejectedValueOnce(Object.assign(new Error('réseau'), { code: 'network-error' }))
  storekit.getPendingTransactionsIOS.mockResolvedValueOnce([
    transaction('2000000100000007', { appAccountToken: '11111111-2222-4333-8444-555555555555' }),
    transaction('2000000100000008', { appAccountToken: JETON.toUpperCase() })
  ])
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'achete', transaction: '2000000100000008' })
})

test('une erreur sans paiement : « erreur », même s’il traîne la transaction d’un autre achat', async () => {
  const { achats, storekit } = charger('ios')
  storekit.requestPurchase.mockRejectedValueOnce(Object.assign(new Error('refusé'), { code: 'purchase-error' }))
  storekit.getPendingTransactionsIOS.mockResolvedValueOnce([
    transaction('2000000100000007', { appAccountToken: '11111111-2222-4333-8444-555555555555' }),
    transaction('2000000100000009')
  ])
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'erreur' })
  // StoreKit qui ne rend rien du tout, et rien en suspens : erreur aussi.
  storekit.requestPurchase.mockResolvedValueOnce(null)
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'erreur' })
  // Et s'il ne sait même plus dire ce qu'il garde.
  storekit.requestPurchase.mockRejectedValueOnce(new Error('?'))
  storekit.getPendingTransactionsIOS.mockRejectedValueOnce(new Error('?'))
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'erreur' })
})

test('la boutique fermée : « erreur », sans ouvrir de feuille', async () => {
  const { achats, storekit } = charger('ios')
  storekit.initConnection.mockResolvedValueOnce(false as never)
  expect(await achats.acheter(PRODUIT, JETON)).toEqual({ etat: 'erreur' })
  expect(storekit.requestPurchase).not.toHaveBeenCalled()
})

// ================================================================== en suspens
test('les transactions en suspens : leur numéro et leur produit, et rien qui n’en soit pas une', async () => {
  const { achats, storekit } = charger('ios')
  storekit.getPendingTransactionsIOS.mockResolvedValueOnce([
    transaction('2000000100000011'), { id: 'pas-un-numero', productId: PRODUIT }, null, transaction('2000000100000012', { productId: 7 })
  ])
  // (`le` : la date de l'achat — la page s'en sert pour ne pas s'acharner sur une vieille transaction.)
  expect(await achats.enSuspens()).toEqual([
    { id: '2000000100000011', produit: PRODUIT, le: 1791331200000 }, { id: '2000000100000012', produit: '', le: 1791331200000 }
  ])
  storekit.getPendingTransactionsIOS.mockResolvedValueOnce([transaction('2000000100000013', { transactionDate: 'hier' })])
  expect(await achats.enSuspens()).toStrictEqual([{ id: '2000000100000013', produit: PRODUIT }])
  storekit.getPendingTransactionsIOS.mockRejectedValueOnce(new Error('transaction non vérifiée'))
  expect(await achats.enSuspens()).toBeNull()
})

// ======================================================================= finir
test('finir : la transaction entière est rendue à StoreKit, comme un consommable', async () => {
  const { achats, storekit } = charger('ios')
  const rendue = transaction('2000000100000021', { appAccountToken: JETON })
  storekit.requestPurchase.mockResolvedValueOnce(rendue)
  await achats.acheter(PRODUIT, JETON)
  expect(await achats.finir('2000000100000021')).toBe(true)
  expect(storekit.finishTransaction).toHaveBeenCalledWith({ purchase: rendue, isConsumable: true })
})

test('finir après un redémarrage : on redemande à StoreKit ce qu’il garde', async () => {
  const { achats, storekit } = charger('ios')
  const gardee = transaction('2000000100000022')
  storekit.getPendingTransactionsIOS.mockResolvedValue([gardee])
  expect(await achats.finir('2000000100000022')).toBe(true)
  expect(storekit.finishTransaction).toHaveBeenCalledWith({ purchase: gardee, isConsumable: true })
  // Une transaction que StoreKit ne connaît plus : c'est ce qu'on voulait, et l'on ne finit rien.
  expect(await achats.finir('2000000100000099')).toBe(true)
  expect(storekit.finishTransaction).toHaveBeenCalledTimes(1)
})

test('finir qui échoue : faux — la transaction reste en suspens, et reviendra', async () => {
  const { achats, storekit } = charger('ios')
  storekit.getPendingTransactionsIOS.mockResolvedValue([transaction('2000000100000023')])
  storekit.finishTransaction.mockRejectedValueOnce(new Error('StoreKit occupé'))
  expect(await achats.finir('2000000100000023')).toBe(false)
  // On n'a pas pu savoir ce que StoreKit garde : faux aussi, plutôt que « c'est fait ».
  storekit.getPendingTransactionsIOS.mockRejectedValueOnce(new Error('?'))
  expect(await achats.finir('2000000100000024')).toBe(false)
  // La fois suivante passe.
  expect(await achats.finir('2000000100000023')).toBe(true)
})

// ============================================================ ce qui arrive seul
test('une transaction arrivée d’elle-même est annoncée ; l’issue d’un achat lancé d’ici, non', async () => {
  const { achats, storekit } = charger('ios')
  const annonces = jest.fn()
  const arreter = achats.surArrivee(annonces)
  expect(storekit.purchaseUpdatedListener).toHaveBeenCalledTimes(1)

  // Un achat validé plus tard par un tiers : StoreKit le remet sans prévenir.
  storekit.arrivee!(transaction('2000000100000031'))
  expect(annonces).toHaveBeenCalledTimes(1)
  // … et `finir` saura la retrouver sans rien redemander.
  expect(await achats.finir('2000000100000031')).toBe(true)
  expect(storekit.getPendingTransactionsIOS).not.toHaveBeenCalled()

  // Pendant qu'une feuille d'achat est ouverte, et pour ce qu'elle a rendu : rien.
  storekit.requestPurchase.mockImplementationOnce(async () => {
    const rendue = transaction('2000000100000032')
    storekit.arrivee!(rendue)
    return rendue
  })
  await achats.acheter(PRODUIT, JETON)
  storekit.arrivee!(transaction('2000000100000032'))
  expect(annonces).toHaveBeenCalledTimes(1)

  // Ce qui n'est pas une transaction ne s'annonce pas.
  storekit.arrivee!({ id: 'x' }); storekit.arrivee!(null)
  expect(annonces).toHaveBeenCalledTimes(1)

  // La feuille refermée — même sur une erreur —, ce qui arrive ensuite s'annonce de nouveau.
  storekit.requestPurchase.mockRejectedValueOnce(Object.assign(new Error('annulé'), { code: 'user-cancelled' }))
  await achats.acheter(PRODUIT, JETON)
  storekit.arrivee!(transaction('2000000100000034'))
  expect(annonces).toHaveBeenCalledTimes(2)

  arreter()
  storekit.arrivee!(transaction('2000000100000033'))
  expect(annonces).toHaveBeenCalledTimes(2)
})

// ====================================================== là où rien ne se vend
test('Android : le module n’est même pas chargé, et tout répond « pas ici »', async () => {
  // La doublure casse si on la charge — comme l'app Android, où il n'est pas compilé.
  const { achats } = charger('android', { storekit: null })
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
  expect(await achats.acheter(PRODUIT, JETON)).toBeNull()
  expect(await achats.enSuspens()).toBeNull()
  expect(await achats.finir('2000000100000041')).toBe(false)
  expect(achats.surArrivee(() => {})).toEqual(expect.any(Function))
})

test('Expo Go sur iPhone : pareil, le module n’y existe pas', async () => {
  const { achats } = charger('ios', { expoGo: true, storekit: null })
  expect(await achats.prixDuProduit(PRODUIT)).toBeNull()
  expect(await achats.acheter(PRODUIT, JETON)).toBeNull()
  expect(await achats.enSuspens()).toBeNull()
  expect(await achats.finir('2000000100000041')).toBe(false)
})
