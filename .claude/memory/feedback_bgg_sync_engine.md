---
name: feedback-bgg-sync-engine
description: Sync engine para BggPlay (Phase 4) — probe page-1 + reconcile dirigido + reconcile completo periódico + hash drift detection. Reemplaza el wipe-and-refetch destructivo y minimiza requests a BGG.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9099d291-a3e5-40aa-9a9f-b0de83c3a6e6
---

Cuando se trabaje en la sincronización de partidas BGG (o se extienda el patrón a otra entidad sincronizable con BGG), seguir la arquitectura de tres niveles establecida en Phase 4 ([plans/bgg-sync-strategy.md](plans/bgg-sync-strategy.md)):

1. **Sondeo barato (`probe()`)** — 1 request a `/plays?page=1`. Compara `total` remoto vs `BggPlay.countDocuments` y los hashes de las 30 más recientes. Outcomes: `no_drift` (caso común, 0 escrituras), `edits_only` (upsert de las que difieren), `reconciled` (delega a reconcile dirigido). En `GET /api/bgg/partidas/:user` la acción la decide el helper puro `decidePlaysSyncAction({ lastProbedAt, lastFullSyncAt, now, viewerIsOwner })` (en bggSyncEngine.js, testeable sin Mongo). **Regla actual (2026-06, post-fix "se actualiza más seguido que 3 h") — un único umbral de 3 h, solo para el dueño:**
   - **No-dueño** (cualquiera que mire un perfil ajeno, incl. anónimo): **NO dispara nada**. La frescura de ese perfil depende de las visitas de su propio dueño + el botón manual + el reconcile de 30 d.
   - **Dueño/admin + `lastProbedAt > AUTO_REFRESH_STALE_MS` (3 h)**: **probe SINCRÓNICO** (datos frescos en la misma request). Si además `lastFullSyncAt > 30 d`, dispara el reconcile completo en **background** (pesado, nunca sincrónico).
   - **Dueño + `< 3 h`**: nada, se sirve de Mongo.
   - `?refresh=1` siempre es sincrónico (con cooldown 60 s aparte). El route lleva `optionalAuth` para conocer al dueño (`req.user.bggUsername` case-insensitive, o `isAdmin`).

   **OJO — antibug:** NO reintroducir un tier de "background probe cada 5 min". Existía (`PROBE_THROTTLE_MS`) y causaba el bug: el background probe se disparaba cada 5 min y **reseteaba `lastProbedAt`**, con lo cual `probeAge` nunca llegaba a las 3 h → se actualizaba mucho más seguido que lo seteado. `PROBE_THROTTLE_MS` y `triggerBackgroundProbe` siguen existiendo como primitivas pero **ya NO se usan** en la decisión de `/partidas`.

   **Por qué el sincrónico-al-entrar:** antes el probe SIEMPRE era fire-and-forget en la entrada, así que las partidas nuevas/editadas directo en BGG aparecían recién en la PRÓXIMA visita ("una visita tarde"). El refresco sincrónico para el dueño cierra eso, alineando Partidas con la Colección (fetch sincrónico al vencer su TTL de 6 h vía `resolveCollection`). La respuesta del path Mongo incluye un bloque `sync: { lastProbedAt, lastFullSyncAt, lastProbeOutcome }` que el cliente usa para el label "Actualizado hace X" (`PartidasPanel.jsx` + `formatTimeAgo`).

2. **Reconcile dirigido (`reconcileFull({ full: false })`)** — cuando el sondeo detecta count drift. Pagina BGG upsert-by-playId, corta apenas encuentra una página entera con hashes locales matching. Delete detection conservadora: solo borra plays con `date > minSeenDate` (boundary ambiguo se respeta).

3. **Reconcile completo (`reconcileFull({ full: true })`)** — walk de todas las páginas, sin early exit. Detecta deletes vs todo el set. Disparado por: (a) botón explícito "Reconciliar todo con BGG" en /perfil; (b) `POST /api/auth/bgg-connect` async via `triggerBackgroundReconcile`; (c) en `GET /api/bgg/partidas/:user` cuando `bggSync.lastFullSyncAt > 30 días`.

