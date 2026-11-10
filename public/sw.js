// Помощник на приложението ЕИС. Нарочно НЕ пази страници и данни на устройството (лични данни на деца) —
// единствената му работа е при липса на интернет да покаже понятна страница вместо грешка на браузъра.
const CACHE = 'eis-offline-v1'
const OFFLINE = '/offline.html'

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([OFFLINE, '/icons/eis-192.png'])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)))
})
