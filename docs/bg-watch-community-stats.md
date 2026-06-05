# BG Watch — Hub de estadísticas cross-user (handoff)

**Fecha:** 2026-06-05
**Rama:** `feature/bg-watch-community-stats`
**Estado:** implementado + testeado + verificado en vivo contra la DB de producción. **Sin commitear.**

> ⚠️ **Si cambiás de PC:** todo este trabajo está sin commitear (archivos nuevos sin trackear).
> Hacé `git add -A && git commit && git push` de esta rama ANTES de cambiar de máquina, o se pierde.
> Este mismo doc también es nuevo — entra en el commit.

---

## Qué es

Hasta ahora **toda** la sección BG Watch estaba scopeada a un único `bggUsername` (perfil, partidas, colección). No había ninguna vista que cruzara datos entre usuarios.

Este feature agrega un **hub de comunidad** que deriva estadísticas de las partidas de **todos** los miembros con BGG conectado: rankings de juegos y jugadores, win-rates globales, head-to-head, feed de actividad, heatmap e insights personales.

**La llave técnica:** cada `BggPlay` guarda `players[]` con `username`, que matchea (case-insensitive) contra `User.bggUsername`. El log de partidas de la comunidad es, en efecto, un grafo social de juego reconstruible.

**Alcance actual:** global (todos los miembros con BGG = una sola "comunidad BG Watch"). El scoping por Comunidad (multi-tenancy) está **diseñado pero no cableado** — ver "Pendiente".

---

## Arquitectura

### Backend

**Servicio:** [`server/services/bgg/bggCommunityStats.js`](../server/services/bgg/bggCommunityStats.js) — 13 aggregations cross-user sobre `BggPlay`. Sigue el patrón de `bggAggregations.js` (funciones aisladas, testeables).

| Función                                                         | Qué computa                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `resolveBggUsernamesToUsers(lowerUsernames)`                    | Batch lookup username→User (avatar/displayName) con collation strength 2                |
| `connectedMemberUsernames()`                                    | Set de bggUsernames conectados (define "la comunidad")                                  |
| `topCommunityGames({limit, sinceDate, bggUsernames})`           | Juegos más jugados (totalPlays + miembros distintos); `sinceDate` → "en llamas"         |
| `gameCommunityStats(gameId, {bggUsernames})`                    | Por juego: total, miembros, win-rate de comunidad, duración/score promedio, top players |
| `gameOwners(gameId, {bggUsernames})`                            | Miembros que poseen el juego (de `BggCollection`)                                       |
| `communityPlayerLeaderboard({metric, sinceDate, bggUsernames})` | Ranking por `plays` o `variedad`                                                        |
| `communityWinRates({minPlays, bggUsernames})`                   | Win-rate por miembro con umbral mínimo                                                  |
| `longestWeekStreak(dates)` / `communityStreaks(...)`            | Racha de semanas consecutivas con partida (pura + leaderboard)                          |
| `topCoPlayers(lowerBggUsername, {limit})`                       | Con quién jugó más (reusa `computePlayedCoPlayers`)                                     |
| `headToHead(lowerA, lowerB)`                                    | A vs B: dedup de sesión compartida + récord + desglose por juego                        |
| `communityActivityFeed({page, limit, bggUsernames})`            | Feed paginado de partidas recientes (date desc, \_id desc)                              |
| `communityActivityHeatmap({sinceDate, bggUsernames})`           | Partidas por día                                                                        |
| `playerGameRank(lowerBggUsername, gameId, {bggUsernames})`      | Posición del usuario en un juego dentro de la comunidad                                 |

**Reglas del dominio respetadas** (todas con memoria asociada):

- **Preferir `BggPlay` sobre `BggCollection`** (la colección omite juegos no-poseídos y perfiles privados). Solo `gameOwners` toca la colección, con disclaimer de incompletitud en la UI.
- **Case mismatch:** `BggPlay.bggUsername` es lowercase, `User.bggUsername` case-preserved → todo cruce usa `collation: { locale: 'en', strength: 2 }`. Hay test con bggUsername mixed-case.
- **`players[].score` es String** → `$convert` con `onError/onNull: null` antes de promediar.
- **Doble-conteo:** una sesión física suele loguearse por varios miembros. Rankings de jugadores cuentan 1 doc = 1 logger (limpio). "Total de plays de un juego" suma por logger y expone además `playerCount` (miembros distintos) como métrica honesta. El H2H deduplica la sesión compartida por firma `fecha|juego|jugadores`.