**Coordinación obligatoria** ([server/utils/bggSync.js](server/utils/bggSync.js)):
- `withUserLock(bggUsername, fn)` — mutex per-usuario para evitar reconciles solapados. CUIDADO: dedupea por key, no por work-function — ver [[feedback-user-lock-semantics]].
- `tryAcquireProbeSlot` / `releaseProbeSlot` (cap 10) — burst protection en probes simultáneos.
- `tryAcquireReconcileSlot` / `releaseReconcileSlot` (cap 3) — protección contra carga de reconciles full concurrentes.
- En reconciles `background: true`, `sleep(500ms)` entre páginas para suavizar el spike.

**Detección de drift por hash** ([server/utils/bggHash.js](server/utils/bggHash.js)):
- Cada `BggPlay` persiste un `hash` SHA-1 de los campos relevantes (playId, date, quantity, duration, location, comments, incomplete, nowinstats, players con orden preservado).
- El probe compara hashes de las 30 partidas más recientes contra los locales — captura edits in-place sin pedir thumbnails.
- Orden de jugadores ES significativo (reordenar es un edit detectable).

**Estado en `User.bggSync`** ([server/models/User.js](server/models/User.js)):
- `lastFullSyncAt` / `lastFullSyncCount` — cuándo y cuántas plays tras el último walk completo.
- `lastProbedAt` / `lastProbeOutcome` — cuándo y resultado del último sondeo (incluye `'reconciled'`, no solo probes "puros").
- `userGamesBuiltAt` — freshness del cache materializado `BggUserGame` (ver abajo).
- Tanto el botón manual como `stampReconcileResult` setean los CUATRO campos a la vez, así un reconcile satisface ambos throttles.

**Cache materializado `BggUserGame` (selector "Mis juegos", 2026-06)** — una fila por (bggUsername, gameId) con `{ name, thumbnail, image, year, numPlays, lastPlayedDate, owned, searchName }`. Es un **cache que se auto-reconstruye**, NO una fuente de verdad: lo deriva [server/services/bgg/bggUserGames.js](server/services/bgg/bggUserGames.js) desde `BggPlay` + `BggCollection` vía `mergeUserGameList`+`computePlayedGamesWithRecency` ([bggAggregations.js](server/services/bgg/bggAggregations.js)) y reconcilia con `bulkWrite` (upsert presentes + delete ausentes, sin wipe destructivo). Alimenta el endpoint paginado `GET /api/bgg/mis-juegos/:user?page&q` (orden por recencia; búsqueda por `searchName` normalizado NFD).
- `ensureFreshUserGames` reconstruye **lazy al leer** si `userGamesBuiltAt` es null (sucio) o > 6h (TTL). `dedupeRebuild` (map privado, NO el `withUserLock` compartido) evita rebuilds concurrentes.
- **INVARIANTE: cualquier code path que cambie las plays o la colección de un user debe invalidar.** Hoy lo hacen: handlers `POST/PUT/DELETE /partidas` → `markUserGamesDirty`; `stampProbeOutcome` (en `edits_only`/`reconciled`) y `stampReconcileResult` → setean `userGamesBuiltAt:null`; `clearUserCache` → `wipeUserGames`. Si agregás un nuevo trigger que muta BggPlay/BggCollection, agregá la invalidación o se queda stale hasta el TTL de 6h.

**Why:** El wipe-and-refetch anterior (Phase 3) era destructivo (ventana de inconsistencia entre `deleteMany` y `insertMany`), no se ejecutaba automático (usuarios como H3rmit87 conectaban y nunca aparecían sus partidas), y costaba 60-200 requests por usuario sincronizado. La nueva estrategia colapsa el caso común a **1 request por visita** (probe con `no_drift`), reconcile dirigido cuesta típicamente 1-2 requests por edit detectado, y el reconcile completo solo corre 1 vez cada 30 días (~17 reconciles/día con 500 usuarios conectados = ~170 req/día a BGG, sostenible).

