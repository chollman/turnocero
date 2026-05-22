# Tech Debt Audit — Turnocero

**Fecha:** 2026-05-22
**Alcance:** monorepo completo (`client/` React 18 + Vite, `server/` Express + Mongoose + Socket.IO)
**Método:** auditoría paralela por 4 agentes especializados (React, Node/Express, dead code + duplicación, cross-cutting concerns).

Este plan consolida hallazgos priorizados por **impacto × esfuerzo**. No es un changelog — es una hoja de ruta para atacar deuda técnica en fases. Cada item lleva `path:line` y direccción de fix.

---

## Estado general

El codebase está **en buen estado base**:

- Sin `dangerouslySetInnerHTML`, sin `eval`, sin open redirects.
- 1895 tests pasando, sin `.skip` / `it.only`.
- PWA, helmet, CORS, JWT, rate limiting en auth — todos configurados.
- Tema claro/oscuro funcionando, focus management en `<Modal>` shared.
- ESLint llevado a cero (`6faf3dc`), Prettier vía hook.

**Pero**: el crecimiento del último trimestre dejó componentes y routers de 1000-1800 líneas, validación inconsistente, duplicación creciente y algunos bugs latentes. Atacar esto ahora antes de que escale.

---

## Fase 0 — Quick wins (1-2 días, alto impacto, bajo riesgo)

Cosas que se arreglan en una sesión y desbloquean confianza.

### 🔴 P0.1 — Eliminar handler `/showcase` duplicado en `tables.js`

- **Archivo:** [server/routes/tables.js:205-243](server/routes/tables.js)
- **Bug:** dos `router.get("/showcase", ...)` byte-por-byte idénticos. Express monta ambos; el segundo es dead code.
- **Fix:** borrar el segundo bloque (líneas 225-243). Verificar que el test de integración pase.
- **Esfuerzo:** 2 min.

### 🔴 P0.2 — Aplicar `validateObjectId` consistentemente en todos los routers

- **Estado actual:** sólo `routes/eventos.js:29-30` usa `router.param("id", validateObjectId(...))`. Los demás dejan que Mongoose tire CastError 500 con malformed IDs.
- **Archivos a tocar:** `routes/torneos.js`, `routes/tables.js`, `routes/bgg.js`, `routes/compartidas.js`, `routes/noticias.js`, `routes/friends.js`, `routes/dm.js`, `routes/users.js`, `routes/comments.js`, `routes/messages.js`, `routes/ratings.js`, `routes/images.js`, `routes/adminChat.js`.
- **Fix:** al tope de cada router agregar `router.param("id", validateObjectId("id"))` y para cualquier otro param ObjectId (`userId`, `matchId`, `gameId`, etc.).
- **Memory:** ya está documentado como regla — esta es una regresión.
- **Esfuerzo:** 30 min + revisión de tests.

### 🔴 P0.3 — Agregar índices Mongo en `Evento` y `Table`

- **Archivos:** [server/models/Evento.js](server/models/Evento.js) (cero índices), [server/models/Table.js](server/models/Table.js) (solo `eventoId`).
- **Fix:**
  ```js
  // Evento.js — al final del schema
  eventoSchema.index({ status: 1, eventDate: 1 });
  eventoSchema.index({ status: 1, createdAt: -1 });
  eventoSchema.index({ "registrations.user": 1 });
  // Table.js
  tableSchema.index({ status: 1, date: 1 });
  tableSchema.index({ host: 1 });
  tableSchema.index({ "players.user": 1 });
  ```
- **Por qué:** queries de `GET /api/eventos` y `GET /api/tables` (con filtros de status/fecha) hoy son full collection scans.
- **Esfuerzo:** 15 min + smoke test.

### 🟡 P0.4 — `useMemo` en `value` de ChatContext y NotificationContext

- **Archivos:**
  - [client/src/context/ChatContext.jsx:203-212](client/src/context/ChatContext.jsx) — value objeto literal, sin memo.
  - [client/src/context/NotificationContext.jsx:1083-1109](client/src/context/NotificationContext.jsx) — ídem.
- **Bug:** cada re-render del provider crea un value nuevo → cascada de re-renders en todos los consumers.
- **Fix:** envolver value en `useMemo(() => ({...}), [deps])`. AuthContext ya lo hace bien (líneas 143-148) — copiar patrón.
- **Esfuerzo:** 30 min + test de re-render con `React.Profiler` o tests existentes.

