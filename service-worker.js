// Bump CACHE on every deploy. Changing this file is what makes the browser
// re-install the worker at all — if it stays byte-identical, `install` never
// re-runs and old caches are never purged.
const CACHE = 'combine-tracker-v47';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Fetch with the HTTP cache bypassed. GitHub Pages serves `cache-control:
// max-age=600`, so a plain fetch() can hand back a stale index.html for ten
// minutes even though this worker is "network-first" — which is exactly how a
// deploy appears not to land.
function fetchFresh(url) {
  return fetch(url, { cache: 'no-store' });
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return fetchFresh(u).then(function (r) {
          if (r && r.ok) return c.put(u, r);
        }).catch(function () { /* a missing optional asset must not fail install */ });
      }));
    }).then(function () { return self.skipWaiting(); })
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

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Page loads: always go to the network, bypassing the HTTP cache, and fall
  // back to the cached copy only when genuinely offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetchFresh(req.url).then(function (resp) {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return resp;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  // Everything else: cache-first, then refresh the entry in the background.
  e.respondWith(
    caches.match(req).then(function (r) {
      const net = fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function () { return r; });
      return r || net;
    })
  );
});
