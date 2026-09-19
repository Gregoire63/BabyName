/* babyNames — service worker minimal.
   Raison d'etre : rendre l'application installable et faire que le catalogue
   (180 Ko) ne soit telecharge qu'une fois.

   Regle de survie : on ne garde en cache-d'abord QUE ce qui porte un nom
   hache (/_nuxt/...), donc immuable par construction. Tout le reste est
   servi par le reseau d'abord, ou revalide en arriere-plan. Un fichier sans
   nom hache garde en cache-d'abord, c'est une application figee pour
   toujours sur le telephone de quelqu'un. */
const VERSION = 'bn-5'
const COQUILLE = `coquille-${VERSION}`
const BIENS = `biens-${VERSION}`

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await caches.open(COQUILLE).then(c => c.add('/')).catch(() => {})
    await self.skipWaiting()
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

// La page peut forcer le passage a la nouvelle version.
self.addEventListener('message', e => {
  if (e.data === 'saute') self.skipWaiting()
})

self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin) return
  if (u.pathname.startsWith('/api/')) return           // jamais de cache sur l'API

  // Coquille SPA : reseau d'abord, cache seulement si on est hors ligne.
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const rep = await fetch(r, { cache: 'no-store' })
        if (rep.ok) (await caches.open(COQUILLE)).put('/', rep.clone())
        return rep
      } catch {
        return (await caches.match('/')) ?? Response.error()
      }
    })())
    return
  }

  // Noms haches : immuables, cache d'abord sans remords.
  if (u.pathname.startsWith('/_nuxt/') && !u.pathname.startsWith('/_nuxt/builds/')) {
    e.respondWith((async () => {
      const c = await caches.open(BIENS)
      const garde = await c.match(r)
      if (garde) return garde
      const rep = await fetch(r)
      if (rep.ok) c.put(r, rep.clone())
      return rep
    })())
    return
  }

  // Catalogue et icones : noms fixes, contenu qui peut changer. On sert le
  // cache tout de suite et on rafraichit derriere (stale-while-revalidate).
  const revalidable = u.pathname.startsWith('/data/')
    || u.pathname.startsWith('/icone-') || u.pathname === '/logo.png'
  if (!revalidable) return

  e.respondWith((async () => {
    const c = await caches.open(BIENS)
    const garde = await c.match(r)
    const frais = fetch(r).then(rep => {
      if (rep.ok) c.put(r, rep.clone())
      return rep
    }).catch(() => garde ?? Response.error())
    return garde ?? frais
  })())
})