### 🟡 P0.5 — `try/catch` en lecturas/escrituras de `localStorage` en `AuthContext`

- **Archivo:** [client/src/context/AuthContext.jsx:28, 35-36, 48-49, 65, 76, 84, 99, 122-123](client/src/context/AuthContext.jsx)
- **Bug:** Safari/Firefox en modo privado tiran `QuotaExceededError`. Si una de estas falla, el provider rompe y la app no monta.
- **Fix:** wrappear en `try/catch` (patrón en `ThemeContext.jsx:19-23` es la referencia).
- **Esfuerzo:** 20 min.

### 🟡 P0.6 — Centralizar config CORS entre `app.js` y `server.js`

- **Archivos:** [server/app.js:8-25](server/app.js), [server/server.js:29-38](server/server.js) — `allowedOrigins` duplicado.
- **Fix:** mover a `server/config/cors.js`, exportar `{ allowedOrigins, corsOptions }`.
- **Esfuerzo:** 15 min.

---

## Fase 1 — Refactors estructurales (1-2 semanas)

Cosas que requieren plan, branches separadas y tests adicionales. Cada item es un PR independiente.

### 🔴 P1.1 — Split de `NotificationContext.jsx` (1123 líneas, 25+ socket listeners)

**Problema:** un único archivo maneja toda la lógica de notificaciones (chat, friends, torneos, compartidas, eventos, DMs), toasts, y conexión Socket.IO. Cualquier cambio en un dominio toca este monolito.

**Estrategia:**
1. Mantener un `NotificationContext` slim que sólo posea `state` + dispatch.
2. Extraer los listeners por dominio a hooks colocados con su feature:
   - `client/src/pages/torneos/useTorneoNotifications.js`
   - `client/src/pages/eventos/useEventoNotifications.js`
   - `client/src/pages/compartidas/useCompartidaNotifications.js`
   - `client/src/pages/messages/useChatNotifications.js`
3. Cada hook usa `socketRef` desde un nuevo `SocketContext` (provider único de la conexión).
4. Memoizar `value` y usar `useSyncExternalStore` si vale la pena.

**Riesgo:** alto — toca la columna vertebral del realtime. Hacer en branch con tests de regresión activos. La memoria de `notifications-contract` (servidor pushea `notifId`+`count` absoluto) tiene que seguir respetándose.

**Esfuerzo:** 3-4 días + suite completa de regresión.

### 🔴 P1.2 — Split de `TableDetail.jsx` (1471 líneas, 27 `useState`)

**Archivos derivados a crear:**
- `client/src/pages/tables/TableChat.jsx` — chat de la mesa (socket, mensajes, lista).
- `client/src/pages/tables/TableComments.jsx` — comentarios.
- `client/src/pages/tables/TableGallery.jsx` — imágenes + upload.
- `client/src/pages/tables/TableRatings.jsx` — ratings (también ayuda a desbloquear la UI de ratings pendiente — ver "Known limitations" en CLAUDE.md).
- `client/src/pages/tables/TableJoinPanel.jsx` — botones join/leave/follow + flujo de pendingRequests.
- `client/src/pages/tables/useTableData.js` — hook con fetch + invalidación + socket subs.

**Bonus:** revisar [client/src/pages/tables/TableDetail.jsx:234](client/src/pages/tables/TableDetail.jsx) — `eslint-disable-next-line react-hooks/exhaustive-deps` sin comentario. Documentar la razón o añadir las deps faltantes.

**Esfuerzo:** 3-4 días.

### 🔴 P1.3 — Split de `CompartidaCard.jsx` (1155 líneas)

Similar a P1.2:
- `CompartidaHeader`, `CompartidaGallery`, `CompartidaLightbox`, `CompartidaComments`, `CompartidaActions`.
- Hooks: `useCompartidaLike`, `useCompartidaComments`.

**Esfuerzo:** 2-3 días.

### 🟡 P1.4 — Reorganizar `server/routes/bgg.js` (1856 líneas)

**Problema:** lógica de sync con BGG, caché en memoria, mutación via `geekplay.php`, y HTTP handling, todo en un solo archivo.

**Estrategia:**
1. Mover servicios a `server/services/bgg/`:
   - `bggGameService.js` (search, getDetails)
   - `bggCollectionService.js` (resolveCollection, refresh)
   - `bggPlayService.js` (CRUD + sync) — ya hay parcial en `utils/bggSync.js`, consolidar.
   - `bggAuthService.js` (sesión + write quirks, mover desde `utils/bggAuth.js`).
