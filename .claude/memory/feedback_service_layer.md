---
name: feedback-service-layer
description: Business logic en server/services/ — routers son HTTP plumbing delgado, servicios son testeables sin req/res mocks
metadata:
  type: feedback
---

**Desde 2026-05-22 (P1.4 + P1.5 + P1.5' del audit).** El servidor ahora tiene una capa de servicios en `server/services/` donde vive la business logic. Los routers (`server/routes/*.js`) quedan como **capa HTTP delgada**: parsean params, llaman al service, devuelven JSON.

**Why:** Routers de 1500-1800 líneas (bgg, torneos, eventos) mezclaban transport y dominio. Tests integration servían para todo, las funciones puras eran imposibles de probar aisladas. La extracción dio +73 unit tests de servicios + cobertura de paths de error que antes no se tocaban.
**How to apply:** Cuando agregues lógica nueva a un router, preguntate "¿esto depende del HTTP o del dominio?" Si es dominio (validación de business rules, generación de fixtures, queries derivadas, transformaciones), va al service. Si es transport (status codes, parseo de query, response shape), va al handler.

## Mapa actual

### `server/services/bgg/` (P1.4, post-split)
- **`bggAggregations.js`** — `computeGameStats`, `computePlayedGames`, `computeTopPlayedGame` (aggregations sobre `BggPlay`, NUNCA sobre `BggCollection` — [[feedback-bgg-prefer-plays-aggregation]]).
- **`bggSearch.js`** — `stripLeadingArticle`, `scoreSearchMatch` (heurística client-side de relevancia tras el Cloudflare gate).
- **`bggCache.js`** — L1 in-memory: `getCached`, `setCached`, `clearPartidasCache`, `clearL1Cache`. **NO toca Mongo** — el orquestador L1+L2 vive en `routes/bgg.js#clearUserCache`.
- **`bggCooldown.js`** — `getManualRefreshRemainingMs`, `stampManualRefresh` para el cooldown del botón "↻ Actualizar" (60s); respeta [[feedback-bgg-username-case]].
- **`bggParse.js`** — XML parsers compartidos: `parseGameItem`, `parseCollectionXml`, `parsePlay`, `parsePlaysXml`, `gameDocToObject`, `playToApi`. Single XMLParser instance.
- **`bggResolve.js`** — capa L2 (memoria → Mongo → BGG): `fetchBgg` (maneja 202 retry), `persistGame`, `resolveGame`, `resolveGamesBatch`, `resolveCollection`. Exporta `BGG_API`.
- **`bggSyncEngine.js`** — `reconcileFull`, `probe`, `triggerBackgroundProbe`, `triggerBackgroundReconcile`, `stampProbeOutcome`, `stampReconcileResult`. Ver [[feedback-bgg-sync-engine]] y [[feedback-user-lock-semantics]] — las invariantes siguen vivas en el service.
- **`bggMutations.js`** — `buildPlayForm`, `validatePlayBody`, `submitToGeekplay`, `verifyPlayOnBgg`, `upsertPlayFromBgg`. **DELETE en `geekplay.php` queda inline en el handler** (`finalize=1` + `B1=Yes` arman un form ad-hoc distinto — [[feedback-bgg-write-quirks]]).

### `server/services/`
- **`torneoService.js`** (P1.5) — `VALID_TRANSITIONS`, `buildAndInsertMatches`, `buildAndInsertGroupsForPhase`, `cascadeClearWinner`, `getFinalRound`.
- **`eventoService.js`** (P1.5') — `countsFor` (pure), `notifyOne` (skip auto-notif al actor), `notifyActiveRegistrations`, `cascadeAssociatedTables`, `reloadRegPopulated`, `closePastOpenEvents`.

## Convenciones del patrón

- **Servicios reciben `req` cuando necesitan `req.app.get('io')`** (para emits). El service NO arma response — devuelve datos o lanza `httpError(...)`.
- **`notifyOne` y `notifyActiveRegistrations` deben awaitearse antes de `res.json(...)`** (sino los emits ocurren post-respuesta y los tests integration los pierden — ya pasó, está documentado).
- **Re-exports en `routes/bgg.js`** (`module.exports.clearUserCache`, `module.exports.triggerBackgroundReconcile`) se mantienen porque `routes/auth.js` y `scripts/migrate-bgg-sync-phase4.js` los importan del router. No borrar al refactorizar.
- **El handler HTTP no hace `try/catch`** si el router está migrado a [[feedback-async-handler-pattern]] — `throw httpError(status, msg)` y el middleware central responde.
- **Tests del service** van en `server/tests/unit/services/<domain>/<file>.test.js`, no en integration. Los integration tests del router siguen ahí cubriendo el contrato HTTP.

## Para nuevas features

Cuando agregues un nuevo dominio (ej. "rondas de votación", "amigos secretos"):
1. Crear `server/services/<dominio>Service.js` desde el día 1 — aunque el router empiece chico, no caer en el patrón viejo de meter business logic inline.
2. Unit tests en `server/tests/unit/services/<dominio>Service.test.js` cubren la lógica pura (factories de `tests/helpers/factories.js` ayudan).
3. El router solo arma req/res y delega al service.
