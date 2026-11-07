// Service Worker for FUTES Nexus (Itoka & Lovable)
const CACHE_NAME = "nexus-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/futes-crest.jpg",
  "/mww-logo.jpg",
  "/manifest.webmanifest"
];

// Install: precache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clean up older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for pages and assets, fallback to cache when offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and internal server functions
  if (req.method !== "GET" || url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (opening the app offline)
  if (req.mode === "navigate" || url.pathname === "/") {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match("/") || caches.match(req))
    );
    return;
  }

  // Static assets (images, css, scripts)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
