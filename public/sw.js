const CACHE_NAME = 'kam-fleets-shell-v3';
const RUNTIME_CACHE = 'kam-fleets-runtime-v3';
const APP_BASE = '/kam-fleets/';
const APP_SHELL = [APP_BASE, `${APP_BASE}index.html`, `${APP_BASE}manifest.json`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(new URL('vite-manifest.json', new URL(APP_BASE, self.location.origin)))
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the build manifest: HTTP ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        const appBaseUrl = new URL(APP_BASE, self.location.origin);
        const precacheUrls = new Set(APP_SHELL);
        for (const asset of Object.values(manifest).flatMap((entry) => [
          entry.file,
          ...(entry.css || []),
          ...(entry.assets || []),
        ])) {
          if (typeof asset === 'string' && !/^(?:[a-z]+:|\/\/|data:)/i.test(asset)) {
            precacheUrls.add(new URL(asset, appBaseUrl).pathname);
          }
        }
        return caches.open(CACHE_NAME).then((cache) => cache.addAll([...precacheUrls]));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
        .map((cacheName) => caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.protocol === 'chrome-extension:') return;

  if (url.pathname.startsWith(APP_BASE)) {
    const isAppShellRequest = url.pathname === APP_BASE || url.pathname === `${APP_BASE}index.html` || url.pathname === `${APP_BASE}manifest.json`;
    const isStaticAsset = !url.pathname.startsWith(`${APP_BASE}api/`) && !url.pathname.includes('/neon/') && !url.pathname.includes('/auth/');

    if (request.mode === 'navigate' || isAppShellRequest) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match(`${APP_BASE}index.html`)))
      );
      return;
    }

    if (isStaticAsset) {
      event.respondWith(
        caches.match(request, { ignoreSearch: true }).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                return caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone)).then(() => response);
              }
              return response;
            })
            .catch(() => cached || Response.error());

          return cached || networkFetch;
        })
      );
      return;
    }
  }

  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