**Costura multi-tenancy:** cada función toma un `bggUsernames` opcional (allowlist en lowercase). En global queda `null`. Para scopear por comunidad, el caller computa los bggUsernames de los miembros y los pasa — mismo código, distinto scope.

### Rutas

9 endpoints en [`server/routes/bgg.js`](../server/routes/bgg.js) bajo `/api/bgg/comunidad/*`, todos `optionalAuth` + gateados por la sección `bgwatch` (`router.use` arriba). `asyncHandler` + `httpError`.

```
GET /api/bgg/comunidad/juegos?periodo=all|mes&limit=
GET /api/bgg/comunidad/juego/:gameId            → { game, stats, owners }
GET /api/bgg/comunidad/jugadores?metric=plays|variedad|winrate|racha&periodo=
GET /api/bgg/comunidad/companeros/:bggUsername  → { coPlayers }
GET /api/bgg/comunidad/h2h/:userA/:userB        → { total, aWins, bWins, draws, userA, userB, byGame }
GET /api/bgg/comunidad/actividad?page=&limit=   → { items, total, page, pages }
GET /api/bgg/comunidad/heatmap                  → { heatmap: [{date, count}] }
GET /api/bgg/comunidad/rank/:bggUsername/:gameId → { rank: { rank, total, numPlays } | null }
```

Paths centralizados en [`client/src/api/endpoints.js`](../client/src/api/endpoints.js) → `API.bgg.COMUNIDAD_*`.

### Frontend

| Componente                                                                          | Ruta / ubicación                        | Qué hace                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| [`BgWatchComunidad.jsx`](../client/src/pages/bg-watch/BgWatchComunidad.jsx)         | `/bg-watch/comunidad`                   | Hub con tabs **Juegos** / **Jugadores** / **Actividad** (+ heatmap) |
| [`ComunidadJuegoDetail.jsx`](../client/src/pages/bg-watch/ComunidadJuegoDetail.jsx) | `/bg-watch/comunidad/juego/:gameId`     | Stats de comunidad + "¿quién lo tiene?" + CTA Armar mesa            |
| [`BgWatchH2H.jsx`](../client/src/pages/bg-watch/BgWatchH2H.jsx)                     | `/bg-watch/comunidad/h2h/:userA/:userB` | Head-to-head con marcador y desglose por juego                      |
| [`ComunidadCompaneros.jsx`](../client/src/pages/bg-watch/ComunidadCompaneros.jsx)   | embebido en `BgWatchProfile`            | Sección "Con quién juega más"; chips → H2H                          |
| [`ComunidadRankBadge.jsx`](../client/src/pages/bg-watch/ComunidadRankBadge.jsx)     | embebido en `BgWatchPerGameView`        | "Sos el #X de Y en la comunidad"                                    |

Rutas registradas en [`client/src/App.jsx`](../client/src/App.jsx) (antes de `/bg-watch/:bggUsername`; React Router v6 rankea estático sobre dinámico). CSS compartido en `BgWatchComunidad.module.css`. Reusa `<Avatar>`, `<EmptyState>`, `useInfiniteScroll`, `useBrandName`, theme tokens (dark + light).

---

## Cómo acceder a cada cosa (clickpaths)

- **Hub:** link "Ver la comunidad →" en el hero de cualquier perfil `/bg-watch/<user>`, o el link en la landing `/bg-watch`. URL directa: `/bg-watch/comunidad`.
- **Detalle de juego:** clickeá cualquier card en la tab Juegos, o el link de juego en el feed de Actividad.
- **Head-to-head:** **único entry point en UI** → perfil `/bg-watch/<user>` → sección "Con quién juega más" → clickeá el chip de un compañero **que sea miembro** (los invitados sin username BGG no linkean). Siempre es "dueño del perfil vs compañero". URL directa: `/bg-watch/comunidad/h2h/userA/userB`.
- **Rank personal:** aparece solo en la vista per-game `/bg-watch/<user>/juego/<gameId>` cuando hay >1 jugador.

