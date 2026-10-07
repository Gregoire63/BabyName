import { File, Paths } from 'expo-file-system'
import * as Haptics from 'expo-haptics'
import * as Linking from 'expo-linking'
import { NavigationBar } from 'expo-navigation-bar'
import * as Sharing from 'expo-sharing'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState, BackHandler, KeyboardAvoidingView, Platform, Share, StyleSheet, useColorScheme, View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent, type WebViewNavigation, type WebViewProps } from 'react-native-webview'

import { acheter, enSuspens, finir, prixDuProduit, surArrivee } from './achats'
import { adresseDuChemin, adresseDuLien, destination } from './navigation'
import { auToucher, etatPush, ouverture } from './notifications'
import { Panne } from './Panne'
import {
  agentPour, FOND_CLAIR, FOND_SOMBRE, lireMessage, scriptPour, type MessageNatif, type MessagePage
} from './pont'
import { AGENT, EXPO_GO, INSPECTABLE, ORIGINE } from './site'

/**
 * La coquille : le site, plein écran, et le pont qui lui prête le téléphone.
 *
 * Ce composant ne connaît AUCUN écran du produit. Il tient quatre choses :
 *  - ce qui s'affiche ici et ce qui part dans le navigateur (navigation.ts) ;
 *  - les verbes du pont (pont.ts) : notifications, partage, fichier, vibreur,
 *    réglages, bouton « Retour », et sur iPhone l'achat intégré (achats.ts) ;
 *  - les liens qui ouvrent l'app : une invitation, un lien de connexion, une
 *    notification touchée ;
 *  - ce qu'aucune page ne peut faire pour elle-même : l'écran de démarrage,
 *    la barre d'état, l'écran « Pas de connexion », et repartir quand le
 *    téléphone a tué la page.
 *
 * LA PAGE ÉCOUTE-T-ELLE ? Tout ce que le natif lui remet en dépend, et il ne
 * la voit pas. Il tient donc un pari (`prete`), et le corrige à chaque
 * message par l'accusé de réception (pont.ts) :
 *  - « entendu » : elle écoute ;
 *  - « personne n'écoute » (le document est là, le site n'y a pas démarré) :
 *    on fait sans elle — un lien se charge, « Retour » recule seul ;
 *  - rien : elle n'est plus là. On repart d'une vue web neuve.
 * Aucun signal de chargement de la vue web ne sert à cela : sur Android, le
 * « début de chargement » sonne aussi à chaque changement d'écran du site.
 */

// L'écran de démarrage reste jusqu'à ce que la page dise « prête » : on ne
// montre ni page blanche, ni site à moitié dessiné.
SplashScreen.preventAutoHideAsync().catch(() => {})
// (Expo Go ne laisse pas régler le sien, et le fait savoir à chaque lancement.)
if (!EXPO_GO) SplashScreen.setOptions({ duration: 250, fade: true })

/** … mais jamais plus longtemps que cela : une page qui ne dit rien se montre quand même. */
const ATTENTE_MAX = 8000

/**
 * Une page vivante accuse réception dans l'instant, quoi qu'elle fasse.
 * Passé ce délai sans un mot d'elle : elle n'est plus là.
 */
const SILENCE_MAX = 4000

/** Un lien que la page n'a pas reçu ne se rejoue pas longtemps après qu'on l'a touché. */
const LIEN_FRAIS = 60_000

type Couleurs = { sombre: boolean; fond: string; bords: 'natif' | 'page' }

/**
 * Comme une app, pas comme une page. Ces réglages de la vue web n'existent
 * que sur un des deux systèmes, et CHACUN NE REÇOIT QUE LES SIENS.
 *
 * Ce n'est pas du rangement. Sur Android, la vue web transmet à son code
 * natif tout ce qu'on lui passe, réglages d'iOS compris, sans y toucher — et
 * ce code les lit sous la forme que SON iOS attend. `dataDetectorTypes` s'écrit
 * d'un mot (« none »), sa documentation le dit ; le code natif, lui, attend
 * une liste. Sur iOS la vue web fait la conversion ; sur Android non, et le
 * mot arrêtait l'app à l'ouverture, avant son premier écran (« String cannot
 * be cast to ReadableArray »). Trouvé le 07/10/2026 au premier lancement sur
 * un vrai téléphone ; les essais, où la vue web était une doublure, n'en
 * disaient rien. tests/vrai-code.test.tsx le garde, avec le vrai code de la
 * vue web : ce qui arrive à son code natif a la forme qu'il attend.
 */
