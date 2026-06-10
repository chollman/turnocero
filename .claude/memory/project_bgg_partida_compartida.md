---
name: project_bgg_partida_compartida
description: BG Watch "partida compartida" — notificar co-jugadores TurnoCero al cargar una partida + cargar la partida con un clic
metadata:
  type: project
---

Feature (rama `sync-partidas-stats-curacion`, 2026-06-06): cuando un usuario carga una partida en BG Watch y el roster incluye a otros **usuarios de TurnoCero** (match por `bggUsername`), cada co-jugador recibe una **notificación rica** con el detalle de la partida (juego, jugadores+scores, ubicación, fecha) y dos acciones; al concretarse la carga, el autor recibe un agradecimiento.

**Decisiones de producto:** destinatarios = cualquier usuario TurnoCero (aunque NO tenga BGG conectado → la tarjeta le ofrece conectar en vez de los botones). Disparador = solo al **crear** (POST /partidas), no en ediciones.

**Server:**
- 2 tipos de notif nuevos en `Notification.js`: `bgg_play_shared` (al co-jugador, lleva subdoc `playSnapshot` embebido + `playId`) y `bgg_play_accepted` (al autor). `playId` entra en el filtro de upsert de `saveNotification` (cada partida = notif distinta). `TYPE_TO_SECTION` → `bgwatch`. Ambos en `PERSONAL_TYPES` de `routes/notifications.js` (community-agnostic, visibles en subdominios).
- `createPlay(user, body)` extraído en `bggMutations.js` (el flujo BGG-first inline del viejo POST /partidas) — compartido por POST /partidas y el endpoint "como aparece".
- `services/bgg/bggPlayShare.js`: `notifyPlayParticipants({req,author,body,playId})` (resuelve destinatarios con `resolveUsersByBggUsernames`, excluye autor, arma snapshot desde `body`+`resolveGame`) y `acknowledgeSharedPlay({req,recipient,notifId})` (agradece al autor + **marca la notif como `read:true, count:0, playLoaded:true`** — NO la borra; idempotente vía filtro `playLoaded:{$ne:true}`). Campo `Notification.playLoaded` (2026-06-10): la notif sobrevive en la bandeja como una notif común (leída, sin botones) hasta que el usuario la limpie.
- Rutas en `routes/bgg.js`: `POST /partidas` ahora usa `createPlay`; si trae `sharedFromNotifId` → `acknowledgeSharedPlay` y **NO** `notifyPlayParticipants` (rama "con correcciones", evita cadenas A→B→A); si no → notifica participantes. Nuevo `POST /partidas/compartida/:notifId` ("como aparece"): lee el snapshot de la notif (no datos del cliente, find con `playLoaded:{$ne:true}` → 404 si ya cargada, evita doble carga en BGG), `createPlay` + ack. Guard 400 si recipient sin `bggCredentials.encryptedPassword`.

**Cliente:**
- Dominio `bgwatch` en `notifDomains.js` (+ copy de los 2 tipos) y filtro "BG Watch" en `Notifications.jsx`.
- Reducers `applyBggPlaySharedNotif`/`applyBggPlayAcceptedNotif` (replaceResource keyed por `playId`) + `useBggNotificationListeners` (registrado en `NotificationContext`); `EVENT_SECTION`+`PERSONAL_EVENTS` con los 2 eventos socket `bgg:play-shared`/`bgg:play-accepted`. Toast copy en `ToastContainer` (`toastDedupKey` ahora incluye `playId`).
- Tarjeta rica `pages/notifications/SharedPlayNotifCard.jsx` (branch en `Notifications.jsx` cuando `type==='bgg_play_shared'`): "Cargar como aparece" → `<Modal>` confirm → `POST API.bgg.PARTIDA_COMPARTIDA(notifId)` → **`markSharedPlayLoaded(notifId)`** (NO dismiss); "Cargar con correcciones" → navega a `/bg-watch/:user/partidas/nueva` con `state:{prefill, sharedFromNotifId}`; si no conectado → CTA `/perfil`. Cuando `notif.playLoaded` la tarjeta reemplaza los botones por una confirmación discreta (`.loadedStatus`, check + "Cargaste esta partida…") y conserva la X para descartar.
- `pages/bg-watch/playSnapshot.js#snapshotToInitialValues` (snapshot → initialValues de PlayForm). `CreatePlay` lee `location.state.prefill`/`sharedFromNotifId`, manda el id en el POST y hace `markSharedPlayLoaded` al éxito.
- `NotificationContext.markSharedPlayLoaded(notifId)` (solo-cliente, el server ya persistió) + reducer `markPlayLoadedById` (`read:true, count:0, playLoaded:true`) en `notificationReducers.js`. Sustituye al `dismiss` previo de ambas ramas (2026-06-10): la notif queda como cualquier otra hasta que el usuario la limpie.

Relacionado: [[feedback_notifications_architecture]], [[feedback_notifications_tenant_scoping]], [[feedback_bgg_derived_invalidation]], [[feedback_service_layer]], [[project_bg_watch_play_form]].
