/*
 * MEDGUARD service worker. Generated into dist/sw.js at build time: the build
 * fills in PRECACHE (every emitted file) and VERSION (hash of that list).
 *
 * What it gives: after ONE online visit the app opens, scans and runs the three
 * safety checks with no connection. What it does not do: it never caches or
 * answers /api (Claude ranking). Offline, the app simply keeps its fixed order.
 */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const SHELL = `medguard-shell-${VERSION}`
const FONTS = 'medguard-fonts'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      // One missing file must not abort the install, so add them one by one.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('medguard-shell-') && k !== SHELL).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Fonts: show the cached copy, refresh it in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(FONTS, req))
    return
  }

  if (url.origin !== self.location.origin) return
  // The Claude ranking endpoint is never cached or faked.
  if (url.pathname.startsWith('/api/')) return

  // Page loads: the network first (so a new deploy shows up), the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()),
    )
    return
  }

  // Built files have content hashes in their names, so the cached copy is always right.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
})

async function staleWhileRevalidate(name, req) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  const fresh = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone())
      return res
    })
    .catch(() => undefined)
  return hit || (await fresh) || Response.error()
}
