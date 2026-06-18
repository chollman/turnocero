---
name: project_web_push
description: "Web Push notifications (PWA) — entrega OS-level vía service worker injectManifest, integrada en emitNotification"
metadata: 
  node_type: memory
  type: project
  originSessionId: 69b30e58-f5ca-4e95-ae19-25d67e05c9db
---

Feature implementado en rama `feature/web-push-notifications` (2026-06-17). Suma **Web Push** (notificación a nivel OS aunque la PWA esté cerrada) que **complementa** las notifs in-app de Socket.IO, no las reemplaza. Doc completa en CLAUDE.md → "### Web Push notifications (PWA)".

**Puntos clave / decisiones:**
- **Integración única** en [emitNotification.js](server/utils/emitNotification.js): tras `saveNotification` no-null, dispara `pushService.sendToUser` fire-and-forget. Cubre rutas + cron. Gateado por `isSectionEnabled("push")` + allowlist curado `config/pushableTypes.js` (NO las 34: excluye likes/fotos/comentarios genéricos; incluye BG Watch). Llamado vía el objeto `pushService` (no destructuring) para que los tests muten `sendToUser`.
- **Copy = única fuente de verdad**: el payload (serializeNotifForPush, whitelist <4KB) tiene el shape de Notification; el **service worker reusa `getNotifMeta`/`notifLink` de [[feedback_*]] notifDomains.js** vía el helper puro `client/src/sw/pushNotification.js`. Cero duplicación del texto.
- **SW migrado a `injectManifest`** (era generateSW) para poder agregar handlers `push`/`notificationclick`. `client/src/sw.js` re-reproduce A MANO todo workbox (precache + cleanupOutdatedCaches + skipWaiting + claim + `/api` NetworkOnly + nav fallback denylist `/api`) — ver [[feedback_pwa_sw_config]], si falta algo → white screen. Deps nuevas: workbox-precaching/routing/strategies ^7.4.1 (alineadas a workbox-build de vite-plugin-pwa 1.3).
- **Multi-device**: nunca suprimir server-side por "tiene socket" (un socket de desktop no implica que el teléfono esté abierto). Se envía a TODAS las subs; cada SW decide local (suprime si su ventana está enfocada — el toast ya cubre). Subs muertas (404/410) → prune en `pushService`.
- **Modelo** `PushSubscription` (1 por device, upsert por `endpoint`). Hook `usePushNotifications` (permiso desde gesto). Opt-in en `/perfil` + banner proactivo `PushPrompt` (2da sesión+, re-prompt a 14d). Logout explícito des-suscribe (`utils/pushDevice.js`). Toggle admin `push` (SECTION_KEY nuevo, default true).
- **iOS**: solo iOS 16.4+ con PWA instalada standalone (en pestaña Safari NO hay push); UI lo detecta (`requiresStandalone`) y guía "Agregar a inicio".
- **Deploy pendiente**: generar VAPID (`npx web-push generate-vapid-keys`) → server `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` + cliente `VITE_VAPID_PUBLIC_KEY`. Sin keys = no-op (no rompe).
- **Tests**: server +50 (serializeNotifForPush, pushService, push integration, emitNotification ext); cliente +42 (pushKey, pushNotification paridad, usePushNotifications, pushDevice, PushPrompt, UserProfile push section, AuthContext logout). Suites completas verdes.
