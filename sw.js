/* Service Worker — rend le dashboard utilisable hors connexion sur mobile
   (et sur desktop) une fois visité au moins une fois en ligne.

   Stratégie "réseau d'abord" pour tout ce qui vient du même site :
   - en ligne, on tente toujours le réseau et on met à jour le cache avec
     la réponse fraîche (aucune donnée obsolète tant qu'il y a du réseau,
     cohérent avec le cache-busting déjà en place côté dashboard) ;
   - hors ligne, on retombe sur la dernière version mise en cache
     (données BS/MAD, historique, page elle-même).

   Les requêtes data.json/bs_data.json/history/... portent un paramètre
   "?v=<timestamp>" différent à chaque appel : on l'ignore pour la clé de
   cache, sinon chaque appel créerait une entrée différente et jamais
   réutilisée. */
const CACHE_NAME = 'dgf-dashboard-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheKeyFor(request) {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const key = cacheKeyFor(request);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(key, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // police Google Fonts, etc. : cache HTTP normal du navigateur

  event.respondWith(networkFirst(req));
});
