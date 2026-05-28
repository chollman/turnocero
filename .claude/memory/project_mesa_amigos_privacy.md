# Privacy "Amigos" en mesas + endurecimiento de privadas + notifs join/leave (2026-05-28)

Feature mergeada a master en 3 commits: `136d40d` (Amigos + gating), `0dab72d` (player_joined), `f1994e8` (player_left).

## Modelo de privacy expandido

`Table.privacy` enum pasó de `['public', 'private']` → `['public', 'friends', 'private']`. Default sigue `'public'`. Sin migración (valor aditivo).

| Privacy | Listado | Detalle no-amigo | Join | Comments / Ratings / Share / Follow |
|---|---|---|---|---|
| `public` | visible a todos | 200 | directo | activos |
| `friends` | solo amigos del host | **404** (no revelar existencia) | directo (amigos) | **deshabilitados** |
| `private` | visible a auth | 403 anon / 200 auth | pendingRequest (igual que antes) | **deshabilitados** (cambio de comportamiento) |

Decisiones acordadas:
- Join en `friends` → directo (paridad con public, sin pendingRequest).
- No-amigo accede vía URL directa → **404**, no 403 (misma convención que drafts de torneos).
- Comments/ratings viejos preexistentes en una mesa que cambia a non-public → **se mantienen visibles**, solo se bloquea POST nuevo.

## Helper compartido — `server/utils/tablePrivacy.js`

Única fuente de verdad para visibilidad y gating de mesas. Exporta:

- `canViewTable(table, user, friendIds)` → boolean. Anónimo solo ve public; auth ve public+private; friends visible si host/player/amigo.
- `buildPrivacyFilter(user, friendIds)` → cláusula Mongo lista para `Table.find({...})`. Para auth: `$or` con `public+private`, `friends`+host∈friends, host=me, players=me.
- `assertCanComment(table)` / `assertCanRate(table)` / `assertCanFollow(table)` / `assertLinkable(table)` → tira `httpError(403|400, "...solo en mesas públicas")` si `privacy !== 'public'`. Aplicado en `comments.js` POST, `ratings.js` POST, `tables.js` POST `/:id/follow`, `compartidas.js` POST/PUT con `linkedTable`.

Helper auxiliar: `server/utils/friendIds.js#getFriendIds(userId)` (lean lookup de `User.friends`, []  si null user). Usado en `listTables` y en GET `/:id`.

**Antes de inventar otro helper de visibilidad de mesas, mirar este archivo primero.**

## Endpoints públicos endurecidos

`GET /api/tables/showcase` y `GET /api/tables/top-games` filtraban por `status: 'cancelled'` pero no por privacy → exponían privadas. Ahora ambos agregan `privacy: 'public'`. Vistas pre-auth solo muestran mesas verdaderamente públicas.

## Followers "inert" en non-public

El botón "Seguir mesa" se deshabilita en `friends` y `private` (no solo `friends`). Los `followers[]` legacy de privadas/friends NO se migran ni se borran — quedan en el doc como artefacto pero **no reciben más eventos**:

- `spot_opened` (POST `/:id/leave`) → solo emite a followers si `privacy === 'public'`.
- `image` notif (POST `/:id/images`) → recipients incluye followers solo si `privacy === 'public'`. Host + players siempre.
- `table_cancelled` (DELETE `/:id`) → recipients incluye followers solo si `privacy === 'public'`. Players siempre.

Si introducís un nuevo notif que itere `table.followers`, agregale el mismo gate `privacy === 'public'`. Sin esto, los followers legacy reciben stream de eventos que no pueden capitalizar.

## Nuevos tipos de notificación: `player_joined` / `player_left`

Antes el host no se enteraba cuando alguien se unía o se iba de una mesa pública. Agregados:

- **`player_joined`**: emitido en POST `/:id/join` en la rama directa (public + friends). NO en private (ya existe `join_request` para eso). Aggregating (varios joins → 1 notif con count). Campo: `lastJoinerUsername`.
- **`player_left`**: emitido en POST `/:id/leave` en **las 3 privacies** (el host quiere saber siempre que pierde a alguien). Aggregating. Campo: `lastLeaverUsername`.

