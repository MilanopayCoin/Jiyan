/* Zincir: Drone — service worker (cache shell + notifications) */
const CACHE = 'zincir-drone-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  const e = /** @type {ExtendableEvent} */ (event)
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const e = /** @type {ExtendableEvent} */ (event)
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const e = /** @type {FetchEvent} */ (event)
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Network-first for navigations; cache-first for hashed assets
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html'))),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  const e = /** @type {NotificationEvent} */ (event)
  e.notification.close()
  const target = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'NOTIFY') return
  const e = /** @type {ExtendableEvent} */ (event)
  e.waitUntil(
    self.registration.showNotification(data.title || 'Zincir: Drone', {
      body: data.body || '',
      tag: data.tag || 'zincir',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url || '/' },
    }),
  )
})
