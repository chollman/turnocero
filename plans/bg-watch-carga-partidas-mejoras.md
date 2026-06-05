# BG Watch — Mejoras pendientes para la carga/edición de partidas

## Contexto

La carga/edición de partidas en BG Watch se migró de un **modal** a **páginas
con route propio**, estilo creador de mesas:

- Rutas: `/bg-watch/:bggUsername/partidas/nueva` (acepta `?juego=<gameId>`) y
  `/bg-watch/:bggUsername/partidas/:playId/editar`.
- Form único con secciones (Juego / Jugadores / Extras) + preview en vivo:
  [PlayForm.jsx](../client/src/pages/bg-watch/PlayForm.jsx),
  [CreatePlay.jsx](../client/src/pages/bg-watch/CreatePlay.jsx),
  [EditPlay.jsx](../client/src/pages/bg-watch/EditPlay.jsx).
- Pickers paginados reutilizables: `MyGamesPicker`, `LocationPicker`,
  `PlayerPicker` (con búsqueda de usuarios TurnoCero), hook `useSearchTerm`
  (debounce + mín. 3 chars) y `SearchRowSkeleton`.
- Endpoints relacionados en [server/routes/bgg.js](../server/routes/bgg.js):
  `GET /api/bgg/mis-ubicaciones`, `mis-jugadores`, `jugado/:bggUsername/:gameId`
  (autodetección "Nuevo"), `partida/:bggUsername/:playId` (precarga al editar);
  y `GET /api/users/jugadores` en [server/routes/users.js](../server/routes/users.js).

Estas son las mejoras que quedaron sugeridas para encarar después.

## Estado

- [x] **1. Multi-partida rápida** — check "Cargar otra partida después de ésta"
      que conserva jugadores + ubicación + fecha y remonta el form al guardar
      (solo al crear). Hecho en `PlayForm` (`keepGoing`/`onKeepGoingChange`) +
      `CreatePlay` (`carry` + `formKey`).
- [x] **2. Reusar la última juntada** — botón "Usar última juntada" en el form
      que precarga el roster (nombre + @BGG) + ubicación de la partida más
      reciente. Server: `computeLastJuntada` + `GET /api/bgg/ultima-juntada/:user`. Cliente:
      `CreatePlay` la trae al montar y la pasa a `PlayForm`. +7 server +3 client.
- [x] **3. Score / posiciones más ricos** — helper puro
      [`playerPositions.js`](../client/src/pages/bg-watch/playerPositions.js)
      (`computePlayerPositions` con competition ranking 1,2,2,4 +
      `sortPlayersByScoreDesc`); el badge de posición y el payload se derivan del
      score, atajos +/- por fila y botón "Ordenar por puntaje". +12 unit +4 form.
- [x] **5a. Fecha no futura** — `max` en el datepicker + validación en JS
      (`dateInvalid`) que gatea el submit y muestra error inline. La parte 5b
      (duración sugerida) sigue pendiente — necesita exponer `avgDuration` al
      cliente (no hay endpoint hoy).
- [x] **6. Deep-link de carga** — "Cargar partida" en cada juego de
      `ColeccionPanel` (Link al form con `?juego=`) + item "Cargar otra partida"
      en el menú de `PlayCard` (feed del perfil), ambos solo para el dueño
      (`canCreate`). +3 client.
- [x] **8. Preview enriquecido** — el preview de `PlayForm` resuelve los
      avatares de los jugadores miembros vía `useBggUserMap([previewPlay])`
      (antes pasaba `userMap={}`). +1 client + default MSW handler.

## Pendientes

### 2. Reusar la última juntada — ✅ HECHO (ver Estado)

### 3. Score / posiciones más ricos — ✅ HECHO (ver Estado)

### 4. Borrador local (localStorage)

Guardar el form en progreso en `localStorage` (key tipo `turnocero_play_draft`)
para no perder lo cargado si se sale sin querer; ofrecer "Retomar borrador" al
volver. Limpiar al guardar/cancelar.

### 5. Validación de fecha + duración sugerida

- ~~No permitir fecha futura.~~ ✅ HECHO (ver Estado).
- **Pendiente (5b):** Sugerir la duración a partir del promedio histórico del
  juego (`computeGameStats(...).avgDuration` ya existe en
  [bggAggregations.js](../server/services/bgg/bggAggregations.js), pero falta un
  endpoint que lo exponga al cliente — el `JUGADO` actual solo devuelve
  `{ played, numPlays }`).

### 6. Deep-link de carga desde otras vistas — ✅ HECHO (ver Estado)

### 7. Autodetección de "Nuevo" para invitados con @BGG

Extender la detección actual (solo dueño) a los demás jugadores que tengan
usuario BGG cargado, consultando `GET /api/bgg/jugado/:bggUsername/:gameId`
por jugador (mejor en lote / con cuidado de rate limits y colecciones privadas;
best-effort, sigue siendo editable... aunque hoy "Nuevo" es read-only — ver nota).

> Nota: "Nuevo" hoy es **read-only** y autodetectado solo para el dueño. Si se
> extiende a invitados, definir si pasa a ser editable o sigue automático.

### 8. Preview enriquecido — ✅ HECHO (ver Estado)

### Extras menores

- Empty states de los pickers con el componente compartido `<EmptyState>`
  (hoy usan texto plano).
- Al volver del form, respetar la tab/origen de donde se vino (parcialmente
  hecho: vuelve a la vista por-juego si se entró con `?juego`).