**How to apply:**
- Endpoint que sirve datos BggPlay → decidí la acción con `decidePlaysSyncAction` (o `triggerBackgroundProbe` directo si es un endpoint sin noción de dueño). Sincrónico SOLO para dueño/admin con datos viejos (>3 h) o `?refresh=1`; el resto en background. Nunca hagas reconcile completo sincrónico.
- Mutaciones desde Turnocero (`POST/PUT/DELETE /api/bgg/partidas`) deben usar `upsertPlayFromMutation` que calcula `hash` y persiste — mantiene local sincronizado sin esperar al próximo probe.
- Stamps de bggSync siempre vía `stampProbeOutcome` / `stampReconcileResult` (con `{ collation: { locale: 'en', strength: 2 } }` — ver [[feedback-bgg-username-case]]).
- Si agregás un nuevo trigger para reconcile completo (ej. al cambiar `User.bggUsername`), respeta `tryAcquireReconcileSlot` y úsalo con `background: true`.
- Tests: la suite ya cubre los 4 outcomes del probe + reconcile idempotente + edit por hash + delete detection + lock + autosync en connect + 30d threshold (en `server/tests/integration/bgg.test.js` y `auth.test.js`). Cualquier nueva ruta o trigger debe extender estos tests, no crear nuevos archivos.

Anti-pattern: NO mezclar probe con reconcile en el mismo `withUserLock(key, work)` para distinto work — la dedupe del lock daría resultado del work-A a callers que pidieron work-B. Usar trigger mutuamente exclusivo en el caller (el route handler decide cuál disparar). Ver [[feedback-user-lock-semantics]].

**Helpers de aggregation sobre `BggPlay`** (todos en [server/routes/bgg.js](server/routes/bgg.js)) — usalos en cualquier vista que muestre stats derivadas:
- `computeTopPlayedGame(lowerBggUsername)` — el juego más jugado. Usado por `topGame` en la response de `/api/bgg/partidas/:user` (unfiltered first page) y en `/api/bgg/perfil-publico/:user`.
- `computeGameStats(lowerBggUsername, gameId)` — wins/rated/avgDuration/lastDate sobre todo el historial de un juego. Usado por `gameStats` en la response cuando se filtra por `?id=<gameId>`.
- `computePlayedGames(lowerBggUsername)` — lista completa de juegos jugados con `numPlays`, ordenada desc. Endpoint dedicado `GET /api/bgg/juegos-jugados/:user`.
Patrón común: `$match { bggUsername, gameId: { $ne: null } } → $group → $sort`. Owner identification (para wins) usa `$reduce` con `$toLower` para match case-insensitive. Ver [[feedback-bgg-prefer-plays-aggregation]] para el principio: estos derivados SIEMPRE deben salir de BggPlay, no de la colección.

**Self-healing en el route**: `GET /api/bgg/partidas/:user` branch `!hasMongoData` hace `User.findOne({ bggUsername }).collation(strength: 2)`. Si existe el owner, dispara `triggerBackgroundReconcile` fire-and-forget antes de servir el fallback L1/L3. Esto cubre usuarios pre-Phase 5 (conectaron BGG cuando aún no había autosync-on-connect) sin requerir scripts manuales — la próxima visita se auto-cura. Hay un script complementario [server/scripts/migrate-bgg-sync-phase4.js](server/scripts/migrate-bgg-sync-phase4.js) para backfill eager con `DRY_RUN=1` por defecto seguro.

Relacionado: [[feedback-bgg-cache-pattern]] cubre el patrón de cache L1/L2/L3 sobre el cual este engine opera. [[feedback-bgg-prefer-plays-aggregation]] explica por qué TODA vista derivada (top games, stats, listas) debe salir de aggregations sobre `BggPlay` y no de `BggCollection`.
