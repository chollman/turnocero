---
name: tech-debt-audit-progress
description: Estado de ejecución del plan plans/tech-debt-audit.md — qué se cerró, qué queda
metadata:
  type: project
---

Progreso del **tech-debt audit** (`plans/tech-debt-audit.md`, ejecutado en sesiones del 2026-05-22). Plan original: 4 fases + 30+ items.

**Why:** El audit fue un sprint dedicado de deuda técnica. Saber qué se hizo evita re-trabajar lo cerrado y orienta qué queda al toque oportunístico.
**How to apply:** Antes de proponer un refactor que toque routers, contextos o duplicación, chequear acá. Si el item ya está cerrado, leer el commit referenciado y los memos relacionados antes de tocarlo.

## Cerrado completamente

### Fase 0 — Quick wins (commit `9435802`)
- **P0.1**: handler `/showcase` duplicado en `tables.js` eliminado.
- **P0.2**: `validateObjectId` aplicado a **todos** los routers (ya no es solo eventos — ver [[validate-objectid-param]]).
- **P0.3**: índices Mongo en `Evento` (status+eventDate, status+createdAt, registrations.user, eventDate+reminderSentAt) y `Table` (status+date, host, players).
- **P0.4**: `useMemo` en `value` de ChatContext + NotificationContext.
- **P0.5**: `safeStorage(get/set/remove)` en AuthContext — tolera `QuotaExceededError` en modo privado.
- **P0.6**: CORS centralizado en `server/config/cors.js`.

### Fase 1 — Refactors estructurales
- **P1.1** NotificationContext (1157 → 386 líneas, -67%): commits `082041e` (reducers puros en `notificationReducers.js`) + `730f7e0` (listeners por dominio en `client/src/context/notificationListeners/`). Ver [[notifications-architecture]].
- **P1.2** TableDetail (1471 → 849 líneas): commit `a6e7c98` — split en `TableChat` / `TableComments` / `TableGallery` / `TableRatings`, cada uno con sus tests.
- **P1.3** CompartidaCard (1155 → 799 líneas): commit `7cc34fb` — extraído `CompartidaComments` (eliminó ~298 líneas de duplicación entre featured/normal) + hook `useCompartidaLike`.
- **P1.4** BGG router (1856 → 779 líneas, -58%): 5 commits secuenciales (`8323dfd`, `b142adb`, `8454467`, `1434a5d`, `a1f9186`) extrayendo a `server/services/bgg/`: aggregations, search, cache L1, cooldown, parse, resolve, syncEngine, mutations. Ver [[service-layer-pattern]].
- **P1.5** torneos.js + eventos.js: commits `2e03a86` + `aeb2466` — business logic a `server/services/torneoService.js` + `server/services/eventoService.js`.
- **P1.6** asyncHandler + errorHandler central: commit `a85eeb5` — infra creada, **solo noticias + friends migrados** ([[asyncHandler-errorHandler-pattern]]). Migración del resto es incremental.

### Fase 2 — Hooks y utils (commit `0971bb7`)
- **P2.1** `useApi`, **P2.2** `useShowcaseTables`, **P2.3** `passwordValidation`, **P2.4** `storageKeys`, **P2.5** `getErrorMessage`, **P2.6** `socketHelpers`, **P2.7** `idCompare.isSameId`, **P2.8** `paginate.parsePagination`. Ver [[shared-helpers-catalog]].

### Fase 3 — Polish (commits `2b36c05` + `4d7588d`)
- **P3.2** rollback con toast en `TableDetail.handleFollow` + `handleReact`.
- **P3.4** DOM refs declarativos en `UserProfile` (`bggFieldRef` / `bggInputRef`).
- **P3.5** voseo argentino revisado, era falso positivo.
- **P3.6** `loading="lazy"` + `decoding="async"` en lightbox de Eventos y BgWatchPerGameView.
- **P3.7** `htmlFor` + `id` en todos los labels de auth pages (Login, Register, Forgot/ResetPassword, VerifyEmail).
- **P3.8** ChatWindow header con `role="button" tabIndex={0} onKeyDown` para a11y.
- **P3.9** `addToast` en catch de envío de DM (convención [[errors-as-toasts]]).

### Fase 4 — Infraestructura
- **P4.1** coverage thresholds en Vitest (commit `a10bad5`): server 55/47/55/55, client 75/68/70/80 (~3-7% bajo baseline real).
- **P4.3** logger estructurado: commits `d9d3104` (eventos + saveNotification) + `219e1a4` (BGG modules). Logs JSON con stack trace preservado.
- **P4.4** `client/src/api/endpoints.js` como fuente única: commit `2f5abf9` — ver [[api-endpoints-pattern]].

## Pendiente (incremental, al toque oportunístico)

- **P1.6** restante: migrar `auth.js`, `bgg.js`, `tables.js`, `torneos.js`, `eventos.js`, `compartidas.js`, `dm.js`, etc. a `asyncHandler` cuando se toquen.
- **P4.4** restante: migrar a `API` namespace en UserProfile, CreateTable, TableDetail+subs, EventoDetail/Form/Inscripciones, TorneoDetail/CreateTorneo, CompartidaPost/Card subs, Messages/DirectChat, DatabaseViewer, ChatLauncher, BggGameSearch.
- **P3.1** auditar `eslint-disable-next-line react-hooks/exhaustive-deps` sin comentario en TableDetail:234, NotificationContext (ya migrado a listeners — verificar si sigue), BottomNav:245.
- **P3.3** migrar `let cancelled = false` a `AbortController` en fetchs (TableDetail tenía uno; CreateTable es la referencia correcta).
- **P4.2** tests faltantes en `App.jsx`, `Modal.jsx`, `GameTile.jsx`.
- **P4.5** rate limiting en `POST /api/bgg/sync`, `POST /api/bgg/partidas`, `POST /api/eventos/:id/ludoteca`, `POST /api/eventos/:id/inscribirse`.
- **P4.6** safeguard de race en cron `eventoReminders` (mutex/lease en Mongo).

## Métricas finales (post-fase)

Tests verde al cierre: **808 server + 1550 client = 2358 total** (vs 518 + 1377 = 1895 antes del audit — +463 tests en la fase).
ESLint en 0 (lo seguía estando desde `6faf3dc`).