2. `routes/bgg.js` queda como capa HTTP delgada.
3. Aplicar `express-validator` a todos los body params (hoy `req.body.objectid`, `req.body.playdate` van sin validar — ver `bgg.js:1682-1683`).
4. Rate limit en `/sync` y `/partidas` POST/PUT/DELETE.

**Esfuerzo:** 3-4 días.

### 🟡 P1.5 — Reorganizar `server/routes/torneos.js` y `server/routes/eventos.js` (1657 + 1647 líneas)

**Estrategia:** extraer `services/TorneoService.js` y `services/EventoService.js`. Lo concreto a mover:

- `torneos.js`: validación de transiciones de estado, generación de fixtures, helpers de standings.
- `eventos.js`: `closePastOpenEvents`, `notifyActiveRegistrations`, `reloadRegPopulated`, helpers de socket — algunos ya son funciones locales en el router (líneas 43-69).

**Esfuerzo:** 2-3 días cada uno.

### 🟡 P1.6 — `asyncHandler` wrapper para routers

**Problema:** 80+ `try/catch` repetidos en routers. Cambiar el contrato de error (ej. agregar logging global) requiere editar todos.

**Fix:**
```js
// server/utils/asyncHandler.js
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```
Más un middleware central de error handler en `server/middleware/errorHandler.js` que normalice respuestas a `{ message }`.

**Esfuerzo:** 1 día + migrar incrementalmente.

---

## Fase 2 — Hooks y utilidades compartidas (paralelo a Fase 1)

Extracciones puntuales que matan duplicación. Cada una es un PR pequeño.

### 🟡 P2.1 — Hook `useApi` / `useFetchWithLoading`

**Patrón duplicado en 20+ componentes:**
```js
const [loading, setLoading] = useState(false);
setLoading(true);
try { /* axios */ } catch (e) { /* toast */ } finally { setLoading(false); }
```

**Crear:** `client/src/hooks/useApi.js` con `{ loading, error, execute, data }`. Migrar incrementalmente (no big-bang).

### 🟡 P2.2 — Hook `useShowcaseTables`

**Aparece en 5 auth pages** ([Login.jsx:71](client/src/pages/auth/Login.jsx), [Register.jsx](client/src/pages/auth/Register.jsx), [ForgotPassword.jsx:20](client/src/pages/auth/ForgotPassword.jsx), [ResetPassword.jsx:26](client/src/pages/auth/ResetPassword.jsx), [VerifyEmail.jsx:43](client/src/pages/auth/VerifyEmail.jsx)):

```js
useEffect(() => {
  axios.get('/api/tables/showcase').then(...).catch(() => {});
}, []);
const [seed] = useState(() => Math.floor(Math.random() * 100));
```

**Fix:** `client/src/hooks/useShowcaseTables.js` con seed incluido.

### 🟡 P2.3 — `client/src/utils/passwordValidation.js`

**Duplicado en:**
- [Register.jsx:43-47](client/src/pages/auth/Register.jsx)
- [ResetPassword.jsx:40-45](client/src/pages/auth/ResetPassword.jsx)

```js
export function isValidPassword(pwd) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd);
}
export const PASSWORD_REQUIREMENTS = 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número';
```

### 🟡 P2.4 — `client/src/utils/storageKeys.js` y `client/src/utils/messages.js`

**StorageKeys:** strings sueltos en 5+ lugares (`'token'`, `'viewAsUser'`, `'bannedMessage'`, `'flashMessage'`, `'turnocero_pending_verify_email'`).

**Messages:** mensajes de error/éxito ("Algo salió mal", "Error al registrarse"...) sueltos. Si en algún momento entra i18n, agradeceremos tenerlos centralizados.

### 🟡 P2.5 — `getErrorMessage(err, defaultMsg)` helper

**Patrón:** `err.response?.data?.message || 'default'` aparece en 10+ catches. Una función de 1 línea.

### 🟡 P2.6 — `server/utils/socketHelpers.js`

**Duplicado:** `emitToUser`, `emitToEventoRoom`, `emitToEventosList` viven en [eventos.js:43-69](server/routes/eventos.js) como funciones locales. Replicados pattern (sin nombre) en `tables.js`, `torneos.js`, `dm.js`.

**Fix:** centralizar en `server/utils/socketHelpers.js`.

### 🟢 P2.7 — `server/utils/idCompare.js` con `isSameId(a, b)`

**Patrón:** `obj.userId.toString() !== req.user._id.toString()` aparece 180+ veces en server. Un helper de 2 líneas.

