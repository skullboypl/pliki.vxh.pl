/* One-time migration: replace legacy Vite/Workbox SW and drop stale caches. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.navigate(client.url);
      }

      await self.registration.unregister();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
