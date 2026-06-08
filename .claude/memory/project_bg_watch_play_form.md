---
name: project-bg-watch-play-form
description: "BG Watch carga/edición de partidas (PlayForm) — feature set completo + decisiones de diseño (date picker date-only, sugerencia de duración por tiempo de caja BGG, auto-ganador por score, borrador local, deep-links, etc.). Plan 100% cerrado y mergeado a master + review hardening 2026-06-08 (winsManual, budget de comments, validación server, fallback de edición a BGG)."
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
- **Auto-ganador** — al cambiar un score, `assignWinsByScore` mueve el trofeo al/los puntaje/s más alto/s (empates comparten); sin scores numéricos no toca el toggle manual. **Override manual (flag `winsManual`, fix review 2026-06-08):** apenas el usuario toca el toggle "Ganó" a mano —o al **editar** una partida ya cargada (default `winsManual=editMode`)— los cambios de score dejan de pisar la elección. Antes cualquier edición de puntaje reasignaba el ganador al mayor score, rompiendo juegos donde no gana el más alto.
- **Fecha** — usa el `<DateTimePicker dateOnly allowPast maxDate={hoy}>` compartido (NO `<input type=date>`). No futuro (gate + error backstop). Ver [[feedback-shared-form-components]].
- **Duración sugerida** — el **tiempo de caja de BGG** (`playingTime` de `/game/:id`, capturado en `BggGame` + backfill lazy; ver [[feedback-bgg-cache-pattern]]). Label "Tiempo de caja: X min · usar". **NO** es un promedio real (BGG no lo expone). Antes usaba el promedio personal (`avgDuration` en `JUGADO`) — se sacó.
- **Autodetección "Nuevo"** — para TODOS los @BGG del roster (no solo el dueño). `GET /api/bgg/jugado` devuelve `known` (¿el user tiene plays sincronizadas?) → se marca solo con **`known && !played`** (conocimiento positivo; no se marca a invitados desconocidos por las dudas). Automático + read-only.
- **Borrador local** — `usePlayDraft` persiste `{game,details,players}` en localStorage (key por usuario) en un form EN BLANCO; banner "Retomar/Descartar"; se limpia al guardar/cancelar/descartar.
- **Deep-links de carga** — "Cargar partida" por juego en `ColeccionPanel` + "Cargar otra" en el menú de `PlayCard` (solo dueño). El form vuelve a la tab/origen vía `?volver` (validado a rutas `/bg-watch/...`).
- **Preview enriquecido** — `useBggUserMap([previewPlay])` resuelve avatares de los jugadores que son miembros de TurnoCero.
- **Pickers** — empty states con `<EmptyState variant="filtered" compact>` (no texto plano).

## Review hardening (2026-06-08, rama `fix/bg-watch-play-form-review`)

Code review del creador de partidas → fixes (todos con tests):

- **Comments no pierden la firma** — `composeComments` (`playComments.js`) ahora **presupuesta las notas**: los bloques (expansiones/variante) y la firma `@turnocero0` van al final con prioridad; si el total excede `MAX_COMMENT_LENGTH` (1000, export nuevo) se recortan las **notas**, no la firma/bloques. Antes una nota larga empujaba la firma fuera del `slice(0,1000)` del server (`buildPlayForm`) → se rompía la detección "creada en TurnoCero" y se perdían expansiones. El slice del server quedó como red de seguridad.
- **`winsManual`** — ver bullet "Auto-ganador" arriba.
- **Validación server** — `validatePlayBody` (`bggMutations.js`) rechaza **fecha futura** (+1 día de gracia por TZ) y **roster >50** (`MAX_PLAYERS`). El cliente ya lo bloqueaba; el server es la autoridad.
- **Editar por refresh/deep-link sin sync** — `GET /api/bgg/partida/:user/:playId` cae a **buscar la partida en BGG** (`findPlayOnBgg`, escaneo acotado a `PARTIDA_BGG_SCAN_PAGES=10` páginas, orden fecha desc) cuando el usuario no tiene espejo en Mongo (`createPlay` no espeja a usuarios sin `BggPlay` previos). Antes 404eaba. La lista del perfil sigue disparando el reconcile que autosana. Respuesta unificada vía `playToApi`.
- **Hook compartido `useClickOutside`** (`client/src/hooks/`) — reemplaza los 2 effects duplicados de PlayForm (picker jugador / expansiones-variante) y el dropdown de `LocationPicker`. El callback se guarda en un ref actualizado en effect (no en render → respeta `react-hooks/refs`).
- **`<ScoreCell>`** — componente extraído en `PlayForm.jsx` para dedup del stepper −/input/+ entre modos versus y equipos (mismos aria-labels).
- **Nits** — sacada la dep `user` del effect de autodetección "Nuevo"; `◆` → `<Meeple/>` en preview (`PlayForm`) y kicker (`Scorecard`).

**NO se tocó** (con criterio): `window.confirm` del borrar (es la convención del repo, 15+ usos; el `<Modal>` es para overlays full-screen); fragilidad del round-trip de comentarios (un fix robusto cambiaría el formato del campo `comments` y rompería partidas ya guardadas; además el contenido round-tripea, no se pierde); spam de notif de partida compartida (decisión de producto: restringir a amigos/comunidad — queda abierto).

## Decisiones que se repreguntan

- **Sugerencia de duración = tiempo de caja**, no promedio (personal ni comunitario). Si quisieran promedio real, las aggregations existen (`computeGameStats.avgDuration` / `bggCommunityStats`), pero se eligió el tiempo de caja por estar siempre disponible.
- **"Nuevo" para invitados**: automático + read-only, solo con `known`. Se decidió NO marcar a ciegas a desconocidos.
- **Campo "Cantidad" QUITADO** (BGG `quantity` = cuántas veces se jugó en una entrada): confundía y casi no se usa. `quantity` se conserva en state para **no pisarlo al editar** una partida con `quantity > 1`; las nuevas quedan en 1.

## Endpoints tocados

- `GET /api/bgg/ultima-juntada/:user` → `{ juntada: { players:[{name,username}], location, date, gameName } | null }`.
- `GET /api/bgg/jugado/:user/:gameId` → `{ played, numPlays, known }` (se quitó `avgDuration`).
- `GET /api/bgg/game/:id` → ahora incluye `playingTime` / `minPlayTime` / `maxPlayTime` (tiempo de caja).
- `GET /api/bgg/partida/:user/:playId` → precarga para editar; sirve del espejo Mongo o, si no hay, **cae a BGG** (`findPlayOnBgg`) en vez de 404 (fix review 2026-06-08).

## Hub de comunidad — pendiente (no del PlayForm, pero del mismo dominio)

Del doc `docs/bg-watch-community-stats.md`, quedan fuera de alcance: comparador H2H libre (selector arbitrario en el hub), recomendaciones de juegos + gamificación, y cache de las aggregations (+ índice por `date` del feed). El scoping por comunidad (fase 2) ya está hecho.