### 🟢 P2.8 — `server/utils/paginate.js`

Hoy `page`/`limit` se parsean en cada router con límites distintos (eventos 20, tables 50). Unificar.

---

## Fase 3 — Bugs latentes y calidad (continuo)

Cosas para atacar en el día a día, no requieren branch dedicada.

### 🔴 P3.1 — Auditar `useEffect` con `eslint-disable react-hooks/exhaustive-deps` sin comentario

**Archivos:**
- [TableDetail.jsx:234](client/src/pages/tables/TableDetail.jsx) — sin comentario.
- [NotificationContext.jsx:919](client/src/context/NotificationContext.jsx) — sin comentario.
- [BottomNav.jsx:245](client/src/components/layout/BottomNav.jsx) — sin comentario.
- [Eventos.jsx:325](client/src/pages/eventos/Eventos.jsx) — **bien documentado**, mantener como ejemplo.

**Fix:** o documentar por qué la dep falta intencionalmente, o agregar la dep (probablemente hay closures stale escondidas).

### 🟡 P3.2 — Optimistic updates sin rollback explícito

- [TableDetail.jsx:311-333](client/src/pages/tables/TableDetail.jsx) — `handleFollow` actualiza state antes del HTTP, no rollback claro.
- [EventoInscripciones.jsx:152-182](client/src/pages/eventos/EventoInscripciones.jsx) — accept/reject sin rollback.

**Fix:** snapshot del state previo, `catch` revierte. O usar `useTransition` (React 18) para "pending state" implícito.

### 🟡 P3.3 — Race conditions en fetchs con navegación rápida

- [TableDetail.jsx:236-264](client/src/pages/tables/TableDetail.jsx) usa flag `let cancelled = false` (manual, error-prone).
- [CreateTable.jsx:76](client/src/pages/tables/CreateTable.jsx) usa `AbortController` (correcto — usar como referencia).

**Fix:** migrar todos los `let cancelled` a `AbortController` con `signal` en axios.

### 🟡 P3.4 — DOM imperativo donde alcanza con `useRef`

- [UserProfile.jsx:84-87](client/src/pages/users/UserProfile.jsx) — `document.getElementById('bgg-username-field').querySelector('input')`.
- [App.jsx:67-70](client/src/App.jsx) — `document.getElementById(hash.slice(1))` para scroll.

**Fix:** `useRef` declarativo.

### 🟡 P3.5 — Voseo argentino inconsistente

**Archivos auth:**
- [Login.jsx:119](client/src/pages/auth/Login.jsx) — "Sumate a tu próxima partida" ✓
- [ForgotPassword.jsx](client/src/pages/auth/ForgotPassword.jsx) — "¿Olvidaste tu contraseña?" → considerar "¿Olvidaste tu clave?"
- Hay alguna mezcla "tu" formal vs "vos". Revisar UX copy en pages de auth.

**Fix:** una pasada de copy review.

### 🟢 P3.6 — Imágenes sin `loading="lazy"` ni `width`/`height`

- [EventoDetail.jsx:562, 702](client/src/pages/eventos/EventoDetail.jsx)
- [BgWatchPerGameView.jsx:165](client/src/pages/bg-watch/BgWatchPerGameView.jsx)

**Fix:** lazy + dimensiones para evitar CLS.

### 🟢 P3.7 — Labels sin `htmlFor` en auth forms

- [Login.jsx:127](client/src/pages/auth/Login.jsx)
- [Register.jsx](client/src/pages/auth/Register.jsx)
- [ForgotPassword.jsx](client/src/pages/auth/ForgotPassword.jsx)

**Fix:** asociar `id` ↔ `htmlFor`. Mejora a11y básica.

### 🟢 P3.8 — `<div onClick>` sin role="button"

- [ChatWindow.jsx:56](client/src/components/chat/ChatWindow.jsx) — header colapsa.
- Backdrops de algunos modales ad-hoc (verificar que estén usando `<Modal>` shared, no divs custom).

**Fix:** `role="button" tabIndex={0} onKeyDown=...` o convertir a `<button>`.

### 🟢 P3.9 — `addToast({ type: 'error' })` faltante en algunos `catch`

- [ChatWindow.jsx:44-48](client/src/components/chat/ChatWindow.jsx) — catch silencioso restaura el input pero no notifica.
- Otros catches en `ChatContext` y `NotificationContext` son intencionalmente silenciosos (mark-read, badges) — OK mantener.

