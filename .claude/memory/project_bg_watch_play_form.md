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

## Sección 5 — "Compartí esta partida" (2026-06-08)

Quinta sección **opcional** del `PlayForm` (después de Notas, solo al crear, gateada por `!editMode`): una **tarjeta clicable** (el header entero es un `<button>`, sin checkbox ni InfoTooltip) que se **despliega con slide** (grid-template-rows 0fr→1fr + chevron que rota) mostrando `<CommunitySelect>` + `<JuntadaFields>` (mismo form que una juntada normal). El cuerpo se monta siempre (para animar) y se recorta con `overflow:hidden`. Al guardar la partida, si está abierta, se crea **también** una juntada en Compartidas y se **copia el deeplink** (`/compartidas/:id`) al portapapeles para pegarlo en WhatsApp/Telegram (que lo despliegan con el OG). Motivación: BGG no permite fotos en una partida; las fotos viven en Compartidas. Decisiones del usuario: tarjeta clicable con slide (no checkbox); copiar **solo el deeplink** (no texto armado — WhatsApp ya hace unfurl); **pre-cargar el juego** recién registrado (quitable); incluir **los mismos campos que una juntada** (privacidad + comunidad + juegos + título + texto + fotos).

**Widget de resultados (reemplazó al pre-fill del cuerpo, 2026-06-08):** en vez de pre-poblar el cuerpo con texto, la juntada embebe un **`<Scorecard publicView>`** (el mismo "preview de la partida") en el área de fotos. Se guarda un snapshot `playResult` en la Compartida (ver abajo) y se renderiza el widget en feed + detalle. **`buildResultsBody` fue eliminado.**
- `client/src/pages/bg-watch/buildPlayResult.js` — arma el snapshot desde los MISMOS `scorecardRows` que el preview en vivo (descarta `you`/`leader`/`key`, `score`→string, **sin location**, null si no hay juego/filas). Se hoisteó `scorecardRows` arriba de `submit` para reusarlo.
- `client/src/pages/bg-watch/playResultToScorecard.js` — adapter snapshot→props del Scorecard: recomputa `leader`, `you=false`, `userMap:{}` (iniciales, sin fetch por tarjeta), `publicView:true`.
- `Scorecard.jsx` ganó prop `publicView` + export `deriveWinnerLabel(rows,mode)`: banner por ganador ("Ganó X"/"¡Ganaron!"/"Ganó el Equipo X") en vez de "¡Ganaste!", sin "(vos)" ni highlight propio.
- `CompartidaCard.jsx` renderiza `<Scorecard {...playResultToScorecardProps(post.playResult)} />` arriba de las fotos (y en la columna de texto del layout featured); `.playResult` CSS centra a `min(340px,100%)`. El detalle reusa CompartidaCard.
- Server: `Compartida.playResult` (sub-schema `playResultSnapshotSchema` con `mode` enum + players acotados; reseñas lo nulean en `pre('validate')`). `routes/compartidas.js#sanitizePlayResult` coerciona/acota (team A-D, ≤24 players) y re-resuelve el thumbnail del juego desde `gameId` (best-effort). **El `playResult` cuenta como contenido** → una juntada solo-scorecard (sin título/texto/foto) es válida (gate relajado). Snapshot self-contained (no necesita lookups).

**Seeding del juego:** efecto one-shot (`shareSeededRef`) al abrir la sección con `game` presente; siembra `games:[juego]` (quitable). El cuerpo NO se pre-puebla (los resultados van al widget). `submit` arma `playResult = buildPlayResult({scorecardRows,mode,game,details})` y lo suma al bloque `share`; `hasShareContent` incluye `!!playResult` ⇒ **abrir la tarjeta con un juego ya alcanza para compartir** (no hace falta texto/foto). `CreatePlay.runShare` lo forwardea a `createJuntada` (que solo pasa el payload). **Limitación de verificación:** el form está gateado por cuenta BGG conectada (dev = Atlas remoto, no se tocan credenciales) → el widget se verificó creando una juntada con `playResult` vía API y mirándola en `/compartidas/:id` (render OK: kicker, banner "Ganó X", ranking con corona/score/avatares).

**Arquitectura (extracción, no duplicación del paso delicado):**
- `client/src/pages/compartidas/createJuntada.js` — `createJuntada({payload, files}) → finalPost` + `toGamePayload`. Encapsula el flujo de **2 pasos** (POST `/compartidas` → subir cada imagen a `/compartidas/:id/images` → si falla una imagen, DELETE de cleanup + rethrow). Lo usan **tanto** `CreateCompartidaForm` (su submit ahora llama acá; su render quedó intacto → sus 28 tests verdes) **como** la sección 5.
- `client/src/pages/compartidas/JuntadaFields.jsx` (+ `.module.css`) — componente **controlado** (`value`/`onChange`/`disabled`) con privacidad+juegos+título+texto+fotos. Reusa las clases de `CreateCompartidaForm.module.css`. Lo consume la sección 5 (NO se cableó dentro de `CreateCompartidaForm` para no tocar su toggle reseña↔juntada que comparte title/games — se aceptó duplicar ~markup de campos a cambio de cero riesgo sobre el componente testeado).
- `PlayForm.jsx`: estado `shareEnabled`/`shareValue` (incluye `community`; `JuntadaFields` la deja pasar), `shareSeededRef` para pre-cargar el juego una vez. `submit(keepGoing)` arma `share` (o `null` si off / sin contenido — criterio título||texto||foto, el juego precargado NO cuenta) y lo pasa: `onSubmit(payload, { keepGoing, share })`. **NO** se persiste en `usePlayDraft` (fotos = blobs no serializables; el draft es para no perder la partida).
- **Orquestación en `CreatePlay.handleSubmit(payload, { keepGoing, share })`**: (1) POST partida en su propio try/catch — si falla, no se intenta la juntada; (2) partida OK → `createJuntada` + `buildCompartidaShare(post, origin).url` + `navigator.clipboard.writeText` en try/catch **aislado** (una falla de juntada NUNCA revierte la partida; toast no bloqueante "La partida se guardó, pero no se pudo crear la compartida"). Multi-partida: la sección 5 se crea una vez por click y **no** va en `carry` (se resetea al remontar). Toasts distintos por keepGoing×shareResult.

**Limitación de verificación:** el `PlayForm` está gateado por cuenta BGG conectada (`canCreate = isOwner && bggConnected`), y el usuario de test (`reference-test-credentials`) no tiene BGG → la sección 5 no se pudo manejar en el preview; cubierta por tests (PlayForm/CreatePlay/JuntadaFields/createJuntada, +21). El path `createJuntada` SÍ se verificó en vivo vía el composer de `/compartidas`.

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
