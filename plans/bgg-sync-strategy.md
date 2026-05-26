# Plan — Estrategia eficiente de sync de partidas BGG (Phase 4)

## Contexto

Phase 3 ([commit 074e990](https://github.com/anthropics/turnocero/commit/074e990)) introdujo `BggPlay` con un botón manual "Sincronizar con BGG" que hace **wipe + refetch completo** del historial cada vez. Esto:

- Borra todas las partidas locales del usuario (`deleteMany`) y las repagina desde BGG en orden, página por página.
- Tiene una **ventana de inconsistencia** entre el `deleteMany` y la última `insertMany` (lecturas pueden ver 0 partidas o un subset parcial).
- Si BGG falla a mitad del fetch, el usuario queda con un historial parcialmente borrado y `bggSync.lastFullSyncAt` sin actualizar.
- Es **caro**: un usuario con 2000 partidas son ~67 requests cada vez que aprieta el botón.
- No se dispara automáticamente — ni siquiera al conectar — así que muchos usuarios nunca sincronizan y la card "Más jugado" cae al fallback de colección (que no funciona si la colección es privada, p.ej. H3rmit87).

Además, `syncPlaysDelta` (path de `?refresh=1`) solo captura **partidas nuevas** vía `mindate`, no edits ni deletes — porque BGG no expone un endpoint "qué cambió desde fecha X".

**Objetivo de Phase 4**: mantener el historial de partidas lo más sincronizado posible con BGG con **el mínimo número de requests** y **sin operaciones destructivas**.

## Estrategia

Tres componentes complementarios:

### 1. Sondeo barato (cheap drift probe)

Una request a `/plays?username=X&page=1` resuelve dos preguntas en un round-trip:

- **`total` del elemento `<plays>`** → comparado contra `BggPlay.countDocuments({ bggUsername })` detecta **adds y deletes**.
- **Las 30 partidas de la página 1** → comparando hashes locales contra hashes calculados de la respuesta detecta **edits a partidas recientes** (que es donde están casi todos los edits reales).

**Hash de play**: `sha1(playId + date + quantity + duration + location + comments + incomplete + nowinstats + playersHash)` con `playersHash = sha1(JSON.stringify(players.sort()))`. Persistido en `BggPlay.hash` (campo nuevo).

**Resultado del sondeo**:

| `total` matches | hashes top-30 match | Acción                                                          |
| --------------- | ------------------- | --------------------------------------------------------------- |
| ✅              | ✅                  | No hay drift detectable. Termina con **1 request**.             |
| ✅              | ❌                  | Solo edits recientes. Upserts las que cambiaron. **1 request.** |
| ❌              | —                   | Adds o deletes. Pasa al reconcile dirigido (ver §2).            |

### 2. Reconcile dirigido (cuando el sondeo detecta drift de count)

Cuando `total` remoto != `total` local:

1. Paginás `/plays?username=X&page=N` desde 1 hacia adelante.
2. Por cada página: bulkWrite con upsert por `playId`, recolectando los `playId` vistos.
3. Cortás cuando llegás a una página donde **los 30 `playId` ya están locales con hash matching** — eso significa que desde ahí hacia atrás está sincronizado.
4. Al final, si `total` remoto < `total` local, calculás `idsLocales - idsVistos` **restringido al rango de fechas barrido** (entre la fecha más nueva y la fecha más vieja de los plays vistos) y borrás esos `_id`. La restricción de rango evita borrar partidas viejas que no llegaste a cubrir.

Esto es **idempotente** y **no destructivo** (no hay `deleteMany` upfront). Si BGG falla a mitad del barrido, lo que ya upsertaste queda válido y el siguiente reconcile retoma.

### 3. Reconcile completo (fallback periódico)

Para edits a partidas más viejas que las 30 más recientes (blind spot del sondeo):

- **Botón explícito "Reconciliar todo"** en `/perfil` — refactor del actual "Sincronizar con BGG", pero la implementación es no-destructiva (upsert por `playId` + diff de IDs al final, igual que §2 pero sin cortar).
- **Trigger automático cada 30 días**: el sondeo además chequea `bggSync.lastFullReconcileAt`; si pasaron > 30 días, encola un reconcile completo en background (no bloquea la respuesta).

**Costo estimado con 1000 usuarios** (50% conectados = 500): ~17 reconciles/día = ~170 requests/día a BGG. Sostenible. Stagger natural por fecha de connect.

### 4. Trigger del sondeo

- **En `GET /api/bgg/partidas/:user`**: si `bggSync.lastProbedAt > 5 min`, dispara el sondeo **async (fire-and-forget)**. La response devuelve datos de Mongo inmediatamente.
- **En `?refresh=1` (botón "Actualizar" del panel)**: corre el sondeo **síncronamente** para que el usuario vea cambios al toque cuando lo pide explícitamente.
- **En `POST /api/auth/bgg-connect`** (primera vez): dispara el reconcile completo en background. Cierra el problema H3rmit87-style.

### 5. Coordinación

- **Lock per-user** (Map en memoria con TTL 10 min): `Map<lowerBggUsername, Promise>`. Una probe/reconcile en curso para el mismo usuario reusa la promesa pendiente o se descarta silenciosamente.
- **Throttle de sondeo**: `bggSync.lastProbedAt` chequeado server-side antes de gatillar. 5 min mínimo entre sondeos automáticos.
- **Cap global de reconciles concurrentes**: contador en memoria, máx 3 simultáneos (5 si te animás). Background reconciles encima del cap se postponen al siguiente trigger (no se encolan, simplemente no corren ahora). Aceptable porque el trigger es por user-traffic, no por cron.
- **Cap global de probes concurrentes**: contador en memoria, máx 10 simultáneos. Mitiga bursts (p.ej. 200 usuarios abren `/bg-watch` en 5 segundos tras un anuncio). Los probes que excedan el cap se descartan silenciosamente (no se encolan) — el próximo trigger del mismo usuario lo va a volver a intentar. Como el probe es async fire-and-forget, descartarlo no impacta UX.
- **Throttle inter-page en reconciles background**: dentro de `reconcileFull` cuando corre en background (no en el path síncrono del botón), un `await sleep(500ms)` entre páginas. Suaviza el spike cuando se procesa un usuario con miles de partidas sin afectar UX (nadie espera). El path síncrono (`?refresh=1`, botón) no aplica el sleep para que la respuesta sea lo más rápida posible.

### Helpers nuevos para coordinación

```js
// Cap global de probes concurrentes (10 max).
function tryAcquireProbeSlot(): boolean
function releaseProbeSlot(): void

// Sleep helper para throttle inter-page (solo background).
function sleep(ms): Promise<void>
```

## Cambios al modelo

### `BggPlay` ([server/models/BggPlay.js](server/models/BggPlay.js))

Agregar campo:

```js
hash: { type: String, default: null, index: true },
```

Calculado en helper compartido `computePlayHash(play)` ([nuevo en `server/utils/bggHash.js`](server/utils/bggHash.js)). Se actualiza en cada upsert (sondeo, reconcile, mutación desde Turnocero).

Backfill: el primer sondeo después del deploy va a ver `hash === null` localmente para todas las partidas. El comportamiento del sondeo cuando `hash` local es null debe ser: tratar como "edit detectado" para esa partida en particular y upsertar con el hash fresco. Después del primer sondeo, todas las partidas existentes ya tienen hash.

### `User.bggSync` ([server/models/User.js](server/models/User.js))

```js
bggSync: {
  lastFullSyncAt: { type: Date, default: null },          // existente — renombrar a lastFullReconcileAt
  lastFullSyncCount: { type: Number, default: 0 },         // existente — renombrar a lastFullReconcileCount
  lastProbedAt: { type: Date, default: null },             // NUEVO
  lastProbeOutcome: {                                       // NUEVO (debug + UI)
    type: String,
    enum: ['no_drift', 'edits_only', 'reconciled', 'failed', null],
    default: null,
  },
}
```

Migración: `lastFullSyncAt` queda como `lastFullSyncAt` por compat (no rename forzado); agregar los nuevos campos. Si querés rename, hacelo en un commit posterior con script de migración — fuera de scope acá.

## Cambios a la API

### Endpoints nuevos / modificados

| Endpoint                      | Cambio                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/bgg/sync`          | **Refactor**: pasa de wipe-and-refetch a `reconcileFull()` (no destructivo). Devuelve `{ inserted, updated, deleted, total }`. UI muestra los tres counts. |
| `GET /api/bgg/partidas/:user` | Si pasaron > 5 min desde `lastProbedAt`, dispara `probe()` async tras responder. `?refresh=1` corre `probe()` síncrono y refleja resultado.                |
| `POST /api/auth/bgg-connect`  | Tras guardar credentials, dispara `reconcileFull()` async para ese usuario.                                                                                |

### Helpers nuevos (`server/routes/bgg.js` o `server/utils/bggSync.js`)

```js
// Hash determinista de una play. Igual para mismo contenido.
function computePlayHash(play): string

// Sondeo barato. 1 request. Detecta adds/deletes via total y edits recientes
// via hashes. Si detecta drift de count, llama reconcileFull internamente
// (manteniendo el mismo lock).
async function probe(bggUsername): { outcome, inserted?, updated?, deleted? }

// Reconcile dirigido. Pagina BGG upserting + diff de IDs al final.
// Cortable: si pasa una página entera con hashes locales matching, detiene.
async function reconcileFull(bggUsername, { full = false } = {}): { inserted, updated, deleted, total }

// Lock per-user. Reusa promesa pendiente; auto-libera al terminar (también en error).
function withUserLock(bggUsername, fn): Promise

// Throttle global de reconciles concurrentes.
function tryAcquireReconcileSlot(): boolean
function releaseReconcileSlot(): void
```

### Deprecación

- `syncPlaysFull` → reemplazado por `reconcileFull({ full: true })`. Borrar el código viejo.
- `syncPlaysDelta` → reemplazado por `probe()`. Borrar.
- `?refresh=1` en `/partidas/:user` → llama `probe()` síncrono en vez de `syncPlaysDelta`.

## Cambios al frontend

### `/perfil` — sección BGG ([UserProfile.jsx:640](client/src/pages/users/UserProfile.jsx#L640))

- Renombrar botón "↻ Sincronizar con BGG" a **"↻ Reconciliar todo con BGG"** (la sincronización pasa a ser principalmente automática vía probe; este botón es el fallback explícito).
- Texto contextual: "Tu historial se mantiene actualizado automáticamente. Apretá si editaste partidas viejas en BGG.com y querés forzar una reconciliación completa."
- Mostrar `lastFullReconcileAt` y `lastProbedAt` con tiempos relativos ("Hace 2 días", "Hace 3 min").
- Mostrar resultado del último probe (`lastProbeOutcome`): "✓ Sin cambios", "✓ 2 partidas actualizadas", "✓ 5 partidas nuevas, 1 borrada", etc.

### `/bg-watch/<user>` — panel de partidas

- Botón "↻ Actualizar" en `PartidasPanel` sigue igual visualmente. Internamente ya manda `?refresh=1`, ahora ese path corre `probe()` síncrono.
- Cooldown de 60s del cliente se mantiene.

## Tests

Server (vitest + mongodb-memory-server):

- `server/tests/unit/utils/bggHash.test.js` — `computePlayHash` es determinista, sensible a cambios en campos relevantes (date, players, score, comments), insensible a orden de players si el sort es estable.
- `server/tests/integration/bgg-sync.test.js`:
  - **probe no-drift**: mockea BGG con total/hashes iguales → 1 request a BGG, 0 cambios en Mongo, `lastProbeOutcome = 'no_drift'`.
  - **probe detecta edit reciente**: mockea BGG con hash distinto en 1 de las 30 → upsert solo de esa, 1 request.
  - **probe detecta add nuevo**: total + 1 → llama reconcile dirigido, página 1 tiene la partida nueva + 29 viejas con hash matching → corta en página 1, 1 insert.
  - **probe detecta delete**: total - 1 → barre páginas, detecta playId faltante en rango, lo borra.
  - **reconcile completo idempotente**: corrido dos veces seguidas sin cambios en BGG → segundo run es no-op (0 inserts, 0 updates, 0 deletes).
  - **lock per-user**: dos probes concurrentes para el mismo usuario reusan la misma promesa (mock cuenta requests, debe ser 1, no 2).
  - **BGG falla mid-reconcile**: simula error en página 3 → upserts de páginas 1-2 quedan persistidos, `lastFullReconcileAt` no se actualiza, `lastProbeOutcome = 'failed'`.
- `server/tests/integration/auth.test.js` (existente): nuevo test para `bgg-connect` que verifica que dispara `reconcileFull` en background (mockear con spy).

Client (vitest + RTL + MSW):

- `client/src/pages/users/UserProfile.test.jsx`: extender los tests existentes de "Sincronizar con BGG" para el nuevo wording y para que muestre los counts `{ inserted, updated, deleted }`.
- `client/src/pages/bg-watch/PartidasPanel.test.jsx`: el botón "Actualizar" ya tiene tests; verificar que el comportamiento sigue (manda `?refresh=1`, cooldown 60s).

## Migración / backfill

- Schema change en `BggPlay` (campo `hash`) y `User.bggSync` (campos nuevos): aditivos, no requieren script de migración. Documentos viejos arrancan con `hash: null` y campos faltantes — se completan al primer sondeo.
- **No hay deploy con downtime**: el código nuevo es retro-compatible con docs viejos.
- Deprecated functions (`syncPlaysFull`, `syncPlaysDelta`) se borran del codebase en el mismo PR — no se renombran ni se dejan como aliases.

## Fases del rollout

| Slice       | Scope                                                                                                                              | Commit                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Slice 1** | `computePlayHash` + campo `hash` en `BggPlay` + tests. Update de `upsertPlayFromMutation` para escribir hash.                      | `feat(bgg): add play hash for drift detection`                  |
| **Slice 2** | `withUserLock` + `tryAcquireReconcileSlot` + `tryAcquireProbeSlot` + `sleep` helper (lock + throttles + sleep) + tests.            | `feat(bgg): add per-user lock and global concurrency caps`      |
| **Slice 3** | `reconcileFull` idempotente + `User.bggSync` fields nuevos. `POST /api/bgg/sync` pasa a usarlo. Borrar `syncPlaysFull`. Tests.     | `feat(bgg): replace destructive sync with idempotent reconcile` |
| **Slice 4** | `probe` + integración en `GET /api/bgg/partidas/:user` (async > 5 min + síncrono en `?refresh=1`). Borrar `syncPlaysDelta`. Tests. | `feat(bgg): add cheap drift probe with auto-trigger`            |
| **Slice 5** | Trigger en `POST /api/auth/bgg-connect`. Tests.                                                                                    | `feat(bgg): auto-reconcile plays on BGG connect`                |
| **Slice 6** | Trigger background de reconcile completo cuando `lastFullReconcileAt > 30 días` (dentro de `probe`). Tests.                        | `feat(bgg): periodic full reconcile every 30 days`              |
| **Slice 7** | UI en `/perfil` — wording, timestamps, outcome del probe. Tests.                                                                   | `feat(bgg): update profile UI for new sync model`               |

Cada slice es mergeable independientemente (sin breaking changes intermedios) excepto Slice 3 que requiere Slice 1 y Slice 2.

## Riesgos y mitigaciones

| Riesgo                                                                                                      | Mitigación                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash inestable entre versiones del código (cambio de algoritmo invalida todo)                               | Si en el futuro cambia el algoritmo, agregar `hashVersion` en el doc y recomputar lazy. Por ahora versión única implícita.                               |
| BGG cambia formato XML y rompe el parser                                                                    | Errores en `parsePlaysXml` no actualizan `lastProbedAt` → reintento al próximo trigger. Logs visibles en `lastProbeOutcome = 'failed'`.                  |
| Edits a partidas viejas (> 30 atrás) que el usuario nunca dispara reconcile completo manual                 | Trigger automático cada 30 días lo cubre.                                                                                                                |
| Usuario con miles de partidas dispara reconcile completo automático al mismo tiempo que muchos otros        | Cap global de 3 simultáneos. Si el cap está lleno, se postpone al siguiente trigger del mismo usuario (típicamente próxima visita a `/bg-watch`).        |
| Burst sincrónico de visitas a `/bg-watch` (p.ej. tras un anuncio en redes) genera 200+ probes simultáneos   | Cap global de 10 probes concurrentes; los que excedan se descartan silenciosamente (el próximo trigger del mismo usuario lo reintenta).                  |
| Power user con miles de partidas históricas, su reconcile background acapara conexiones outbound del server | Throttle inter-page de 500 ms en reconciles background. Suaviza el spike sin afectar UX (nadie espera). El path síncrono del botón no aplica el sleep.   |
| `withUserLock` con TTL pegado a Map en memoria se pierde en reboot del server                               | Aceptable: en el peor caso un reconcile huérfano se reintenta en la próxima request del usuario. No causa corrupción porque el reconcile es idempotente. |

## Métricas a observar post-rollout

- Promedio de requests a BGG por sondeo (esperado: ~1 en el caso común).
- % de sondeos que terminan en `no_drift` (esperado: >80% en estado estable).
- Tiempo de respuesta de `GET /api/bgg/partidas/:user` (no debería empeorar — el probe corre después de responder).
- Errores de reconcile (`lastProbeOutcome = 'failed'`) — alertable si supera un umbral.

Logueo via `logger.info` en cada outcome del probe/reconcile con `{ bggUsername, outcome, inserted, updated, deleted, durationMs }` para diagnóstico.
