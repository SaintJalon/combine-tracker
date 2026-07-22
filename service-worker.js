const CACHE = 'combine-tracker-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Page loads: network-first (latest version when online), cache fallback offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return resp;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Everything else: cache-first.
  e.respondWith(
    caches.match(req).then(function (r) { return r || fetch(req); })
  );
});
