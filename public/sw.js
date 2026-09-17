/// \u003creference lib="webworker" /\u003e

/**
 * WACRM Service Worker
 *
 * Provides offline support, caching strategies, and push-notification
 * handling for the PWA. Strategies per route type:
 *
 *   /_next/static/*  → Cache First   (hashed assets, immutable)
 *   /icons/*         → Cache First   (PWA icons, rarely change)
 *   /api/*           → Network Only  (auth-gated, per-user data)
 *   HTML pages       → Network First (fresh content, offline fallback)
 *
 * The SW does NOT attempt to intercept Supabase Realtime (WSS) — those
 * connections bypass the fetch event entirely.
 */

const CACHE_VERSION = "wacrm-v1";
const OFFLINE_URL = "/offline.html";

// Assets to precache on install — the bare minimum for an offline shell.
const PRECACHE_URLS = [OFFLINE_URL];

// ---------- Install ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately — don't wait for existing tabs to close.
  self.skipWaiting();
});

// ---------- Activate ----------
self.addEventListener("activate", (event) => {
  // Purge old cache versions.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => caches.delete(key))
      )
    )
  );
  // Start controlling all open tabs immediately.
  self.clients.claim();
});

// ---------- Fetch ----------
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // In development (localhost), do NOT intercept fetches so HMR and Turbopack work fresh
  if (
    self.location.hostname === "localhost" ||
    self.location.hostname === "127.0.0.1"
  ) {
    return;
  }

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Never cache API routes — they carry auth tokens and per-user data.
  if (url.pathname.startsWith("/api/")) return;

  // Cache First for static hashed assets and icons.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network First for navigation requests (HTML pages).
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Stale While Revalidate for everything else (fonts, images, etc.).
  event.respondWith(staleWhileRevalidate(request));
});

// ---------- Push Notifications ----------
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "WACRM",
      body: event.data.text(),
      icon: "/icons/icon-192x192.png",
    };
  }

  const options = {
    body: payload.body || "New message received",
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: payload.tag || "wacrm-notification",
    data: {
      url: payload.url || "/inbox",
      conversationId: payload.conversationId,
    },
    // Vibrate pattern: buzz-pause-buzz
    vibrate: [200, 100, 200],
    // Keep notification until user interacts.
    requireInteraction: true,
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title || "WACRM", options));
});

// ---------- Notification Click ----------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/inbox";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If a WACRM tab is already open, focus it and navigate.
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window.
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ========== Caching Strategies ==========

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  // Kick off background revalidation.
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  // Return cached immediately if available, otherwise wait for network.
  return cached || fetchPromise;
}
