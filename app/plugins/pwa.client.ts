/**
 * Installation PWA + mise a jour automatique.
 *
 * Le piege d'une PWA : une fois installee, elle ne se rafraichit plus jamais
 * toute seule si on ne l'y force pas. Trois filets ici, du plus fiable au
 * plus grossier :
 *   1. le service worker se remplace des qu'un nouveau sw.js est detecte,
 *      et la page se recharge quand il prend la main ;
 *   2. a chaque retour sur l'application on redemande explicitement une
 *      verification (reg.update()), sinon le navigateur peut attendre 24 h ;
 *   3. on compare l'identifiant de build a celui publie par le serveur —
 *      ca rattrape le cas ou le service worker n'existe pas ou a echoue.
 */
export default defineNuxtPlugin(() => {
  /**
   * Rien de tout ca en developpement — et menage si quelque chose traine.
   *
   * Le service worker met en cache-d'abord tout /_nuxt/, parce qu'en
   * production ce sont des noms haches, donc immuables. En dev, /_nuxt/ est
   * l'espace de modules de Vite : des URL qui changent de sens a chaque
   * redemarrage. Le worker servait alors du vieux, et Vite recevait un
   * .vue repondu en text/css — l'app ne demarrait plus du tout.
   *
   * Pire : le worker survit au passage de `npm run preview` a `npm run dev`,
   * puisque c'est le meme localhost. On le desinstalle donc explicitement, et
   * on vide les caches : sans ca il faut aller le faire a la main dans les
   * outils du navigateur.
   */
  if (import.meta.dev) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(async (rs) => {
        if (!rs.length) return
        await Promise.all(rs.map(r => r.unregister()))
        if ('caches' in window) {
          for (const k of await caches.keys()) await caches.delete(k)
        }
        console.warn('[babyNames] service worker desinstalle (developpement) — rechargez')
      }).catch(() => { /* navigation privee */ })
    }
    return
  }

  const invite = useState<any>('pwa_invite', () => null)
  const installe = useState<boolean>('pwa_installe', () => false)

  installe.value = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true

  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    invite.value = e
  })
  window.addEventListener('appinstalled', () => {
    invite.value = null
    installe.value = true
  })

  // --- mise a jour ---------------------------------------------------------
  let recharge = false
  function recharger() {
    if (recharge) return
    recharge = true
    location.reload()
  }

  const idLocal = useRuntimeConfig().app.buildId

  /**
   * Filet 3 : le serveur publie l'identifiant du build en cours.
   *
   * Garde-fou indispensable : si pour une raison quelconque la coquille
   * servie reste ancienne alors que le manifeste est neuf, recharger en
   * boucle rendrait le telephone inutilisable. On ne tente donc le coup
   * qu'une seule fois par identifiant et par onglet.
   */
  async function verifierBuild() {
    if (document.visibilityState !== 'visible') return
    try {
      const r = await fetch('/_nuxt/builds/latest.json', { cache: 'no-store' })
      if (!r.ok) return
      const { id } = await r.json()
      if (!id || !idLocal || id === idLocal) return

      const cle = `bn_recharge_${id}`
      try { if (sessionStorage.getItem(cle)) return } catch { return }
      try { sessionStorage.setItem(cle, '1') } catch { return }

      // Le service worker garde peut-etre encore l'ancienne coquille.
      if ('caches' in window) {
        for (const k of await caches.keys()) {
          if (k.startsWith('coquille-')) await caches.delete(k)
        }
      }
      recharger()
    } catch { /* hors ligne : on garde la version en place */ }
  }

  // Le filet 3 est branche INCONDITIONNELLEMENT : navigation privee, reglage
  // d'entreprise, http simple — l'enregistrement du worker peut echouer, et
  // c'est precisement la qu'on a le plus besoin d'un filet.
  let demanderMajWorker: () => void = () => {}
  const verifier = () => {
    if (document.visibilityState !== 'visible') return
    demanderMajWorker()
    verifierBuild()
  }
  document.addEventListener('visibilitychange', verifier)
  setInterval(verifier, 10 * 60 * 1000)
  verifierBuild()

  if (!('serviceWorker' in navigator)) return

  // Vrai seulement si une version tournait deja : on ne recharge pas a la
  // toute premiere installation du worker, ca ferait clignoter l'app.
  const dejaControle = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (dejaControle) recharger()
  })

  const brancher = async () => {
    try {
      // updateViaCache: 'none' — sans ca le navigateur peut servir sw.js
      // depuis son propre cache HTTP et ne jamais voir la nouvelle version.
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      demanderMajWorker = () => { reg.update().catch(() => {}) }

      reg.addEventListener('updatefound', () => {
        const neuf = reg.installing
        neuf?.addEventListener('statechange', () => {
          if (neuf.state === 'installed' && navigator.serviceWorker.controller) {
            neuf.postMessage('saute')
          }
        })
      })
    } catch (e) {
      // Pas de worker : pas d'installation possible, pas de cache hors ligne,
      // mais le filet 3 ci-dessus continue de detecter les nouvelles versions.
      console.warn('[babyNames] service worker indisponible', e)
    }
  }
  if (document.readyState === 'complete') brancher()
  else window.addEventListener('load', brancher)
})
