---
name: feedback-bgg-derived-invalidation
description: BGG — costura única invalidateOwnerDerived + identidad del dueño en stats vía loadSelfKeys/selfKeys
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 701efdda-c027-4bdb-a0da-04aefdf78e9e
---

Al sincronizar datos de partidas y estadísticas de BG Watch (2026-06-06):

**1. Invalidación de caches derivados — costura ÚNICA.** Toda mutación que cambia el
log de partidas de un usuario invalida vía `invalidateOwnerDerived(bggUsername)` en
[server/services/bgg/bggInvalidate.js](server/services/bgg/bggInvalidate.js) (envuelve
`clearPartidasCache` L1 + `markUserGamesDirty` del selector "Mis juegos"). Está cableada
en los ~10 handlers de `routes/bgg.js`: las 4 de datos de partida (POST/PUT/DELETE
`/partidas` + POST `/sync`) y las 6 de curación de jugadores (nombre, bgg-username,
avatar PUT/DELETE, merge, yo-mismo). **NO** llamar `clearPartidasCache`/`markUserGamesDirty`
sueltos en un handler nuevo — agregá el cache nuevo dentro de `invalidateOwnerDerived` y
con eso queda cubierto en todos los call sites.

**Why:** antes la invalidación era asimétrica (las mutaciones de partida invalidaban,
las de curación no) y fácil de olvidar; un stat materializado futuro se quedaría stale.

**2. Identidad del dueño en stats ("sos vos"/isSelf).** El overlay de curación se aplica
en read-time. Casi todo stat per-user vive de aggregations en vivo, así que ya queda
fresco — EXCEPTO el match "¿el dueño aparece/ganó dentro de la partida?", que matcheaba
solo el username crudo. Fix: `computeGameStats(lower, gameId, { selfKeys })` testea la
clave de identidad del player (`u:<username>` / `n:<name>`, formato de `rawKeyFor`) contra
`selfKeys`, que provee `loadSelfKeys(lower)` (de [bggPlayerOverlay.js](server/services/bgg/bggPlayerOverlay.js)):
`u:<owner>` + los rawKeys de overlays `isSelf:true`. Default `[u:<owner>]` = comportamiento
previo. **How to apply:** cualquier stat NUEVO que resuelva "el dueño dentro de una
partida" debe consultar `selfKeys` vía `loadSelfKeys`, no comparar username a secas. Los
stats keyed por el LOGGER (`BggPlay.bggUsername`: computePlayedGames, leaderboards de
comunidad) ya son correctos — isSelf no los toca. Ver [[feedback-bgg-prefer-plays-aggregation]].

**3. Stats de COMUNIDAD curation-aware (cross-user).** Extendido a `bggCommunityStats.js`:
- **H2H y feed de actividad** normalizan los `players[]` de cada partida con el overlay de
  **SU logger**: `loadOverlayIndex(logger)` + `applyOverlayToPlayers(players, idx,
  { ownerLower: logger })` en JS, ANTES de matchear/mostrar. Así recuperan apariciones que
  el matcheo por username crudo perdía: alias propios "sos vos" y compañeros logueados por
  nombre y luego linkeados a un @BGG. `headToHead` por eso trae todas las partidas de A+B
  (sin pre-filtrar en Mongo) y filtra post-normalización. Es el **patrón para cualquier
  vista cross-user nueva**: normalizá por el overlay del logger de cada play.
- **Win-rates** (`communityWinRates`, `gameCommunityStats`) honran el isSelf de cada logger
  vía `SELF_KEYS_STAGES` (un `$lookup` a la colección de overlays por `ownerUsername`+isSelf
  que anexa `selfKeys` al doc) + el `OWNER_WIN_REDUCE` reescrito para testear la clave del
  player contra `$selfKeys`. Costo: un lookup por play (aceptable a esta escala).
- **No tocadas** (van por logger/juego, no por co-player): top juegos, leaderboards por
  plays/variedad, streaks, heatmap, rank, gameOwners, topPlayers/memberCount.

**Limitación conocida:** el fallback client-side de `BgWatchPerGameView` (usuarios nunca
sincronizados, sin datos en Mongo) deriva el win-rate por username crudo y NO refleja
isSelf. El server (ruta sincronizada, el caso normal) sí. Ver [[feedback-bgg-cache-pattern]].
