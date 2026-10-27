const CACHE = "cmms-pwa-v1";
const OFFLINE = "/offline.html";
const RESOURCES = [OFFLINE, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(RESOURCES)));
  // Updates wait for existing windows to close, preserving unsaved forms.
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("cmms-pwa-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      return await caches.match(OFFLINE, { cacheName: CACHE }) || new Response("CMMS offline", { status: 503 });
    }));
  } else if (RESOURCES.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(request, { cacheName: CACHE }).then((cached) => cached || fetch(request)));
  }
  // Never cache authenticated pages, API responses or attachments.
});
