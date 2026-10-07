/**
 * Dans l'app des stores (useCoquille) : ce que la page dit au natif sans
 * qu'on le lui demande, et ce qu'elle fait de ce qu'il lui envoie.
 *
 *  - « prête » : le natif garde son écran de démarrage tant que la page n'a
 *    rien affiché, et prend ses couleurs (le fond derrière la barre d'état,
 *    clair ou sombre comme l'app — réglage compris, pas seulement le
 *    téléphone). Le natif tient la page ENTRE la barre d'état et le bas de
 *    l'écran ; le jour où la page saura passer dessous elle-même, elle le
 *    dira ici (`bords: 'page'`), sans nouvelle version des apps ;
 *  - un lien ouvert pendant que l'app tourne (une invitation, le lien de
 *    connexion de l'e-mail, une notification touchée) : on y va par le
 *    routeur, sans recharger la page ;
 *  - une fois connecté, et à chaque retour au premier plan : ce téléphone
 *    est-il à prévenir ? (usePush — ne demande rien, relit seulement : on a pu
 *    changer la permission dans les réglages du téléphone entre-temps) ;
 *  - le bouton « Retour » d'Android : fermer la feuille ouverte, revenir à
 *    l'écran d'avant, ou sortir de l'app (`retour`, plus bas) ;
 *  - le retour au premier plan lui-même : l'app relit alors ce qui a pu
 *    changer ailleurs (une liste débloquée sur le site, une nouvelle version).
 *    Elle le fait sur `visibilitychange`, que la vue web envoie d'elle-même
 *    sur la plupart des téléphones ; le natif le redit (`actif`) pour ceux où
 *    elle se tait ;
 *  - dans l'app iOS, l'achat par l'App Store (useAchatApple) : l'offre
 *    s'ouvre quand le serveur et le téléphone sont prêts, et une transaction
 *    restée en suspens — l'app fermée en plein achat — est reprise au
 *    lancement, une fois connecté, à chaque retour au premier plan, et quand
 *    le natif en annonce une nouvelle (`achat.arrivee`).
 *
 * Rien de tout cela hors de l'app.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const { dansApp, dire, ecouter } = useCoquille()
  if (!dansApp) return
  const router = useRouter()

  /** Les couleurs du moment : le réglage de l'app d'abord, le téléphone sinon. */
  const couleurs = () => {
    const racine = document.documentElement
    const choisi = racine.getAttribute('data-theme')
    return {
      sombre: choisi ? choisi === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches,
      fond: getComputedStyle(racine).getPropertyValue('--fond').trim() || '#fbfaf9'
    }
  }
  const direTheme = () => dire({ type: 'theme', ...couleurs() })

  nuxtApp.hook('app:mounted', () => {
    dire({ type: 'pret', ...couleurs() })
    // Le réglage change (clair, sombre, système) ou le téléphone bascule le soir.
    watch(useTheme().choix, () => nextTick(direTheme))
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', direTheme)
  })

  ecouter('lien', (m) => {
    let u: URL
    try { u = new URL(String(m.url ?? ''), location.origin) } catch { return }
    if (u.origin !== location.origin) return
    navigateTo(u.pathname + u.search + u.hash)
  })

  /**
   * Le bouton « Retour » d'Android. Le natif ne sait pas ce qu'il y a à
   * l'écran ; il demande. Dans l'ordre où on l'attend d'une app : la feuille
   * ouverte se ferme (c'est Échap, que tient useDialogue) ; sinon on revient à
   * l'écran d'avant ; et de l'accueil, on sort de l'app.
   */
  ecouter('retour', () => {
    if (document.documentElement.classList.contains('dialogue')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      return
    }
    if (window.history.state?.back) { router.back(); return }
    dire({ type: 'quitter' })
  })

  const moi = useMoi()
  /** L'achat de l'App Store : l'offre d'abord, puis ce qui restait à porter au serveur. */
  const achats = () => ouvrirVenteApple().then(() => { if (moi.value) return reprendreAchatsApple() }).catch(() => null)
  // L'identifiant, pas l'objet : `moi` est remplacé à chaque relecture du compte.
  watch(() => moi.value?.id, (id) => { if (id) synchroniserPush(); achats() }, { immediate: true })
  // Une transaction arrivée pendant que l'app est ouverte, sans qu'on vienne de
  // l'acheter : un achat qui attendait l'accord d'un tiers.
  ecouter('achat.arrivee', () => { achats() })

  let vuLe = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    vuLe = Date.now()
    if (moi.value) synchroniserPush()
    achats()
  })
  ecouter('actif', () => {
    // La vue web vient de le dire elle-même : une fois suffit.
    if (document.visibilityState !== 'visible' || Date.now() - vuLe < 1500) return
    document.dispatchEvent(new Event('visibilitychange'))
  })
})
