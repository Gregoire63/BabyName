/**
 * Installation PWA. Chrome n'emet `beforeinstallprompt` qu'une fois, tot, et
 * seulement si un service worker est enregistre : on l'attrape au plus haut
 * niveau et on le garde, sinon le bouton d'installation ne peut plus rien.
 */
export default defineNuxtPlugin(() => {
  const invite = useState<any>('pwa_invite', () => null)
  const installe = useState<boolean>('pwa_installe', () => false)

  const autonome = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  installe.value = autonome()

  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault()
    invite.value = e
  })
  window.addEventListener('appinstalled', () => {
    invite.value = null
    installe.value = true
  })

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* hors ligne, tant pis */ })
    })
  }
})
