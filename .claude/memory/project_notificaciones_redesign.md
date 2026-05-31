---
name: project-notificaciones-redesign
description: "Notificaciones page redesign (handoff) — cross-domain inbox, inline actions, actors array, dismiss endpoint, notifDomains util"
metadata:
  node_type: memory
  type: project
  originSessionId: a3eb7435-1b54-43ca-984d-e134c8e4babd
---

Rediseño de `/notificaciones` (rama `redesign-notificaciones`, mayo 2026) según
`handoff/design_handoff_notificaciones/`. Bandeja transversal con dominios
coloreados, acciones inline, agrupación por tiempo y panel lateral de resumen.
Estilo adaptado a tokens TurnoCero (amber + dark/light), NO la paleta azul del
handoff. **Excluido por ahora:** sección "Preferencias" y notif `evento_pending`
al host.

**Capas nuevas:**

- `client/src/utils/notifDomains.js` — fuente única de: `TYPE_DOMAIN` (40 tipos →
  6 dominios: mesa/evento/torneo/amigo/compartida/admin), `DOMAIN_META`
  (colorVar de marca + icono + label), `notifBucket`, `isActionable`,
  `getCountBadge`, `notifLink`, `notifTarget`, `getNotifMeta` (migró el switch
  gigante que estaba inline en la página). Mapa preparado para sumar
  noticia/bgwatch/sistema cuando esos notifs se persistan.
- Componentes en `pages/notifications/`: `NotifRow` (3 variantes de visual
  izquierdo: agrupado con avatares apilados / icono de dominio / actor+pip),
  `ResolvedRow` (confirmación transitoria ~1.8s post-acción), `SidePanel`
  (digest derivado), `NotifIcons` (SVG inline).

**Acciones inline** (resueltas en la página, optimistic + `ResolvedRow`):

- `friend_request` → `POST /api/friends/:fromUserId/accept|reject` (+`notifyFriendAdded`).
- `join_request` con 1 solicitante → `POST /api/tables/:tableId/requests/:userId/accept|reject`
  (userId = `actors[0].userId`); con >1 → CTA "Ver solicitudes" a `/mesas/:id`.

**Backend — `actors` array (avatares apilados + userId del solicitante):**

- `Notification.actors: [{ userId, username }]` (más nuevo primero, dedupe por
  userId, cap 8). Lo mantiene `saveNotification` en la rama AGGREGATING vía
  **update con aggregation pipeline** (`$set` con `$concatArrays`+`$filter`+`$slice`;
  ya NO `$inc`/`$setOnInsert`). Los call sites pasan `actor:{userId,username}`.
- `emitNotification` emite `actors: notif.actors` (autoritativo) en el payload y
  NO el `actor` singular; los reducers aggregating guardan `payload.actors`
  (helper `upsertAggregating` acepta `actors`, sólo lo aplica si vino).
- `DELETE /api/notifications/:id` (descartar individual) + `NotificationContext.dismiss(notifId)`
  optimista con rollback por toast. `API.notifications.DISMISS(id)`.

Ver [[feedback-notifications-architecture]], [[feedback-notif-markread-count-reset]],
[[feedback-derived-counts]], [[feedback-inline-svg-icons]].
