/* global clients */
// Service worker custom (estrategia injectManifest de vite-plugin-pwa).
//
// Reemplaza al SW autogenerado (generateSW) para poder agregar los listeners de
// Web Push. IMPORTANTE: reproduce EXACTAMENTE las opciones de workbox que antes
// vivían en vite.config.js (skipWaiting + clientsClaim + cleanupOutdatedCaches +
// precache + navigateFallback con denylist /api + NetworkOnly para /api). Sin
// esto, una cache stale sirve chunks JS borrados tras un deploy → pantalla
// blanca (ver memoria feedback_pwa_sw_config).
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";
import {
  buildPushNotification,
  buildNotificationClickUrl,
} from "./sw/pushNotification";

// ── Cache (idéntico al generateSW anterior) ──────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Las llamadas a la API nunca se cachean ni caen al shell SPA.
registerRoute(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());

// navigateFallback: "/index.html" con denylist /api (SPA routing).
const navHandler = createHandlerBoundToURL("/index.html");
registerRoute(new NavigationRoute(navHandler, { denylist: [/^\/api\//] }));

// ── Web Push ─────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        if (event.data) data = event.data.json();
      } catch {
        /* payload inválido / ausente — data queda {} */
      }
      // Si ALGÚN cliente de este device está enfocado/visible, no mostramos la
      // notificación OS: el toast in-app ya cubre ese caso. (El push igual se
      // envía a todos los devices del usuario; cada uno decide localmente.)
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = wins.some(
        (c) => c.focused || c.visibilityState === "visible",
      );
      // Las push de prueba (panel admin) se muestran siempre, aunque la app esté
      // en foco — la gracia del botón es confirmar visualmente que el push llega
      // a ESTA pantalla. El resto sí se suprime: el toast in-app ya lo cubre.
      if (focused && !data.test) return;

      const { title, options } = buildPushNotification(data);
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = buildNotificationClickUrl(event.notification.data || {});
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of wins) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c && url) {
            try {
              await c.navigate(url);
            } catch {
              /* navegación cross-document — ignorar */
            }
          }
          return;
        }
      }
      if (clients.openWindow) await clients.openWindow(url);
    })(),
  );
});
