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

  /** Filet 3 : le serveur publie l'identifiant du build en cours. */
  async function verifierBuild() {
    if (document.visibilityState !== 'visible') return
    try {
      const r = await fetch('/_nuxt/builds/latest.json', { cache: 'no-store' })
      if (!r.ok) return
      const { id } = await r.json()
      if (id && idLocal && id !== idLocal) {
        // Le service worker garde peut-etre encore l'ancienne coquille.
        if ('caches' in window) {
          for (const k of await caches.keys()) {
            if (k.startsWith('coquille-')) await caches.delete(k)
          }
        }
        recharger()
      }
    } catch { /* hors ligne : on garde la version en place */ }
  }

  if (!('serviceWorker' in navigator)) {
    document.addEventListener('visibilitychange', verifierBuild)
    verifierBuild()
    return
  }

  // Vrai seulement si une version tournait deja : on ne recharge pas a la
  // toute premiere installation du worker, ca ferait clignoter l'app.
  const dejaControle = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (dejaControle) recharger()
  })

  window.addEventListener('load', async () => {
    try {
      // updateViaCache: 'none' — sans ca le navigateur peut servir sw.js
      // depuis son propre cache HTTP et ne jamais voir la nouvelle version.
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })

      reg.addEventListener('updatefound', () => {
        const neuf = reg.installing
        neuf?.addEventListener('statechange', () => {
          if (neuf.state === 'installed' && navigator.serviceWorker.controller) {
            neuf.postMessage('saute')
          }
        })
      })

      const verifier = () => {
        if (document.visibilityState !== 'visible') return
        reg.update().catch(() => {})
        verifierBuild()
      }
      document.addEventListener('visibilitychange', verifier)
      setInterval(verifier, 10 * 60 * 1000)
      verifier()
    } catch { /* pas de service worker : le filet 3 reste actif */ }
  })
})