**Memory:** convención "errores PUT/POST/DELETE van por toast tipo error".

---

## Fase 4 — Infraestructura de calidad (long-term)

### 🟡 P4.1 — Coverage thresholds en Vitest

**Archivos:** `client/vitest.config.js`, `server/vitest.config.js` — sin thresholds.

**Fix:** agregar mínimos prudentes para no degradar:
```js
coverage: { lines: 70, functions: 70, branches: 65, statements: 70 }
```

### 🟡 P4.2 — Tests faltantes para componentes core

- `App.jsx` sin test (rutas + provider mounts).
- `Modal.jsx` sin test (focus management, Escape, restauración).
- `GameTile.jsx` sin test.

**Fix:** uno por uno, en PRs chicos.

### 🟢 P4.3 — Logger consistente en server

Existe [server/utils/logger.js](server/utils/logger.js) pero muchos handlers en `routes/bgg.js`, `routes/eventos.js`, jobs/, etc., siguen usando `console.log/warn/error` directo. Migrar.

### 🟢 P4.4 — Centralizar paths de API en `client/src/api/endpoints.js`

26+ apariciones de `/api/bgg/partidas/...`, 19 de `/api/bgg/coleccion/...`, 13 de `/api/compartidas`, 11 de `/api/tables/mine`. Un typo en una path manda al usuario a un 404 silencioso. Centralizar:

```js
export const API = {
  COMPARTIDAS: '/api/compartidas',
  COMPARTIDA_DETAIL: (id) => `/api/compartidas/${id}`,
  ...
};
```

### 🟢 P4.5 — Rate limiting en endpoints caros

- `POST /api/bgg/sync` (full re-fetch contra BGG)
- `POST /api/bgg/partidas` (write a BGG)
- `POST /api/eventos/:id/ludoteca` (BGG resolveGame batch)
- `POST /api/eventos/:id/inscribirse` (upload Cloudinary)

Hoy sólo auth está rate-limited. Aplicar `express-rate-limit` por user en estos.

### 🟢 P4.6 — Safeguard de cron job `eventoReminders`

[server/jobs/eventoReminders.js](server/jobs/eventoReminders.js) corre cada hora. La idempotencia con `reminderSentAt` está bien, pero si dos instancias del cron arrancan a la vez (ej. al reiniciar), hay ventana de race. Agregar un "lease" en Mongo (TTL doc) o semáforo en memoria.

---

## Lo que NO toca este plan

Cosas que se mencionaron en la auditoría pero están bien o son aceptables:

- **JWT en localStorage** — decisión arquitectónica conocida (memoria), no es un hallazgo nuevo.
- **CSS hardcoded en `ChatWindow.module.css`** — los neon cyan/magenta son efectos visuales deliberados (cyberpunk glitch — memoria `feedback_cyberpunk_glitch`), no tokens de tema.
- **Catches silenciosos en `mark-read`** — son intencionales (UX no crítica).
- **`virtuals` en `Table` schema** — funcionan, documentar que son read-only basta.
- **PWA config** — adecuada para producción.

---

## Orden recomendado para empezar

Si tuviera que ordenar por **valor en una semana** sin meterme con refactors grandes:

1. **Día 1 (mañana)**: P0.1, P0.2, P0.3 — 3 PRs chicos, alto valor (bug + indexes + consistencia).
2. **Día 1 (tarde)**: P0.4, P0.5, P0.6 — memo + try/catch + CORS.
3. **Día 2-3**: P2.1 + P2.2 + P2.3 + P2.4 — extracciones de hooks/utils. Cada uno PR chico.
4. **Día 4-5**: P1.2 (split de `TableDetail`) — el más doloroso pero el que más libera.
5. **Semana 2+**: P1.1 (`NotificationContext`), P1.3 (`CompartidaCard`), P1.4 (`bgg.js`) en paralelo a temas de producto.

P3 y P4 son continuos — atacar oportunísticamente cuando se toque ese código.

---

## Notas para sesiones futuras

- Antes de cualquier refactor de `NotificationContext`, releer las memorias de `notifications-contract` y `optimistic-vs-socket` — el contrato server-pushed `notifId`+`count` no se puede romper.
- Antes de tocar `bgg.js`, ver `feedback_bgg_sync_engine`, `feedback_bgg_write_quirks`, `feedback_bgg_username_case` y `feedback_user_lock_semantics`.
- Cada nuevo archivo/componente ship con su test (regla activa desde 2026-05-18).
