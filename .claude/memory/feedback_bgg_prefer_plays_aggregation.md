---
name: feedback-bgg-prefer-plays-aggregation
description: "Cualquier widget BGG que muestre \"qué jugó / cuánto / cómo le fue\" debe derivar de BggPlay aggregations, NO de la colección. La colección omite juegos jugados-no-poseídos y queda vacía para perfiles con colección privada (H3rmit87 case)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9099d291-a3e5-40aa-9a9f-b0de83c3a6e6
---

Cuando agregues una vista, card, o estadística en `/bg-watch`, `/usuarios/:id`, o cualquier feature relacionada al juego del usuario, **derivá de `BggPlay` (vía aggregation server-side), no de la colección**. La colección tiene dos blind spots que aparecen una y otra vez en bugs reales:

1. **Juegos jugados-pero-no-poseídos**: el usuario logueó una partida en BGG de un juego que jamás marcó como "owned"/"played" en su colección. Common pattern: jugar en lo de un amigo, demo en una convención, prestado. La colección no tiene esa entry pero el log de partidas sí.

2. **Colecciones privadas**: usuarios como H3rmit87 tienen su colección marcada privada en BGG. `xmlapi2/collection?username=X` devuelve 401. Nuestra `BggCollection` para ese usuario queda vacía. Si una vista deriva de colección, queda totalmente vacía o incompleta. El log de partidas no tiene este problema — ese endpoint sí responde con datos.

**Why:** Bugs reales encontrados en esta secuencia, todos con el mismo root cause:
- "Más jugado" en `StatsBar` (`/bg-watch/:user`) — fix: prefer `playsMeta.topGame` (server agg via `computeTopPlayedGame`) sobre `collection.reduce`.
- `topGame` en `BgWatchUserCard` (`/usuarios/:id`) — mismo fix.
- `gameStats` en `BgWatchPerGameView` (`/bg-watch/:user/juego/:gameId`) — antes derivaba per-page; ahora server agrega via `computeGameStats` sobre todo el historial.
- "Por juego" tab en `PartidasPanel` — antes filtraba `collection.numPlays > 0`; ahora usa `GET /api/bgg/juegos-jugados/:user` (server agg via `computePlayedGames`).

La lista de partidas (modo "Lista") NUNCA tuvo este bug porque ya leía directamente de BggPlay/`/plays` — sin filtro por colección. El error siempre estuvo en las vistas DERIVADAS (top-N, stats agregadas, listas de juegos).

**How to apply:**
- Si vas a mostrar "qué juegos jugó este usuario" o "cuántas partidas de X" o cualquier ranking/agregado: PRIMERO buscá si ya hay un helper de aggregation en [server/routes/bgg.js](server/routes/bgg.js) (`computeTopPlayedGame`, `computeGameStats`, `computePlayedGames`). Reusalo o seguí su patrón.
- Si tu agregación es nueva: aggregation pipeline sobre `BggPlay`, NO sobre `BggCollection`. Patrón: `$match { bggUsername, gameId: { $ne: null } } → $group { _id: gameId, ... } → $sort`.
- **Mantener fallback a colección** cuando el server devuelve nada Y `BggPlay` está vacío para ese usuario: cubre el path L1/L3 BGG XML (usuarios todavía no sincronizados). En el caso común con sync activo, el server data es autoritativo.
- En el frontend: `const x = serverData?.fromPlays ?? collectionFallback(collection)`. Mismo patrón en `StatsBar.jsx:19`, `BgWatchUserCard.jsx:60`, `BgWatchPerGameView.jsx:113`, `PartidasPanel.jsx:140-151`.
- Test cobertura: incluir SIEMPRE un test del caso "colección vacía/privada" (mock con `[]` o 401) para verificar que la vista igual muestra datos desde el aggregation.

Anti-pattern: derivar stats / top games / listas de juegos jugados de `collection.filter/reduce/sort` sin server fallback. Si lo ves en código existente, es un bug latente — eventualmente alguien con colección privada o con plays unowned va a reportarlo.

Relacionado: [[feedback-bgg-sync-engine]] documenta los helpers de aggregation disponibles + cómo se mantiene `BggPlay` fresco.
