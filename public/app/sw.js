// DEV NOTE: PWA installability shell. Deliberately does no caching or
// offline support - exists only to satisfy the browser's installability
// criteria (a registered service worker with a fetch handler). Every
// request passes straight through to the network, so there is no staleness
// or cache-versioning concern to manage.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
