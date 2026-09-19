/* babyNames — service worker minimal.
   Raison d'etre : rendre l'application installable et faire que le catalogue
   (180 Ko) ne soit telecharge qu'une fois. Rien de plus : on ne met jamais en
   cache une reponse d'API, les votes doivent toujours venir du serveur. */
const VERSION = 'bn-4'
const COQUILLE = `coquille-${VERSION}`
const BIENS = `biens-${VERSION}`

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(COQUILLE)
    await c.addAll(['/', '/manifest.webmanifest', '/icone-192.png']).catch(() => {})
    await caches.open(BIENS).then(b =>
      b.add('/data/catalogue.json.gz')).catch(() => {})
    self.skipWaiting()
  })())
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k !== COQUILLE && k !== BIENS) await caches.delete(k)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin) return
  if (u.pathname.startsWith('/api/')) return           // jamais de cache sur l'API

  // Coquille SPA : le reseau d'abord, le cache si on est hors ligne.
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const rep = await fetch(r)
        const c = await caches.open(COQUILLE)
        c.put('/', rep.clone())
        return rep
      } catch {
        return (await caches.match('/')) ?? Response.error()
      }
    })())
    return
  }

  // Fichiers a nom hache et catalogue : le cache d'abord, c'est immuable.
  const durable = u.pathname.startsWith('/_nuxt/') || u.pathname.startsWith('/data/')
    || u.pathname.startsWith('/icone-') || u.pathname === '/logo.png'
  if (!durable) return

  e.respondWith((async () => {
    const c = await caches.open(BIENS)
    const garde = await c.match(r)
    if (garde) return garde
    const rep = await fetch(r)
    if (rep.ok) c.put(r, rep.clone())
    return rep
  })())
})
