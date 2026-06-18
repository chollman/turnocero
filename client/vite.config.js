import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Estrategia injectManifest: usamos un SW propio (src/sw.js) para poder
      // agregar los listeners de Web Push. El SW reproduce a mano lo que antes
      // configurábamos vía `workbox` (precache + skipWaiting + clientsClaim +
      // cleanupOutdatedCaches + navigateFallback con denylist /api). El registro
      // del SW lo sigue inyectando vite-plugin-pwa en index.html (injectRegister
      // default 'auto'), así que no hace falta tocar main.jsx.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
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
    }),
  ],
  server: {
    // PORT permite levantar una instancia paralela (ej. preview tooling)
    // sin pisar el dev server de la 3000.
    port: Number(process.env.PORT) || 3000,
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
