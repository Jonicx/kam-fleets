if ('serviceWorker' in navigator) {
  const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  const serviceWorkerUrl = new URL('sw.js', appBaseUrl);

  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(
        registrations
          .filter((registration) => [registration.active, registration.installing, registration.waiting]
            .some((worker) => worker?.scriptURL === serviceWorkerUrl.href))
          .map((registration) => registration.unregister())
      ))
      .then(() => caches.keys())
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('kam-fleets-'))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .catch((error) => console.warn('Failed to remove the development service worker:', error));
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(serviceWorkerUrl, { scope: appBaseUrl.pathname })
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch((error) => {
          console.warn('ServiceWorker registration failed: ', error);
        });
    });
  }
}
