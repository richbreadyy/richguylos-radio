const CACHE = 'richguylos-radio-v4'
const APP_SHELL = [
  '/richguylos-radio/',
  '/richguylos-radio/index.html',
  '/richguylos-radio/manifest.webmanifest',
  '/richguylos-radio/rgl-icon.svg',
  '/richguylos-radio/rgl-install-qr.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then((response) => response || caches.match('/richguylos-radio/index.html'))))
})
