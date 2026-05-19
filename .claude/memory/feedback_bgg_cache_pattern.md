---
name: feedback-bgg-cache-pattern
description: Toda integración con BGG debe usar el patrón de cache en capas (memoria → Mongo → BGG) con bypass via ?refresh=1 y botón cliente con cooldown de 60s
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3978d582-2596-4e98-a14d-85ecf1f3e2c9
---

Cuando se agregue o modifique un endpoint que consume BoardGameGeek (XML API2 o geekplay.php), seguir el patrón de cache de tres capas establecido en este proyecto:

1. **L1 — In-memory `Map`** ([server/routes/bgg.js](server/routes/bgg.js)): TTL 30 min via `getCached(key, ttl)` / `setCached(key, data)`. Para datos por-usuario o por-query (búsqueda, colección, partidas).
2. **L2 — Mongo persistente**: para datos compartidos entre usuarios y prácticamente inmutables (detalles de juego, thumbnails). Modelo dedicado tipo `BggGame` ([server/models/BggGame.js](server/models/BggGame.js)) con `lastFetchedAt` para diagnóstico, sin TTL. Acceso vía helpers `resolveXxx` / `resolveXxxBatch` que hacen `memoria → Mongo → BGG`.
3. **L3 — BGG** solo cuando L1 y L2 no tienen el dato.

Bypass obligatorio en endpoints per-user (no en los persistentes globales): el server debe respetar `?refresh=1` salteando el cache in-memory y refrescándolo con el resultado fresco de BGG.

Cliente: cualquier panel que liste datos de BGG debe exponer un botón "↻ Actualizar" que (a) mande `?refresh=1`, (b) entre en cooldown de 60 s, (c) muestre countdown visible "Esperá Xs", (d) se rehabilite solo al terminar. Patrón implementado en `PartidasPanel` y `ColeccionPanel`.

**Why:** BGG es lento (cold fetch ~400-500 ms vs ~10 ms cacheado), rate-limited, y los datos o no cambian nunca (game details) o cambian a ritmo humano (colección, partidas). Antes de este patrón el cache era solo in-memory de 5 min — se perdía en cada deploy y no se compartía entre usuarios. La introducción de L2 colapsó la mayor parte del tráfico (thumbnails de partidas son lo más pedido) y el `?refresh=1` le devuelve control al usuario cuando sabe que algo cambió.

**How to apply:**
- Endpoint nuevo `/api/bgg/<algo>`: pasar por `getCached` / `setCached` con key específica.
- Datos compartidos e inmutables (ej. detalle de juego en algún contexto nuevo): reusar `resolveGame` / `resolveGamesBatch`, NO duplicar la lógica de fetch a BGG.
- Datos compartidos pero mutables (ej. eventual `BggCollection`, `BggPlay`): crear modelo paralelo a `BggGame` con un campo `lastFetchedAt` y un helper `resolveXxx`. Política de refresh: botón manual + TTL largo (horas o días según el dato).
- Cualquier panel cliente que muestre datos BGG debe tener "↻ Actualizar" con cooldown de 60 s. Reusar el patrón `cooldownUntil` + `setInterval` + `forceRefreshRef` de PartidasPanel/ColeccionPanel.
- TTL del cache L1 in-memory: **30 min por default** (no 5). Es seguro porque el botón bypassa, las mutaciones invalidan el cache vía `clearXxxCache`, y los datos son no-críticos.

Tests requeridos por la regla [[feedback-tests-required]]:
- Server: tests cold/warm/mixed que mockean `global.fetch` y verifican qué pedidos llegan a BGG vs cuáles vienen de Mongo o memoria. Test específico de `?refresh=1` que confirma que bypassa el cache.
- Cliente: test que confirma que el botón manda `?refresh=1` Y que entra en cooldown 60 s con countdown que se actualiza Y que se rehabilita al terminar (usar `vi.useFakeTimers({ shouldAdvanceTime: true })`).

Comentario al inicio de `routes/bgg.js` documenta el patrón.
