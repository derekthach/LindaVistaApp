/* Linda Vista HMS — minimal service worker for PWA installability only.
 * Does not cache HTML, JS, API routes, or data; every request goes to the network. */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
