---
name: project_web_push
description: "Web Push notifications (PWA) — entrega OS-level vía service worker injectManifest, integrada en emitNotification"
metadata: 
  node_type: memory
  type: project
  originSessionId: 69b30e58-f5ca-4e95-ae19-25d67e05c9db
---

**Mergeado a master** (2026-06-17, commits `137f801` feature + `621709f` badge fix). Suma **Web Push** (notificación a nivel OS aunque la PWA esté cerrada) que **complementa** las notifs in-app de Socket.IO, no las reemplaza. VAPID keys ya generadas y cargadas en los `.env` (server `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` + cliente `VITE_VAPID_PUBLIC_KEY`; public coincide entre ambos lados, verificado). Doc completa en CLAUDE.md → "### Web Push notifications (PWA)".

**Puntos clave / decisiones:**
- **Integración única** en [emitNotification.js](server/utils/emitNotification.js): tras `saveNotification` no-null, dispara `pushService.sendToUser` fire-and-forget. Cubre rutas + cron. Gateado por `isSectionEnabled("push")` + allowlist curado `config/pushableTypes.js` (NO las 34: excluye likes/fotos/comentarios genéricos; incluye BG Watch). Llamado vía el objeto `pushService` (no destructuring) para que los tests muten `sendToUser`.
- **Copy = única fuente de verdad**: el payload (serializeNotifForPush, whitelist <4KB) tiene el shape de Notification; el **service worker reusa `getNotifMeta`/`notifLink` de [[feedback_*]] notifDomains.js** vía el helper puro `client/src/sw/pushNotification.js`. Cero duplicación del texto.
- **SW migrado a `injectManifest`** (era generateSW) para poder agregar handlers `push`/`notificationclick`. `client/src/sw.js` re-reproduce A MANO todo workbox (precache + cleanupOutdatedCaches + skipWaiting + claim + `/api` NetworkOnly + nav fallback denylist `/api`) — ver [[feedback_pwa_sw_config]], si falta algo → white screen. Deps nuevas: workbox-precaching/routing/strategies ^7.4.1 (alineadas a workbox-build de vite-plugin-pwa 1.3).
- **Multi-device**: nunca suprimir server-side por "tiene socket" (un socket de desktop no implica que el teléfono esté abierto). Se envía a TODAS las subs; cada SW decide local (suprime si su ventana está enfocada — el toast ya cubre). Subs muertas (404/410) → prune en `pushService`.
- **Modelo** `PushSubscription` (1 por device, upsert por `endpoint`). Hook `usePushNotifications` (permiso desde gesto). Opt-in en `/perfil` + banner proactivo `PushPrompt` (2da sesión+, re-prompt a 14d). Logout explícito des-suscribe (`utils/pushDevice.js`). Toggle admin `push` (SECTION_KEY nuevo, default true).
- **iOS**: solo iOS 16.4+ con PWA instalada standalone (en pestaña Safari NO hay push); UI lo detecta (`requiresStandalone`) y guía "Agregar a inicio".
- **Iconos de la notif** (`client/src/sw/pushNotification.js`): `icon` = `/pwa-192x192.png` (logo "TO" a color, lado grande). `badge` = `/badge-96x96.png` (silueta de **meeple** BLANCA sobre transparente, ~75% transparente, generada con `sharp` desde el path de `Meeple.jsx`). El badge DEBE ser monocromo transparente: Android lo enmascara por alfa → un PNG opaco (como el viejo `pwa-64x64.png`) sale como cuadrado blanco en la barra de estado. **Además debe ser UN SOLO glifo simple, grueso y con padding (zona segura)**: el primer intento usó el wordmark "TO" (621709f) que, aunque transparente, a ~24dp (tamaño real del status bar) se empastaba en una mancha/cuadrado blanco — se reemplazó por el meeple (símbolo cuadrado y legible a tamaño chico). Si se cambia la marca, regenerar igual: blanco, transparente, glifo simple centrado con ~14% pad, 96px. **Caché**: tras cambiar el badge hay que re-buildear y forzar update del SW (cerrar/reabrir la PWA o reinstalarla); Android cachea el small-icon de la notif de forma agresiva.
- **Deploy**: VAPID ya generadas y en los `.env`. Re-buildear + que el SW se actualice (skipWaiting+claim) para que tome iconos nuevos. Sin keys = no-op (no rompe).
- **Tests**: server +50 (serializeNotifForPush, pushService, push integration, emitNotification ext); cliente +42 (pushKey, pushNotification paridad, usePushNotifications, pushDevice, PushPrompt, UserProfile push section, AuthContext logout). Suites completas verdes.
