---
name: project-bg-watch-play-form
description: 'BG Watch carga/edición de partidas (PlayForm) — feature set completo + decisiones de diseño (date picker date-only, sugerencia de duración por tiempo de caja BGG, auto-ganador por score, borrador local, deep-links, etc.). Plan 100% cerrado y mergeado a master.'
metadata:
  node_type: memory
  type: project
---

# BG Watch — Carga/edición de partidas (PlayForm)

Plan **100% cerrado y mergeado a master** (2026-06). El detalle ítem por ítem está en
[plans/bg-watch-carga-partidas-mejoras.md](../../plans/bg-watch-carga-partidas-mejoras.md). Acá: el resumen de capacidades + las decisiones que conviene recordar para no repreguntar.

**Rutas:** `/bg-watch/:user/partidas/nueva` (acepta `?juego=<id>` y `?volver=<ruta>`) y `/bg-watch/:user/partidas/:playId/editar`. Form único `PlayForm.jsx`; contenedores `CreatePlay.jsx` / `EditPlay.jsx`. Pickers paginados: `MyGamesPicker`, `LocationPicker`, `PlayerPicker`.

## Capacidades del form
- **Multi-partida rápida** — check "cargar otra" conserva roster+ubicación+fecha y remonta (`keepGoing`/`carry`).
- **Usar última juntada** — botón que precarga roster (nombre+@BGG) + ubicación de la última partida. Server: `computeLastJuntada` + `GET /api/bgg/ultima-juntada/:user`.
- **Score → posición** — `playerPositions.js#computePlayerPositions` (competition ranking 1,2,2,4); el badge y el payload derivan del score; atajos +/- por fila y botón "Ordenar por puntaje". El badge hace un **glitch cyberpunk al cambiar** (`PositionBadge`, ver [[feedback-cyberpunk-glitch]]).
- **Auto-ganador** — al cambiar un score, `assignWinsByScore` mueve el trofeo al/los puntaje/s más alto/s (empates comparten); sin scores numéricos no toca el toggle manual.
- **Fecha** — usa el `<DateTimePicker dateOnly allowPast maxDate={hoy}>` compartido (NO `<input type=date>`). No futuro (gate + error backstop). Ver [[feedback-shared-form-components]].
- **Duración sugerida** — el **tiempo de caja de BGG** (`playingTime` de `/game/:id`, capturado en `BggGame` + backfill lazy; ver [[feedback-bgg-cache-pattern]]). Label "Tiempo de caja: X min · usar". **NO** es un promedio real (BGG no lo expone). Antes usaba el promedio personal (`avgDuration` en `JUGADO`) — se sacó.
- **Autodetección "Nuevo"** — para TODOS los @BGG del roster (no solo el dueño). `GET /api/bgg/jugado` devuelve `known` (¿el user tiene plays sincronizadas?) → se marca solo con **`known && !played`** (conocimiento positivo; no se marca a invitados desconocidos por las dudas). Automático + read-only.
- **Borrador local** — `usePlayDraft` persiste `{game,details,players}` en localStorage (key por usuario) en un form EN BLANCO; banner "Retomar/Descartar"; se limpia al guardar/cancelar/descartar.
- **Deep-links de carga** — "Cargar partida" por juego en `ColeccionPanel` + "Cargar otra" en el menú de `PlayCard` (solo dueño). El form vuelve a la tab/origen vía `?volver` (validado a rutas `/bg-watch/...`).
- **Preview enriquecido** — `useBggUserMap([previewPlay])` resuelve avatares de los jugadores que son miembros de TurnoCero.
- **Pickers** — empty states con `<EmptyState variant="filtered" compact>` (no texto plano).

## Decisiones que se repreguntan
- **Sugerencia de duración = tiempo de caja**, no promedio (personal ni comunitario). Si quisieran promedio real, las aggregations existen (`computeGameStats.avgDuration` / `bggCommunityStats`), pero se eligió el tiempo de caja por estar siempre disponible.
- **"Nuevo" para invitados**: automático + read-only, solo con `known`. Se decidió NO marcar a ciegas a desconocidos.
- **Campo "Cantidad" QUITADO** (BGG `quantity` = cuántas veces se jugó en una entrada): confundía y casi no se usa. `quantity` se conserva en state para **no pisarlo al editar** una partida con `quantity > 1`; las nuevas quedan en 1.

## Endpoints tocados
- `GET /api/bgg/ultima-juntada/:user` → `{ juntada: { players:[{name,username}], location, date, gameName } | null }`.
- `GET /api/bgg/jugado/:user/:gameId` → `{ played, numPlays, known }` (se quitó `avgDuration`).
- `GET /api/bgg/game/:id` → ahora incluye `playingTime` / `minPlayTime` / `maxPlayTime` (tiempo de caja).

## Hub de comunidad — pendiente (no del PlayForm, pero del mismo dominio)
Del doc `docs/bg-watch-community-stats.md`, quedan fuera de alcance: comparador H2H libre (selector arbitrario en el hub), recomendaciones de juegos + gamificación, y cache de las aggregations (+ índice por `date` del feed). El scoping por comunidad (fase 2) ya está hecho.
