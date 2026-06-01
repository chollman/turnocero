import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "logo.svg",
        "favicon.ico",
        "apple-touch-icon-180x180.png",
      ],
      manifest: {
        name: "Turnocero",
        short_name: "Turnocero",
        description:
          "Organizá y encontrá partidas de juegos de mesa en tu comunidad.",
        theme_color: "#1888ef",
        background_color: "#0a0d15",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Take over immediately on activation and skip the "waiting" phase.
        // Without these, a new SW would wait for every open tab to close
        // before activating — leaving users on a stale cache that points
        // to JS chunks that no longer exist on the server (white screen).
        clientsClaim: true,
        skipWaiting: true,
        // Drop precaches from previous SW versions so we don't keep
        // serving deleted chunks.
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        // Don't serve the SPA shell for API requests.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    // Google Identity Services abre un popup y devuelve el resultado vía
    // window.postMessage al opener. Con COOP `same-origin` (default de
    // muchos browsers/proxies) se corta esa relación y el login se bloquea
    // ("Cross-Origin-Opener-Policy policy would block the window.postMessage
    // call"). `same-origin-allow-popups` mantiene el aislamiento pero deja
    // hablar con los popups que abre la propia página. Espejado en prod en
    // client/vercel.json.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
