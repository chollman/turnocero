---
name: feedback-bgg-sync-engine
description: Sync engine para BggPlay (Phase 4) — probe page-1 + reconcile dirigido + reconcile completo periódico + hash drift detection. Reemplaza el wipe-and-refetch destructivo y minimiza requests a BGG.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9099d291-a3e5-40aa-9a9f-b0de83c3a6e6
---

Cuando se trabaje en la sincronización de partidas BGG (o se extienda el patrón a otra entidad sincronizable con BGG), seguir la arquitectura de tres niveles establecida en Phase 4 ([plans/bgg-sync-strategy.md](plans/bgg-sync-strategy.md)):

1. **Sondeo barato (`probe()`)** — 1 request a `/plays?page=1`. Compara `total` remoto vs `BggPlay.countDocuments` y los hashes de las 30 más recientes. Outcomes: `no_drift` (caso común, 0 escrituras), `edits_only` (upsert de las que difieren), `reconciled` (delega a reconcile dirigido). Fire-and-forget en `GET /api/bgg/partidas/:user` con throttle 5 min vía `User.bggSync.lastProbedAt`. Sincrónico en `?refresh=1`.

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
- Tanto el botón manual como `stampReconcileResult` setean los CUATRO campos a la vez, así un reconcile satisface ambos throttles.

**Why:** El wipe-and-refetch anterior (Phase 3) era destructivo (ventana de inconsistencia entre `deleteMany` y `insertMany`), no se ejecutaba automático (usuarios como H3rmit87 conectaban y nunca aparecían sus partidas), y costaba 60-200 requests por usuario sincronizado. La nueva estrategia colapsa el caso común a **1 request por visita** (probe con `no_drift`), reconcile dirigido cuesta típicamente 1-2 requests por edit detectado, y el reconcile completo solo corre 1 vez cada 30 días (~17 reconciles/día con 500 usuarios conectados = ~170 req/día a BGG, sostenible).

**How to apply:**
- Endpoint que sirve datos BggPlay → dispara probe via `triggerBackgroundProbe` (async, throttle 5 min) o sincrónico si `?refresh=1`. No bloquees la respuesta esperando al probe.
- Mutaciones desde Turnocero (`POST/PUT/DELETE /api/bgg/partidas`) deben usar `upsertPlayFromMutation` que calcula `hash` y persiste — mantiene local sincronizado sin esperar al próximo probe.
- Stamps de bggSync siempre vía `stampProbeOutcome` / `stampReconcileResult` (con `{ collation: { locale: 'en', strength: 2 } }` — ver [[feedback-bgg-username-case]]).
- Si agregás un nuevo trigger para reconcile completo (ej. al cambiar `User.bggUsername`), respeta `tryAcquireReconcileSlot` y úsalo con `background: true`.
- Tests: la suite ya cubre los 4 outcomes del probe + reconcile idempotente + edit por hash + delete detection + lock + autosync en connect + 30d threshold (en `server/tests/integration/bgg.test.js` y `auth.test.js`). Cualquier nueva ruta o trigger debe extender estos tests, no crear nuevos archivos.

Anti-pattern: NO mezclar probe con reconcile en el mismo `withUserLock(key, work)` para distinto work — la dedupe del lock daría resultado del work-A a callers que pidieron work-B. Usar trigger mutuamente exclusivo en el caller (el route handler decide cuál disparar). Ver [[feedback-user-lock-semantics]].

Relacionado: [[feedback-bgg-cache-pattern]] cubre el patrón de cache L1/L2/L3 sobre el cual este engine opera.
