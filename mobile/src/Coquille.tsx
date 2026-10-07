import { File, Paths } from 'expo-file-system'
import * as Haptics from 'expo-haptics'
import * as Linking from 'expo-linking'
import { NavigationBar } from 'expo-navigation-bar'
import * as Sharing from 'expo-sharing'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState, BackHandler, KeyboardAvoidingView, Platform, Share, StyleSheet, useColorScheme, View
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview'

import { adresseDuChemin, adresseDuLien, destination } from './navigation'
import { auToucher, etatPush, ouverture } from './notifications'
import { Panne } from './Panne'
import { FOND_CLAIR, FOND_SOMBRE, lireMessage, scriptPour, type MessageNatif, type MessagePage } from './pont'
import { AGENT, EXPO_GO, INSPECTABLE, ORIGINE } from './site'

/**
 * La coquille : le site, plein écran, et le pont qui lui prête le téléphone.
 *
 * Ce composant ne connaît AUCUN écran du produit. Il tient quatre choses :
 *  - ce qui s'affiche ici et ce qui part dans le navigateur (navigation.ts) ;
 *  - les verbes du pont (pont.ts) : notifications, partage, fichier, vibreur,
 *    réglages, bouton « Retour » ;
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
  const telephoneSombre = useColorScheme() === 'dark'
  const vue = useRef<WebView>(null)

  /** La page à charger ; `generation` remonte la vue web (panne, processus mort). */
  const [adresse, setAdresse] = useState(premiereAdresse)
  const [generation, setGeneration] = useState(0)
  /** Ce que la page a dit de ses couleurs. Avant : celles du site, selon le téléphone. */
  const [couleurs, setCouleurs] = useState<Couleurs | null>(null)
  const [panne, setPanne] = useState(false)

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
      else envoyer({ type: 'actif' })
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
          applicationNameForUserAgent={AGENT}
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
          setSupportMultipleWindows={false}
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
          // Comme une app, pas comme une page : pas d'élastique, pas de
          // retour par glissement (le site a ses propres gestes de bord), pas
          // d'aperçu de lien, pas de numéros changés en liens.
          bounces={false}
          overScrollMode="never"
          allowsBackForwardNavigationGestures={false}
          allowsLinkPreview={false}
          dataDetectorTypes="none"
          // Un champ que la page met en avant ouvre le clavier, comme sur Android.
          keyboardDisplayRequiresUserAction={false}
          // La page gère elle-même ses marges : pas de retrait ajouté par iOS.
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          // La taille du texte est celle du site, essayée telle quelle, et non
          // multipliée par le réglage du téléphone (la mise en page casserait).
          textZoom={100}
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
