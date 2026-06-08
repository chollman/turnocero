---
name: project-bg-watch-play-form
description: "BG Watch carga/edición de partidas (PlayForm) — feature set completo + decisiones de diseño (date picker date-only, sugerencia de duración por tiempo de caja BGG, auto-ganador por score, borrador local, deep-links, etc.). Plan 100% cerrado y mergeado a master."
metadata:
  node_type: memory
  type: project
  originSessionId: f43ebdd4-e116-4daf-88bd-8c80cba78538
---

# BG Watch — Carga/edición de partidas (PlayForm)

Plan **100% cerrado y mergeado a master** (2026-06). El detalle ítem por ítem está en
[plans/bg-watch-carga-partidas-mejoras.md](../../plans/bg-watch-carga-partidas-mejoras.md). Acá: el resumen de capacidades + las decisiones que conviene recordar para no repreguntar.

**Rutas:** `/bg-watch/:user/partidas/nueva` (acepta `?juego=<id>` y `?volver=<ruta>`) y `/bg-watch/:user/partidas/:playId/editar`. Form único `PlayForm.jsx`; contenedores `CreatePlay.jsx` / `EditPlay.jsx`. Pickers paginados: `MyGamesPicker`, `LocationPicker`, `PlayerPicker`.

## Rediseño "scoresheet" (2026-06-07, handoff `design_handoff_bgwatch_create`)

`PlayForm` se reskineó a una **libreta de puntajes**: 4 secciones numeradas con check verde (¿Qué jugaron? / ¿Cuándo y dónde? / ¿Quiénes jugaron? / Notas; progreso `doneCount/3`, Notas opcional) + **scorecard en vivo** (`Scorecard.jsx`, estilo ticket, acento púrpura) que reemplaza al `<PlayCard>` del preview. Header "Anotá la _partida._" (em script púrpura). **No** se forkeó: el reskin aplica a crear y editar. Hallazgo clave: el `index.css` del app YA ES el sistema del handoff (`--amber`=`#1888ef`=el `--accent` azul; `--purple`, Poppins/Archivo/JetBrains Mono/Caveat ya cargadas). Sólo se agregaron tokens `--gold`/`--gold-10/25`, `--text-faint` (theme-split) y `--font-serif` (Lora, + al link de fonts). Theme-aware (no forzado-oscuro). Novedades del rediseño:

- **Modo Cooperativa/Competitiva** (`mode` local): coop oculta scores y elige Ganamos/Perdimos → `win` en todos + `score:""`. Al editar infiere coop sólo en el caso "Ganamos" (≥2 jug, sin scores, todos win); el resto abre versus (limitación: "Perdimos coop" no se distingue de versus vacío).
- **Jugador anónimo** — botón "+ Jugador anónimo" agrega asientos `"Jugador anónimo N"` (numerados, renumerados al quitar), avatar fantasma 👤 + tag "anónimo", sin @handle. Va a la partida (cuenta/score/posición/win) pero **NO** a la lista de compañeros: nombre reservado filtrado en `computePlayedCoPlayers` + `computeLastJuntada` vía `server/services/bgg/anonymousPlayer.js#isAnonymousName` (espejo cliente `pages/bg-watch/anonymousPlayer.js`). Distinto del "Usar «Nombre»" del PlayerPicker, que SÍ trackea. No dispara notif de partida compartida ni autodetección "Nuevo" (no tiene username).
- **Chips rápidos** Hoy/Ayer en fecha + presets 30/60/90/120 en duración (además del "Tiempo de caja").
- **Footer**: "Cancelar" / "Guardar y cargar otra" / "Guardar partida". El multi-save cambió de checkbox a botón: contrato nuevo `onSubmit(payload, { keepGoing })` + prop `allowMultiSave` (lo pasa `CreatePlay`, no `EditPlay`); se eliminaron `keepGoing`/`onKeepGoingChange`.

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
