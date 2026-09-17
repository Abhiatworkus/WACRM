"use client";

import { useEffect, useRef } from "react";

/**
 * Registers the service worker on mount and handles the update
 * lifecycle. Headless — renders nothing. Mount once per app
 * (inside the dashboard shell, after auth).
 *
 * The SW lives at `/sw.js` (public directory) and is registered
 * at the root scope so it can intercept all same-origin fetches.
 *
 * Update flow:
 *   1. Browser finds a byte-different sw.js → installs it.
 *   2. The new SW waits (skipWaiting is called inside sw.js).
 *   3. On controllerchange we reload so the user gets the latest
 *      cached shell without manually refreshing.
 */
export function SwRegister() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      return;
    }

    let refreshing = false;

    // Reload once when a new SW takes over (happens after skipWaiting).
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registrationRef.current = registration;

        // Check for updates every 60 minutes while the tab is open.
        const interval = setInterval(
          () => {
            registration.update().catch(() => {
              // update() can fail if the network is down — safe to ignore.
            });
          },
          60 * 60 * 1000,
        );

        return () => clearInterval(interval);
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
