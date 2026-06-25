/* Impulse Ombor PWA — tarmoq-birinchi. POST (submit) keshlanmaydi. */
var CACHE = 'ombor-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;            // submit (POST) → doim tarmoq
  if (req.url.indexOf('/api/') >= 0) return;   // API → tarmoq
  e.respondWith(
    fetch(req).then(function (r) {
      if (req.mode === 'navigate' && r.ok) {
        var cp = r.clone();
        caches.open(CACHE).then(function (c) { c.put('/mini-app', cp); });
      }
      return r;
    }).catch(function () {
      return caches.match(req).then(function (m) { return m || caches.match('/mini-app'); });
    })
  );
});