Eventos socket: `table:player-joined`, `table:player-left`. Ambos suprimidos por `activeTableRef` (si el host está mirando la mesa, no toast).

UI: ícono 🙌 (joined, chip `accepted`) / 🚪 (left, chip `request`).

Para agregar un tipo nuevo de notif de mesa el checklist es:
1. `server/models/Notification.js` → `NOTIFICATION_TYPES` enum + cualquier campo `last*Username`.
2. `server/utils/saveNotification.js` → agregar a `AGGREGATING` Set si suma count, y mapear en `TYPE_TO_SECTION` (`'mesas'`).
3. `server/routes/tables.js` (o donde corresponda) → `emitNotificationReq(req, recipient, type, fields, socketEvent, extra)`.
4. `client/src/context/notificationReducers.js` → reducer `applyXxxNotif` (usar `upsertAggregating` si aggregating, `replaceResource` si non-aggregating).
5. `client/src/context/notificationListeners/useTableNotificationListeners.js` → listener nuevo + supresión por `activeTableRef`.
6. `client/src/pages/notifications/Notifications.jsx` → agregar a `CATEGORIES.mesas` + case en `getNotifMeta`.
7. `client/src/components/layout/ToastContainer.jsx` → `DURATION`, ícono, title, body en los nested ternaries.
8. Tests: server integration cubriendo cada privacy + cliente reducer test + listener registration test (cuenta de eventos esperados).

## Cuándo NO emitir notif al host

Hoy, en mesas públicas/friends:
- Alguien se une → `player_joined` ✓
- Alguien se va → `player_left` ✓
- Alguien comenta → `comment` (solo en public; comments están gated en otras) ✓
- Alguien sube foto → `image` (host + players) ✓
- Alguien chatea → `chat` (host + players) ✓

NO se notifica al host cuando:
- Alguien pide unirse a `private` → host recibe `join_request` (distinto), no `player_joined`. El host después acepta y dispara `join_accepted` al requester.
- Alguien sigue una mesa pública (no hay notif "X te sigue") — feature no implementada, probablemente innecesaria.

## Archivos clave (referencia rápida)

```
server/
  utils/tablePrivacy.js        — fuente de verdad
  utils/friendIds.js           — lookup helper
  routes/tables.js             — list/get/join/leave/follow/cancel
  routes/comments.js           — POST gated
  routes/ratings.js            — POST gated
  routes/compartidas.js        — linkedTable gated
  routes/images.js             — followers excluidos si non-public
  models/Notification.js       — enum + campos
  utils/saveNotification.js    — AGGREGATING + TYPE_TO_SECTION

client/
  pages/tables/MesaForm.jsx                       — 3 tarjetas de privacy
  pages/tables/TableDetail.jsx                    — badge + gating share/follow + props
  pages/tables/TableComments.jsx                  — canPost prop
  pages/tables/TableRatings.jsx                   — lockedByPrivacy prop
  pages/dashboard/{TableCard,Dashboard}.jsx       — badge + filtro
  pages/compartidas/CreateCompartidaForm.jsx      — dropdown filter
  context/notificationReducers.js                 — applyPlayerJoinedNotif/applyPlayerLeftNotif
  context/notificationListeners/useTableNotificationListeners.js
  pages/notifications/Notifications.jsx           — getNotifMeta + CATEGORIES
  components/layout/ToastContainer.jsx            — DURATION + ícono + title + body
```

## Tests de regresión clave

- `server/tests/unit/utils/tablePrivacy.test.js` — tabla de verdad 3 privacies × 4 perfiles para `canViewTable` y `buildPrivacyFilter`.
- `server/tests/integration/tables.test.js` — bloques `describe("Privacy 'friends'")` + `describe("Notificación 'player_joined'")` + `describe("Notificación 'player_left'")` + `describe("Notificaciones — gating por privacy")`.
- `server/tests/integration/images.test.js` — followers no reciben `image` notif en non-public.
- `client/src/context/notificationReducers.test.js` — agregación de player_joined/player_left.
