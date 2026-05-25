# Plan: mejoras y fixes del sistema de notificaciones

## Contexto

El sistema de notificaciones de Turnocero combina:

- Notificaciones persistidas en MongoDB (`Notification` model)
- Eventos Socket.IO en tiempo real (12+ tipos)
- Toasts efímeros (`ToastContainer`)
- Página `/notificaciones` (`Notifications.jsx`)
- Estado global en `NotificationContext`

Tras auditar todo el flujo, aparecen varios problemas: orden cronológico roto, notificaciones de torneo que nunca se marcan como leídas al tocarlas, eventos socket que no se persisten (DMs y admin chat se pierden si el usuario está offline), `Limpiar` que en realidad **borra** todo (no marca como leído), múltiples disparadores faltantes (Compartidas, ciclos de torneo, mesas canceladas, noticias) y falta de timestamps/filtros en la UI.

El objetivo es dejar el sistema **consistente, sin pérdidas, ordenado y ampliable**, agregando los triggers que faltan, persistiendo DMs/admin chat, y rehaciendo la pantalla con tabs, filtros y timestamps relativos.

---

## Hallazgos detallados (lista priorizada)

### 🔴 P0 — Bugs críticos (pérdida de datos o estado incorrecto)

1. **Orden cronológico incorrecto en `/notificaciones`**
   - Archivo: [Notifications.jsx:96](client/src/pages/notifications/Notifications.jsx#L96)
   - El server devuelve por `updatedAt DESC` y el socket appendea al final del array. `[...notifications].reverse()` invierte la lista entera, dejando las viejas-del-server al frente y las viejas-del-server al final desordenadas respecto de la nueva-de-socket.
   - **Fix**: ordenar por `updatedAt`/`timestamp` real con `.sort((a, b) => new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp))`.

2. **Notificaciones de torneo nunca se marcan como leídas al hacer click**
   - Archivo: [Notifications.jsx:126-130](client/src/pages/notifications/Notifications.jsx#L126-L130)
   - `handleClick` hace `if (isTorneo) return;` antes de llamar a `markRead`. Quedan visualmente "nuevas" para siempre.
   - **Fix**: agregar `markReadTorneo(torneoId)` en `NotificationContext` (PATCH `/api/notifications/read` con `{ torneoId }`) y soportarlo en la ruta del server ([notifications.js:23-26](server/routes/notifications.js#L23-L26)).

3. **`Limpiar` borra todo en vez de marcar como leído**
   - Archivos: [Notifications.jsx:107-109](client/src/pages/notifications/Notifications.jsx#L107), [NotificationContext.jsx:252-255](client/src/context/NotificationContext.jsx#L252-L255)
   - Acción destructiva sin confirmación; el usuario pierde historial entero.
   - **Fix**: separar en dos acciones:
     - **"Marcar todas como leídas"** → nuevo `markAllRead()` que hace `PATCH /api/notifications/read` con body vacío y setea `read: true` localmente.
     - **"Limpiar"** → mantener pero **con confirmación** (modal o `window.confirm`).

4. **`dm:message` y `admin:message` no se persisten**
   - Archivos: [NotificationContext.jsx:194-202](client/src/context/NotificationContext.jsx#L194-L202), `server/routes/dm.js`, `server/routes/adminChat.js`
   - El usuario offline pierde el aviso entero. Al volver, no ve indicador de mensajes nuevos hasta abrir el chat.
   - **Fix**: agregar tipos `dm` y `admin_chat` al schema y crear notificación persistida tipo aggregating (incrementa count) con `fromUserId` (para DM) o `recipient + type 'admin_chat'` (para admin). Cargarlas desde GET `/api/notifications` en el siguiente login y reconciliarlas con `ChatContext` (para DMs) y con el badge de admin chat.
   - Implementación: en `server/routes/dm.js` (POST `/:userId`) agregar `await saveNotification(recipientId, 'dm', { fromUserId, fromUsername, lastMessagePreview })`. Marcar como leídas en `PATCH /api/dm/:userId/read`. Para admin: en `adminChat.js` POST, hacer `await saveNotification(adminId, 'admin_chat', { fromUserId, fromUsername })` para todos los admins menos el emisor.

5. **`unreadCount` global se infla con tipos aggregating**
   - Archivo: [NotificationContext.jsx:292](client/src/context/NotificationContext.jsx#L292)
   - `totalUnread` suma `count` (no entradas), entonces 10 mensajes en 1 sola mesa muestran badge `9+`. Esto es intencional para tipos aggregating (refleja N eventos), pero confunde para tipos no-agg (suma 1) — discrepancia visual.
   - **Fix**: definir explícitamente la métrica: usar **`count` para aggregating y 1 para no-aggregating** (el código ya hace eso). Documentar en el código (comment de 1 línea) y agregar test mental: 5 solicitudes de amistad de 5 usuarios distintos → cada una count:1 → badge 5. ✓

### 🟠 P1 — UX / consistencia

6. **Toasts no marcan como leído al hacer click**
   - Archivo: [ToastContainer.jsx:37-54](client/src/components/layout/ToastContainer.jsx#L37-L54)
   - El click navega y dismissa el toast, pero la notificación persistida sigue `read: false`. La página `/mesas/:id` la marca como leída vía `setActiveTable`, pero las de amigos/torneos no.
   - **Fix**: al clickear un toast de friend/torneo, además llamar a `markReadFriend(fromUserId)` o `markReadTorneo(torneoId)`.

7. **No hay timestamps visibles en las cards**
   - Archivo: [Notifications.jsx:142-152](client/src/pages/notifications/Notifications.jsx#L142-L152)
   - **Fix**: agregar "hace X min/h/d" a la derecha del `cardGame`. Crear helper `formatTimeAgo(date)` en `client/src/utils/time.js` usando `Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })`. Refrescar cada 60 s (uso de `useState` + `setInterval`).

8. **Sin tabs ni filtros en `/notificaciones`**
   - Archivo: [Notifications.jsx](client/src/pages/notifications/Notifications.jsx)
   - **Fix**: agregar barra de tabs `Todas | Sin leer` + dropdown/chips para filtrar por categoría:
     - **Mesas** (chat, comment, image, join_request, join_accepted, spot_opened)
     - **Torneos** (tournament\_\*)
     - **Amigos** (friend\_\*, dm)
     - **Compartidas** (compartida\_\*)
     - **Anuncios** (noticia)
   - Estado local con `useState('all' | 'unread')` para tab y `useState('all' | <category>)` para tipo. Filtrar antes de mapear. Mostrar contador `(N)` en cada tab.

9. **Empty state pobre**
   - Archivo: [Notifications.jsx:113-117](client/src/pages/notifications/Notifications.jsx#L113-L117)
   - **Fix**: agregar subtítulo: "Cuando alguien te escriba, comente o invite, vas a verlo acá." Ajustar también empty-state cuando hay notifs pero el filtro no matchea ("Sin resultados").

10. **Tournament_advanced — texto incorrecto para formato grupos**
    - Archivos: [Notifications.jsx:70-76](client/src/pages/notifications/Notifications.jsx#L70-L76), `server/routes/torneos.js`
    - `tournament_advanced` se reusa para single_elim (round) y grupos (phase). El texto dice "ronda" siempre. En grupos debería decir "fase".
    - **Fix**: agregar campo `phase: Boolean` (o `format: 'single_elim'|'groups'`) al payload de la notificación, y renderizar `${n.phase ? 'fase' : 'ronda'}` correspondiente.

11. **Toasts pueden tapar el `BottomNav` en mobile**
    - Archivo: [ToastContainer.module.css](client/src/components/layout/ToastContainer.module.css)
    - El contenedor está fijo bottom-right pero `BottomNav` también está abajo.
    - **Fix**: en `@media (max-width: 960px)` subir `bottom` del container al menos `calc(var(--bottom-nav-height) + 1rem)`.

12. **No hay pausa-on-hover en toasts**
    - Archivo: [ToastContainer.jsx:32-35](client/src/components/layout/ToastContainer.jsx#L32-L35)
    - Si el usuario está leyendo el toast y dura solo 4 s, desaparece.
    - **Fix**: cancelar/pausar `setTimeout` en `onMouseEnter`, reanudar en `onMouseLeave`. Pausar también la animación del progress bar con `animation-play-state: paused`.

13. **Badge de notificaciones en mobile (BottomNav)**
    - Archivo: `client/src/components/layout/BottomNav.jsx`
    - El sidebar tiene badge pero el BottomNav no tiene link a `/notificaciones`. (Confirmar — mirá [feedback_sidebar_bottomnav_sync.md] antes de tocar el orden.)
    - **Fix sugerido**: revisar con el usuario si quiere agregar el item de notificaciones al BottomNav, o si prefiere que la campanita ya esté en el `Navbar` (top en mobile) — ahí sí tiene badge.

### 🟡 P2 — Triggers faltantes (sumar notificaciones nuevas)

14. **Compartidas: comentarios sin notificación al autor**
    - Archivo: `server/routes/compartidas.js` POST `/:id/comments`
    - **Fix**: agregar `saveNotification(post.author, 'compartida_comment', { compartidaId, compartidaTitle, lastCommenterUsername, lastCommentPreview })` cuando el comentarista ≠ autor. Tipo **aggregating** (suma count).
    - Schema: agregar `compartidaId`, `compartidaTitle` al `Notification` model.
    - Socket: emit `compartida:comment` al `user:<authorId>`.

15. **Compartidas: likes sin notificación al autor**
    - Archivo: `server/routes/compartidas.js` POST `/:id/like`
    - **Fix**: en el toggle, si el usuario está agregando like y ≠ autor, `saveNotification(author, 'compartida_like', ...)`. **Aggregating** o **overwrite con count** (preferible aggregating: "3 personas reaccionaron a tu compartida").
    - Quitar la notificación si el usuario quita el like (decrementar count o no — definición: por simplicidad, no quitar; solo agregar al like).

16. **Torneo iniciado**
    - Archivo: `server/routes/torneos.js` PATCH `/:id/status` cuando transiciona a `in_progress`
    - **Fix**: notificar a todos los `participants` con tipo `tournament_started` y socket `torneo:started`. Texto: "Empezó {torneoTitle}. ¡Suerte!"

17. **Torneo finalizado**
    - Archivo: `server/routes/torneos.js` cuando se setea status `finished`
    - **Fix**: notificar a participantes con tipo `tournament_finished` y mencionar al campeón. Socket `torneo:finished`.

18. **Mesa cancelada**
    - Archivo: `server/routes/tables.js` DELETE `/:id`
    - **Fix**: notificar a `players` (no host) + `followers` con tipo `table_cancelled`. Socket `table:cancelled`. Quitar el `setActiveTable` suppression para que igual aparezca al volver.

19. **Solicitud de unión rechazada**
    - Archivo: `server/routes/tables.js` POST `/:id/requests/:userId/reject`
    - **Fix**: notificar al solicitante con tipo `join_rejected`. Socket `join:rejected`. Texto: "Tu solicitud para {tableName} fue rechazada."

20. **Noticia publicada (admin)**
    - Archivo: `server/routes/noticias.js` POST `/`
    - **Fix**: broadcast a todos los usuarios (o subset opt-in). Es costoso si hay miles de users — opción: emitir socket `noticia:published` global sin persistir N copias, y que el cliente muestre toast. Si se quiere persistencia, hacer `bulkWrite` con upsert por `recipient + type 'noticia' + noticiaId`.
    - **Recomendado MVP**: solo emitir socket + toast (sin persistir), igual que un anuncio. Si el usuario está offline pierde el toast pero ve la noticia en `/noticias`.

21. **Amistad: solicitud cancelada (sender side)** — opcional
    - Si el remitente cancela el friend request, hoy se elimina del backend pero la notif persistida en el receptor sigue.
    - **Fix**: en `DELETE /api/friends/:id/request`, hacer `Notification.deleteOne({ recipient, type: 'friend_request', fromUserId: senderId })`.

### 🔵 P3 — Schema / arquitectura / código

22. **Tipos de notificación dispersos sin enum**
    - Archivo: [Notification.js:11](server/models/Notification.js#L11)
    - `type` es String libre — fácil typo silencioso.
    - **Fix**: agregar `enum` con todos los tipos válidos en el schema + exportar constante `NOTIFICATION_TYPES` desde un archivo `server/constants/notifications.js`. Importar en cliente vía duplicación manual (no hay tipos compartidos en este monorepo).

23. **Cleanup de notificaciones viejas**
    - No hay TTL ni purga.
    - **Fix opcional**: agregar `Notification.deleteMany({ updatedAt: { $lt: hace30días }, read: true })` en un cron, o usar TTL index. Bajo prioridad — hoy el límite 60 actúa de tope visual.

24. **Pagination en GET /api/notifications**
    - Hardcoded `limit(60)`. No hay forma de ver más viejas.
    - **Fix opcional**: agregar `?before=<isoDate>` y `?limit=20` para load-more. Bajo prioridad si se implementa filtros (P1.8) — quizás un "Cargar más antiguas" al final de la lista.

25. **`localStorage` puede mezclar usuarios**
    - Archivo: [NotificationContext.jsx:7,47](client/src/context/NotificationContext.jsx#L7)
    - Key `turnocero_notifications` no es por usuario. Si dos cuentas se loguean en el mismo browser, ven notifs cruzadas hasta el `GET /api/notifications` (que sobreescribe).
    - **Fix**: scoping a `turnocero_notifications:${user._id}` o **directamente eliminar el cache de localStorage** y depender solo del server (más limpio; pierde optimismo offline pero es marginal). **Recomendado**: eliminar.

26. **Race: socket reconnect duplica notificaciones**
    - Si el socket envía una nueva notif y casi simultáneamente el reload de `GET /api/notifications` arranca, el GET trae la misma + socket appendea de nuevo. `findExisting` por `(type, tableId)` evita duplicados en aggregating, pero los no-aggregating (friend*accepted, spot_opened, torneo*\*) podrían quedar dos veces si el filtro por `tableId/fromUserId/torneoId` no matchea exactamente.
    - **Fix**: re-key/reduplicar por `(type, tableId || fromUserId || torneoId)` al setear desde el server response. Y al recibir socket, hacer upsert por esa misma key en todos los tipos (no solo aggregating). Función helper `upsertNotif(prev, key, builder)`.

27. **`setNotifications((prev) => [...prev, newOne])` es O(n) y rompe orden**
    - Generalizable: introducir `upsertNotif` helper. Hoy cada handler repite el patrón find-or-append. Refactor: una función central que recibe `(type, keyFields, payload, { aggregate })`.

28. **Toasts no se deduplican**
    - Si llegan 5 mensajes en 1 mesa, aparecen 5 toasts (rotan en max 4). Ideal: el último toast del mismo `(type, tableId)` se actualiza con `count` en lugar de empilarse.
    - **Fix**: en `addToast`, buscar un toast existente con misma key y mergear.

29. **No hay sonido / haptic / Web Push**
    - El proyecto es PWA pero no usa Web Push API. Opcional para futuro.
    - **Fix opcional**: agregar opt-in en `/perfil` para activar Web Push (registrar service worker subscription, endpoint `/api/push/subscribe`). Fuera de scope MVP.

30. **`saveNotification` no devuelve error si schema rechaza**
    - Archivo: [saveNotification.js](server/utils/saveNotification.js)
    - Se llama con `.catch(() => {})` en muchos sitios — silencio total si falla. Considerar al menos `console.error`.

---

## Plan de implementación recomendado

Implementación en fases, cada una mergeable independientemente.

### Fase 1 — Fixes críticos (P0)

**Archivos a modificar:**

- [client/src/pages/notifications/Notifications.jsx](client/src/pages/notifications/Notifications.jsx) — fix orden cronológico + `markRead` para torneos + separar Limpiar/Marcar todas
- [client/src/context/NotificationContext.jsx](client/src/context/NotificationContext.jsx) — agregar `markReadTorneo`, `markAllRead`
- [server/routes/notifications.js](server/routes/notifications.js) — aceptar `torneoId` en `PATCH /read`

### Fase 2 — Persistencia DM + admin chat (P0.4)

**Archivos:**

- [server/models/Notification.js](server/models/Notification.js) — agregar tipos al enum (ver Fase 5)
- [server/utils/saveNotification.js](server/utils/saveNotification.js) — agregar `'dm'` y `'admin_chat'` al set AGGREGATING
- [server/routes/dm.js](server/routes/dm.js) — `saveNotification` en POST, delete en PATCH read
- [server/routes/adminChat.js](server/routes/adminChat.js) — `saveNotification` para cada admin
- [client/src/context/NotificationContext.jsx](client/src/context/NotificationContext.jsx) — al cargar notifs del server, separar `dm` para inyectar en `ChatContext` (vía ref/listener) y `admin_chat` para `adminChatUnread` inicial
- [client/src/context/ChatContext.jsx](client/src/context/ChatContext.jsx) — reconciliación de unread inicial desde notifs persistidas

### Fase 3 — Triggers faltantes (P2)

**Por feature, en orden de impacto:**

1. Compartidas comments (P2.14)
2. Compartidas likes (P2.15)
3. Mesa cancelada (P2.18)
4. Join rechazado (P2.19)
5. Torneo iniciado / finalizado (P2.16, P2.17)
6. Noticias publicadas (P2.20) — solo socket, sin persistir

**Archivos:** `server/routes/{compartidas,tables,torneos,noticias}.js`, `server/models/Notification.js` (campos `compartidaId`, `compartidaTitle`, `phase`).

### Fase 4 — Pantalla nueva con tabs/filtros/timestamps (P1)

**Archivos:**

- [client/src/pages/notifications/Notifications.jsx](client/src/pages/notifications/Notifications.jsx) — refactor con tabs `Todas | Sin leer` + chips de categoría + filter state
- [client/src/pages/notifications/Notifications.module.css](client/src/pages/notifications/Notifications.module.css) — estilos para tabs/chips (usar variables CSS, theme dark+light)
- [client/src/utils/time.js](client/src/utils/time.js) — nuevo helper `formatTimeAgo(date)` con `Intl.RelativeTimeFormat`
- [client/src/components/layout/ToastContainer.jsx](client/src/components/layout/ToastContainer.jsx) — pausa-on-hover, fix bottom en mobile
- Renderizadores para tipos nuevos: `dm`, `admin_chat`, `compartida_*`, `table_cancelled`, `join_rejected`, `tournament_started`, `tournament_finished`

### Fase 5 — Hardening (P3)

- Enum de tipos centralizado (`server/constants/notifications.js`)
- Eliminar `localStorage` cache o scoping por user
- Helper `upsertNotif` en `NotificationContext`
- Dedup de toasts
- Fix race de socket reconnect

---

## Archivos críticos (referencia rápida)

- [client/src/context/NotificationContext.jsx](client/src/context/NotificationContext.jsx) — corazón del sistema cliente
- [client/src/pages/notifications/Notifications.jsx](client/src/pages/notifications/Notifications.jsx) — pantalla
- [client/src/components/layout/ToastContainer.jsx](client/src/components/layout/ToastContainer.jsx) — toasts
- [client/src/context/ChatContext.jsx](client/src/context/ChatContext.jsx) — consumidor de DMs
- [server/models/Notification.js](server/models/Notification.js) — schema
- [server/utils/saveNotification.js](server/utils/saveNotification.js) — upsert
- [server/routes/notifications.js](server/routes/notifications.js) — API
- [server/routes/dm.js](server/routes/dm.js), [server/routes/adminChat.js](server/routes/adminChat.js) — persistencia faltante
- [server/routes/compartidas.js](server/routes/compartidas.js), [server/routes/tables.js](server/routes/tables.js), [server/routes/torneos.js](server/routes/torneos.js), [server/routes/noticias.js](server/routes/noticias.js) — triggers nuevos

---

## Cómo verificar end-to-end

Por cada fase, levantar ambos servers (`npm run dev:server` + `npm run dev:client`) y probar **con dos cuentas en dos browsers** (una incógnita):

**Fase 1:**

- Crear varias notifs de tipos mezclados (chat, friend, torneo). Verificar orden por timestamp descendente. Recargar página y confirmar mismo orden.
- Tocar una notif de torneo → debería marcarse como leída (chip desaparece, opacity baja).
- Click en "Marcar todas como leídas" → ninguna queda con chip. Click en "Limpiar" → confirma + borra.

**Fase 2:**

- Cuenta A manda DM a cuenta B (B offline / no en /mensajes). B vuelve, refresca `/notificaciones` → ve la notif DM. Abre el chat → marca como leída.
- Admin A manda admin-chat. Admin B offline → al volver ve `adminChatUnread > 0` correcto (hidratado desde DB).

**Fase 3:**

- Compartida de A; B comenta → A ve notif card + toast.
- B likea → A ve notif. Si B likea 2 veces (toggle off/on) → count incrementa una sola vez.
- Host cancela mesa → todos los players + followers reciben notif.
- Admin rechaza join request → solicitante recibe notif.
- Torneo arranca/finaliza → todos los participantes reciben notif.

**Fase 4:**

- Tab "Sin leer" muestra solo unreads, contador correcto.
- Filtro por categoría "Torneos" muestra solo `tournament_*`.
- Timestamps muestran "hace X min" y se actualizan tras 1 min sin recargar.
- Toast: hover pausa el progress bar. Mobile: toast no tapa BottomNav.
- Toggle theme dark↔light: todo se ve correcto (revisar variables CSS, no hardcodear colores — ver `[feedback_theme_support]`).

**Fase 5:**

- Login con cuenta A, logout, login con cuenta B → no aparecen notifs de A.
- Forzar reconexión de socket (devtools → Network → offline → online) → no se duplica ninguna notif.
- Llegan 10 mensajes en 1 mesa → aparece 1 solo toast con count 10 (en lugar de 4 toasts rotando).

---

## Notas adicionales

- **Tema dark/light**: toda la nueva UI usa solo variables CSS (`--amber`, `--text-primary`, etc.). Ver memoria `[feedback_theme_support]`.
- **Spanish UI**: todos los strings nuevos en español argentino. Commits en inglés (ver `CLAUDE.md`).
- **Sin tests** automáticos — verificación manual end-to-end por fase.
- **PWA**: las animaciones y transiciones deben sentirse fluidas en mobile (testear en device real, no solo devtools).
- **Sidebar/BottomNav sync** (memoria `[feedback_sidebar_bottomnav_sync]`): si se modifica el item de notificaciones en sidebar (Fase 4), revisar también BottomNav.