const REGLAGES_IOS = {
  // Pas d'élastique, pas de retour par glissement (le site a ses propres
  // gestes de bord), pas d'aperçu de lien, pas de numéros changés en liens.
  bounces: false,
  allowsBackForwardNavigationGestures: false,
  allowsLinkPreview: false,
  dataDetectorTypes: ['none'],
  // Un champ que la page met en avant ouvre le clavier, comme sur Android.
  keyboardDisplayRequiresUserAction: false,
  // La page gère elle-même ses marges : pas de retrait ajouté par iOS.
  contentInsetAdjustmentBehavior: 'never',
  automaticallyAdjustContentInsets: false
} satisfies Partial<WebViewProps>
const REGLAGES_ANDROID = {
  // Pas d'élastique.
  overScrollMode: 'never',
  // Un lien fait pour un nouvel onglet se charge ici : il n'y a pas d'onglet.
  setSupportMultipleWindows: false,
  // La taille du texte est celle du site, essayée telle quelle, et non
  // multipliée par le réglage du téléphone (la mise en page casserait).
  textZoom: 100
} satisfies Partial<WebViewProps>

/**
 * La première page. L'app a pu être ouverte par une notification touchée ou
 * par un lien (une invitation, le lien de connexion) : on y va directement,
 * sans passer par l'accueil.
 */
function premiereAdresse(): string {
  return adresseDuChemin(ouverture(), ORIGINE)
    ?? adresseDuLien(Linking.getLinkingURL(), ORIGINE)
    ?? `${ORIGINE}/`
}

/** Hors de l'app : le navigateur, la messagerie, le téléphone. */
function ouvrirDehors(adresse: string) {
  Linking.openURL(adresse).catch(() => { /* rien pour l'ouvrir : on reste où l'on est */ })
}

/**
 * La feuille de partage du téléphone. iOS prend le texte et le lien à part ;
 * Android n'a qu'un texte, qui doit donc porter le lien.
 */
async function partager(m: Extract<MessagePage, { type: 'partager' }>): Promise<boolean> {
  try {
    const lienDansLeTexte = m.texte.includes(m.url)
    if (Platform.OS === 'ios') {
      await Share.share(lienDansLeTexte ? { message: m.texte } : { message: m.texte || undefined, url: m.url },
        { subject: m.titre || undefined })
    } else {
      await Share.share({
        message: lienDansLeTexte ? m.texte : [m.texte, m.url].filter(Boolean).join('\n'),
        title: m.titre || undefined
      }, { dialogTitle: m.titre || undefined })
    }
    return true
  } catch { return false }
}

/**
 * Un fichier que la page veut remettre à la personne (l'export de ses
 * données) : écrit dans le cache de l'app, puis proposé par la feuille du
 * téléphone — « Enregistrer dans Fichiers », l'envoyer, l'ouvrir ailleurs.
 */
async function remettre(m: Extract<MessagePage, { type: 'fichier' }>): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false
    const fichier = new File(Paths.cache, m.nom)
    fichier.create({ overwrite: true })
    fichier.write(m.texte)
    await Sharing.shareAsync(fichier.uri, {
      mimeType: m.mime, dialogTitle: m.nom, UTI: m.mime === 'application/json' ? 'public.json' : 'public.data'
    })
    return true
  } catch { return false }
}

