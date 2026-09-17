import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest.
 *
 * Next.js App Router generates `/manifest.webmanifest` from this file
 * automatically — no manual \u003clink rel="manifest"\u003e needed. The manifest
 * tells the browser how the app should behave when installed on the
 * user's home screen: fullscreen standalone mode, start URL, theme
 * colours, and icons.
 *
 * Agents install the PWA on their phones for quick inbox access without
 * needing a native app or an app-store listing.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WACRM — WhatsApp CRM",
    short_name: "WACRM",
    description: "WhatsApp shared inbox for your team. Send, receive, and manage customer conversations.",
    start_url: "/inbox",
    display: "standalone",
    orientation: "any",
    background_color: "#020617",
    theme_color: "#7c3aed",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
