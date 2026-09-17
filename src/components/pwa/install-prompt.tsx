"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";

/**
 * PWA Install Prompt.
 *
 * Shows a non-intrusive bottom banner on mobile devices when the app
 * is installable (the browser has fired `beforeinstallprompt` and the
 * user hasn't dismissed it in the last 7 days). Tapping "Install"
 * triggers the native A2HS dialog; "×" hides the banner and records
 * the dismissal timestamp.
 *
 * On iOS (Safari) the `beforeinstallprompt` event never fires, so we
 * detect the platform and show a manual "Add to Home Screen" hint
 * instead, guiding the user through the share-sheet flow.
 *
 * The banner auto-hides once the app is running in standalone mode
 * (i.e. it's already installed).
 */

const DISMISS_KEY = "wacrm:pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as Record<string, boolean>).standalone === true
  );
}

function getIosSnapshot() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !(window as unknown as Record<string, unknown>).MSStream
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    () => false
  );

  const isIos = useSyncExternalStore(
    () => () => {},
    getIosSnapshot,
    () => false
  );

  useEffect(() => {
    if (isStandalone) return;

    // Check dismiss cooldown.
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const elapsed = Date.now() - Number(dismissed);
        if (elapsed < DISMISS_DURATION_MS) return;
      }
    } catch {
      // localStorage unavailable — proceed anyway.
    }

    if (isIos) {
      // iOS doesn't fire beforeinstallprompt — show manual hint.
      const timer = setTimeout(() => setShowBanner(true), 0);
      return () => clearTimeout(timer);
    }

    // Chrome / Edge / Samsung Internet / etc.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone, isIos]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore.
    }
  }, []);

  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom-4 duration-300 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md">
        {/* App icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Install WACRM
          </p>
          <p className="text-xs text-muted-foreground">
            {isIos
              ? "Tap the share button, then \"Add to Home Screen\""
              : "Add to home screen for quick access"}
          </p>
        </div>

        {/* Actions */}
        {!isIos && (
          <button
            onClick={handleInstall}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Install
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
