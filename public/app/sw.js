// DEV NOTE: PWA installability shell (plus Web Push display - see the end of
// this file). Deliberately does no caching or
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

// Phone notifications (Web Push - src/api/product_push_service.ts). The
// payload says only what kind of notification it is; tapping it opens (or
// focuses) the app, where the bell shows the detail behind sign-in.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  }
  catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Kolosseum";
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === "string" ? data.body : "Open Kolosseum to see it.",
    icon: "/app/icons/icon-192.png",
    badge: "/app/icons/icon-192.png",
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url: typeof data.url === "string" && data.url.startsWith("/app/") ? data.url : "/app/" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/app/";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).pathname.startsWith("/app/") && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(url);
  })());
});