---

## Tests

Todo verde al cierre.

- **Server:** 26 unit ([`tests/unit/services/bgg/bggCommunityStats.test.js`](../server/tests/unit/services/bgg/bggCommunityStats.test.js)) + 17 integration ([`tests/integration/bgg-comunidad.test.js`](../server/tests/integration/bgg-comunidad.test.js)), incluye el caso mixed-case obligatorio. Suite completa: **1390 ✓**.
- **Client:** 12 nuevos (un `*.test.jsx` por componente) + tests existentes actualizados (mocks de los hijos que fetchean). Suite completa: **2256 ✓**.

Correr: `npm run test:server` / `npm run test:client` (o `npm test` para ambos).

### Verificado en vivo (preview, DB de producción)

Top juegos (LotR Trick-Taking 111 partidas), leaderboard (Sebas Zim 1784), feed (20 items), heatmap (353 días), game-detail (47% win-rate), H2H (UnlimitedVoid 6–2 FamanDeaf, 19 partidas compartidas), light mode y mobile. Sin errores de consola en vivo.

---

## Bug encontrado y arreglado durante la verificación

El feed de actividad quedaba colgado en "Cargando" por un **ref-guard persistente combinado con abort-on-cleanup**, que rompe bajo React StrictMode (dev): el primer fetch se aborta en el cleanup y el segundo montaje saltea la carga porque el ref persiste. Fix: sacar el ref-guard y confiar en `useEffect(() => { const ac = load(1); return () => ac.abort(); }, [load])` con `load` estable. Documentado en la memoria `feedback_abort_controller_pattern`.

---

## Pendiente / fuera de alcance (decisiones del plan)

1. **Scoping real por Comunidad** (fase 2). El servicio ya acepta `bggUsernames`; falta que los routes computen los bggUsernames de los miembros de `req.viewingCommunities` y los pasen. No requiere rediseño.
2. **Comparador H2H libre.** Hoy el H2H solo se llega desde la sección de compañeros de un perfil. No hay un selector "fulano vs mengano" arbitrario en el hub. Candidato: botón "Comparar" en el leaderboard de la tab Jugadores.
3. **Recomendaciones de juegos** (grupo F del brainstorm) y **premios/gamificación** (grupo H) — fáciles de sumar sobre la misma base, no incluidos.
4. **Cache.** Las aggregations recorren todo `BggPlay` sin cache (volumen actual OK). Si escala, sumar capa memoria TTL corto. El feed de actividad ordena `{date:-1, _id:-1}` sin índice global por date — si la colección crece mucho, considerar un índice o el riesgo del límite de sort en memoria de Mongo (32MB).

---

## Notas de estado del árbol

- **WIP previo sin commitear** no relacionado (LocationPicker / `mis-ubicaciones` / selector de co-players): **no se tocó**. Está en el árbol junto a este feature. Al commitear, separar en commits distintos si querés mantener la historia limpia.
- Archivos nuevos de este feature (todos sin trackear):
  - `server/services/bgg/bggCommunityStats.js` + su test unit
  - `server/tests/integration/bgg-comunidad.test.js`
  - `client/src/pages/bg-watch/BgWatchComunidad.{jsx,module.css,test.jsx}`
  - `client/src/pages/bg-watch/Comunidad{JuegoDetail,Companeros,RankBadge}.{jsx,test.jsx}`
  - `client/src/pages/bg-watch/BgWatchH2H.{jsx,test.jsx}`
- Archivos modificados: `server/routes/bgg.js`, `client/src/api/endpoints.js`, `client/src/App.jsx`, `client/src/pages/bg-watch/BgWatchProfile.{jsx,module.css}`, `client/src/pages/bg-watch/BgWatchPerGameView.jsx`, `client/src/pages/bg-watch/BgWatchLanding.{jsx,module.css}`.