export function Coquille() {
  const marges = useSafeAreaInsets()
  /** L'apparence du téléphone ; null s'il ne la dit pas. */
  const apparence = useColorScheme()
  const telephoneSombre = apparence === 'dark'
  const sombreConnu = apparence === 'dark' ? true : apparence === 'light' ? false : null
  const sombreDuTelephone = useRef(sombreConnu)
  sombreDuTelephone.current = sombreConnu
  const vue = useRef<WebView>(null)

  /** La page à charger ; `generation` remonte la vue web (panne, processus mort). */
  const [adresse, setAdresse] = useState(premiereAdresse)
  const [generation, setGeneration] = useState(0)
  /** Ce que la page a dit de ses couleurs. Avant : celles du site, selon le téléphone. */
  const [couleurs, setCouleurs] = useState<Couleurs | null>(null)
  const [panne, setPanne] = useState(false)

  /**
   * L'agent utilisateur de CETTE vue web : la marque de l'app, et l'apparence
   * du téléphone à sa création (pont.ts, `agentPour`). Il ne change pas tant
   * que la vue vit — le changer en plein chargement la ferait recharger sur
   * Android, et iOS ne le relit pas : la suite passe par le pont.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const creation = useMemo(() => ({ sombre: sombreDuTelephone.current,
    agent: agentPour(AGENT, sombreDuTelephone.current) }), [generation])
  /** Ce que l'agent de la vue web en cours dit du téléphone. */
  const sombreDeLAgent = useRef(creation.sombre)
  sombreDeLAgent.current = creation.sombre

  /** Le pari : la page écoute. Elle a parlé, ou accusé réception. */
  const prete = useRef(false)
  /** La vue web : la dernière adresse qu'on lui a donnée, celle où elle est, s'il y a une page avant. */
  const donnee = useRef(adresse)
  const courante = useRef(adresse)
  const peutReculer = useRef(false)
  const enPanne = useRef(false)
  enPanne.current = panne
  /** L'app est à l'écran : ni en veille, ni derrière une autre. */
  const devant = useRef(true)
  /** Un lien remis à la page, tant qu'elle n'en a pas accusé réception. */
  const lienEnRoute = useRef<{ adresse: string; le: number } | null>(null)
  /** Le guet : on attend un signe de la page. */
  const guet = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sombre = couleurs?.sombre ?? telephoneSombre
  const fond = couleurs?.fond ?? (telephoneSombre ? FOND_SOMBRE : FOND_CLAIR)
  // Par défaut le natif tient la page entre la barre d'état et le bas de
  // l'écran. Une page qui sait passer dessous elle-même le dit (`bords`).
  const pleinEcran = couleurs?.bords === 'page'

  /** La page a donné signe de vie, ou n'a plus à le faire : on cesse de guetter. */
  const rassurer = useCallback(() => {
    if (guet.current) clearTimeout(guet.current)
    guet.current = null
  }, [])
  useEffect(() => rassurer, [rassurer])

  /**
   * Charger une adresse dans la vue web. Dans la même si possible ; dans une
   * vue NEUVE s'il le faut : le processus de l'ancienne est mort (`neuve`),
   * elle a buté sur une panne, ou c'est l'adresse qu'elle a déjà reçue — la
   * lui redonner ne la ferait pas bouger.
   */
  const charger = useCallback((a: string, neuve = false) => {
    rassurer()
    prete.current = false
    lienEnRoute.current = null
    if (neuve || enPanne.current || a === donnee.current) setGeneration(g => g + 1)
    donnee.current = a
    courante.current = a
    setPanne(false)
    setAdresse(a)
  }, [rassurer])

  /** Repartir d'une vue web neuve : vers le lien qu'on n'a pas pu remettre, sinon là où l'on était. */
  const recommencer = useCallback(() => {
    const lien = lienEnRoute.current
    charger((lien && Date.now() - lien.le < LIEN_FRAIS ? lien.adresse : null)
      ?? adresseDuLien(courante.current, ORIGINE) ?? `${ORIGINE}/`, true)
  }, [charger])

  /**
   * Remettre un message à la page. Si l'on pariait qu'elle écoute, on guette
   * son accusé de réception : pas un mot, et c'est que le téléphone a tué
   * son processus (une longue veille, la mémoire) sans toujours nous le dire
   * — un écran blanc jusqu'à ce qu'on relance l'app. On repart.
   *
   * Le guet ne court que l'app à l'écran. En veille tout est figé, la page
   * comme le chronomètre : il sonnerait au réveil, avant qu'elle ait pu
   * répondre.
   */
  const envoyer = useCallback((m: MessageNatif) => {
    vue.current?.injectJavaScript(scriptPour(m))
    if (!prete.current || !devant.current || guet.current) return
    guet.current = setTimeout(() => {
      guet.current = null
      if (!enPanne.current) recommencer()
    }, SILENCE_MAX)
  }, [recommencer])

  /**
   * Aller à une adresse de l'app : un lien qui l'a ouverte, une notification
   * touchée. Par le routeur de la page si elle écoute — sans rechargement, et
   * le lien reste « en route » tant qu'elle n'en a pas accusé réception.
   * Sinon en la chargeant, sauf si la vue web y est déjà en chemin (le
   * téléphone annonce parfois deux fois le lien qui a ouvert l'app).
   */
  const aller = useCallback((a: string | null) => {
    if (!a) return
    if (prete.current) {
      lienEnRoute.current = { adresse: a, le: Date.now() }
      envoyer({ type: 'lien', url: a })
    } else if (a !== courante.current || enPanne.current) charger(a)
  }, [charger, envoyer])

  /** « Retour » sans la page : la page d'avant dans l'historique de la vue web. Faux s'il n'y en a pas. */
  const reculerSeul = useCallback(() => {
    if (!peutReculer.current) return false
    vue.current?.goBack()
    return true
  }, [])

  // L'écran de démarrage ne reste pas pour toujours.
  useEffect(() => {
    const minuteur = setTimeout(() => SplashScreen.hide(), ATTENTE_MAX)
    return () => clearTimeout(minuteur)
  }, [])

  // Le fond de la fenêtre suit celui de la page : pas d'éclair blanc quand le
  // clavier monte ou que l'écran tourne.
  useEffect(() => { SystemUI.setBackgroundColorAsync(fond).catch(() => {}) }, [fond])

  // Un lien ouvert pendant que l'app tourne ; une notification touchée.
  useEffect(() => {
    const liens = Linking.addEventListener('url', e => aller(adresseDuLien(e.url, ORIGINE)))
    const arreter = auToucher(chemin => aller(adresseDuChemin(chemin, ORIGINE)))
    return () => { liens.remove(); arreter() }
  }, [aller])

  // Le téléphone bascule en sombre (ou en revient) pendant que l'app est
  // ouverte : la page ne le sait pas toujours d'elle-même, on le lui dit.
  const dejaDit = useRef(sombreConnu)
  useEffect(() => {
    if (sombreConnu === null || sombreConnu === dejaDit.current) return
    dejaDit.current = sombreConnu
    envoyer({ type: 'apparence', sombre: sombreConnu })
  }, [envoyer, sombreConnu])

  // Une transaction arrivée d'elle-même (un achat validé plus tard par un
  // tiers) : la page ne le sait pas, on le lui dit ; elle viendra la chercher.
  useEffect(() => surArrivee(() => envoyer({ type: 'achat.arrivee' })), [envoyer])

  // Le retour au premier plan : la page relit ce qui a pu changer ailleurs
  // (une liste débloquée sur le site, la permission des notifications). On le
  // lui dit toujours, pari ou non : son accusé de réception remet le pari
  // d'aplomb, et son silence nous apprend qu'elle n'a pas survécu à la
  // veille. D'un écran de panne, on retente tout seul.
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (etat) => {
      devant.current = etat === 'active'
      if (!devant.current) { rassurer(); return }
      if (enPanne.current) recommencer()
      // … avec l'apparence du téléphone : il a pu basculer pendant la veille.
      else envoyer({ type: 'actif', ...(sombreDuTelephone.current === null ? {} : { sombre: sombreDuTelephone.current }) })
    })
    return () => abonnement.remove()
  }, [envoyer, rassurer, recommencer])

  // Le bouton « Retour » d'Android. Le natif ne sait pas ce qu'il y a à
  // l'écran : il le demande à la page, qui ferme sa feuille, recule d'un
  // écran, ou répond « quitter ». Si elle n'écoute pas, on recule dans
  // l'historique ; à défaut, le système ferme l'app.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      if (enPanne.current) return false
      if (!prete.current) return reculerSeul()
      envoyer({ type: 'retour' })
      return true
    })
    return () => abonnement.remove()
  }, [envoyer, reculerSeul])

  const ecouter = useCallback(async (e: WebViewMessageEvent) => {
    // Seule NOTRE page parle au natif. Une autre, arrivée dans la vue web
    // malgré tout, n'a pas la parole.
    if (!adresseDuLien(e.nativeEvent.url, ORIGINE)) return
    const m = lireMessage(e.nativeEvent.data)
    if (!m) return
    rassurer()

    if (m.type === 'accuse') {
      prete.current = m.ecoute
      if (m.de === 'lien') {
        const lien = lienEnRoute.current
        lienEnRoute.current = null
        // La page est là mais n'écoute pas : le lien ne se perd pas, on le charge.
        if (!m.ecoute && lien) charger(lien.adresse)
      } else if (m.de === 'retour' && !m.ecoute && !reculerSeul()) {
        BackHandler.exitApp()
      }
      return
    }

    // Une page qui parle est une page qui écoute.
    prete.current = true
    switch (m.type) {
      case 'pret':
        setPanne(false)
        setCouleurs({ sombre: m.sombre, fond: m.fond, bords: m.bords })
        SplashScreen.hide()
        // La page a démarré avec l'apparence écrite dans son agent utilisateur,
        // celle de la création de cette vue. Le téléphone a basculé depuis (la
        // page s'est rechargée dans la même vue) : on le lui dit.
        if (sombreDuTelephone.current !== null && sombreDuTelephone.current !== sombreDeLAgent.current) {
          envoyer({ type: 'apparence', sombre: sombreDuTelephone.current })
        }
        break
      case 'theme':
        setCouleurs({ sombre: m.sombre, fond: m.fond, bords: m.bords })
        break
      case 'push.etat':
      case 'push.demander':
        envoyer({ type: m.type, id: m.id, ...(await etatPush(m.type === 'push.demander')) })
        break
      case 'partager':
        envoyer({ type: 'partager', id: m.id, ok: await partager(m) })
        break
      case 'fichier':
        envoyer({ type: 'fichier', id: m.id, ok: await remettre(m) })
        break
      case 'vibrer':
        (m.genre === 'succes'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {})
        break
      case 'reglages':
        Linking.openSettings().catch(() => {})
        break
      case 'quitter':
        if (Platform.OS === 'android') BackHandler.exitApp()
        break
      // L'achat intégré. Le natif ne décide de rien : il prête la feuille
      // d'achat d'Apple, et rend ce qu'elle a dit (achats.ts).
      case 'achat.produit': {
        const prix = await prixDuProduit(m.produit)
        envoyer(prix ? { type: 'achat.produit', id: m.id, ok: true, prix } : { type: 'achat.produit', id: m.id, ok: false })
        break
      }
      case 'achat.acheter': {
        // La feuille d'Apple peut rester ouverte des minutes : la réponse part
        // quand elle se referme, quelle que soit la page qui écoute alors. Si
        // ce n'est plus la même, la transaction reste en suspens — rien n'est
        // perdu, la page d'après viendra la chercher.
        const issue = await acheter(m.produit, m.jeton)
        envoyer(issue ? { type: 'achat.acheter', id: m.id, ok: true, ...issue } : { type: 'achat.acheter', id: m.id, ok: false })
        break
      }
      case 'achat.attente': {
        const transactions = await enSuspens()
        envoyer(transactions
          ? { type: 'achat.attente', id: m.id, ok: true, transactions }
          : { type: 'achat.attente', id: m.id, ok: false })
        break
      }
      case 'achat.finir':
        envoyer({ type: 'achat.finir', id: m.id, ok: await finir(m.transaction) })
        break
    }
  }, [charger, envoyer, rassurer, reculerSeul])

  /** Chaque changement de page passe par ici AVANT de se faire. */
  const laisserPasser = useCallback((requete: { url: string; isTopFrame?: boolean }) => {
    const ou = destination(requete.url, ORIGINE)
    if (ou === 'app') return true
    if (ou === 'dehors' && requete.isTopFrame !== false) ouvrirDehors(requete.url)
    return false
  }, [])

  /**
   * … et par ici APRÈS. Android ne laisse à `laisserPasser` qu'un quart de
   * seconde pour répondre : passé ce délai, la page se charge quand même. Si
   * une adresse du dehors s'est ainsi glissée dans la vue web, on l'en sort.
   */
  const expulsee = useRef({ adresse: '', le: 0 })
  const suivre = useCallback((etat: WebViewNavigation) => {
    if (destination(etat.url, ORIGINE) !== 'dehors') {
      // On ne retient que nos adresses : iOS en annonce parfois une vide
      // (un chargement raté), et l'on repartirait de nulle part.
      const ici = adresseDuLien(etat.url, ORIGINE)
      if (ici) { courante.current = ici; peutReculer.current = etat.canGoBack }
      return
    }
    // La page qui écoutait n'est plus à l'écran.
    prete.current = false
    vue.current?.stopLoading()
    // Signalée au début puis à la fin de son chargement : on ne l'ouvre qu'une fois.
    const deja = expulsee.current
    if (deja.adresse !== etat.url || Date.now() - deja.le > 3000) ouvrirDehors(etat.url)
    expulsee.current = { adresse: etat.url, le: Date.now() }
    if (etat.canGoBack) vue.current?.goBack()
    else recommencer()
  }, [recommencer])

  const enPanneDeReseau = useCallback(() => {
    rassurer()
    prete.current = false
    setPanne(true)
    SplashScreen.hide()
  }, [rassurer])

  return (
    <View style={[styles.plein, { backgroundColor: fond },
      pleinEcran ? null : { paddingTop: marges.top, paddingBottom: marges.bottom }]}>
      {/* Deux conventions : la barre d'état nomme la couleur de son TEXTE,
          la barre de navigation celle de son FOND. */}
      <StatusBar style={sombre ? 'light' : 'dark'} />
      {Platform.OS === 'android' ? <NavigationBar style={sombre ? 'dark' : 'light'} /> : null}

      {/* Android, bord à bord : le clavier ne redimensionne plus la fenêtre,
          c'est à l'app de lui faire de la place. iOS : la vue web s'en charge,
          comme Safari — la page le sait (useClavier, côté site). */}
      <KeyboardAvoidingView style={styles.plein} behavior={Platform.OS === 'android' ? 'padding' : undefined}
        // En panne, notre écran recouvre la vue web — qui montre alors, dessous,
        // la page d'erreur du téléphone : un lecteur d'écran ne doit pas y entrer.
        accessibilityElementsHidden={panne}
        importantForAccessibility={panne ? 'no-hide-descendants' : 'auto'}>
        <WebView
          key={generation}
          ref={vue}
          source={{ uri: adresse }}
          style={[styles.plein, { backgroundColor: fond }]}
          containerStyle={{ backgroundColor: fond }}
          applicationNameForUserAgent={creation.agent}
          onMessage={ecouter}
          // Toutes les adresses passent par `laisserPasser`, mailto: comprise :
          // la liste par défaut les aurait triées avant nous, et moins bien.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={laisserPasser}
          onNavigationStateChange={suivre}
          onOpenWindow={e => {
            // iOS, un lien fait pour un nouvel onglet : il n'y a pas d'onglet.
            const cible = e.nativeEvent.targetUrl
            const ou = destination(cible, ORIGINE)
            if (ou === 'dehors') ouvrirDehors(cible)
            else if (ou === 'app') vue.current?.injectJavaScript(`location.assign(${JSON.stringify(cible)});true;`)
          }}
          onError={(e) => {
            // On garde la main : sans cela la vue web affiche son propre écran
            // d'erreur, et le garde.
            e.preventDefault()
            // iOS ne dit pas toujours QUELLE adresse a échoué (vide, à
            // l'ouverture sans réseau) : tout ce qui n'est pas clairement du
            // dehors est notre panne.
            if (destination(e.nativeEvent.url, ORIGINE) !== 'dehors') enPanneDeReseau()
          }}
          onHttpError={(e) => {
            // Le site lui-même en panne (pas une page introuvable, qu'il sait dire).
            if (e.nativeEvent.statusCode >= 500 && adresseDuLien(e.nativeEvent.url, ORIGINE)) enPanneDeReseau()
          }}
          // Si la vue web passait malgré tout à son écran d'erreur : rien, et
          // sans place prise. C'est le nôtre (Panne) qui se montre.
          renderError={() => <View />}
          // Le système a tué le processus de la vue web (mémoire, longue
          // veille), et le dit. Une vue neuve : sur Android l'ancienne ne
          // peut plus rien afficher.
          onContentProcessDidTerminate={() => recommencer()}
          onRenderProcessGone={() => recommencer()}
          // Comme une app, pas comme une page — chaque système ses réglages,
          // et seulement les siens (voir REGLAGES_IOS).
          {...(Platform.OS === 'ios' ? REGLAGES_IOS : REGLAGES_ANDROID)}
          webviewDebuggingEnabled={INSPECTABLE}
        />
      </KeyboardAvoidingView>

      {panne ? <Panne sombre={sombre} fond={fond} reessayer={recommencer} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  plein: { flex: 1 }
})
