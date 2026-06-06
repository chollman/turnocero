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
- [x] **4. Borrador local** — `usePlayDraft` persiste `{ game, details,
      players }` en localStorage (key por usuario) en un form de creación EN
      BLANCO; al volver ofrece un banner "Retomar / Descartar"; se limpia al
      guardar/cancelar/descartar. +9 unit (hook) +5 form.
- [x] **5. Fecha no futura + duración sugerida** — (5a) `max` + `dateInvalid`
      gatea el submit con error inline. (5b) `JUGADO` ahora devuelve
      `avgDuration` (promedio del juego del dueño); el form ofrece "Tu promedio:
      X min · usar" cuando la duración está vacía.
- [x] **6. Deep-link de carga** — "Cargar partida" en cada juego de
      `ColeccionPanel` (Link al form con `?juego=`) + item "Cargar otra partida"
      en el menú de `PlayCard` (feed del perfil), ambos solo para el dueño
      (`canCreate`). +3 client.
- [x] **7. Autodetección "Nuevo" para invitados** — la detección se extendió a
      TODOS los @BGG del roster (no solo el dueño). `JUGADO` agrega `known` (¿el
      usuario tiene partidas sincronizadas?); se marca "Nuevo" solo con
      conocimiento positivo (`known && !played`), así un invitado sin sync no se
      marca por las dudas. Sigue automático + read-only. +server tests +client.
- [x] **8. Preview enriquecido** — el preview de `PlayForm` resuelve los
      avatares de los jugadores miembros vía `useBggUserMap([previewPlay])`
      (antes pasaba `userMap={}`). +1 client + default MSW handler.

## Pendientes

### 2. Reusar la última juntada — ✅ HECHO (ver Estado)

### 3. Score / posiciones más ricos — ✅ HECHO (ver Estado)

### 4. Borrador local (localStorage) — ✅ HECHO (ver Estado)

### 5. Validación de fecha + duración sugerida — ✅ HECHO (ver Estado)

### 6. Deep-link de carga desde otras vistas — ✅ HECHO (ver Estado)

### 7. Autodetección de "Nuevo" para invitados con @BGG — ✅ HECHO (ver Estado)

> Decisión tomada: "Nuevo" sigue **automático + read-only** (consistente con el
> dueño). En vez de marcar a ciegas a invitados desconocidos, `JUGADO` agrega
> `known` y solo se marca con conocimiento positivo (`known && !played`).

### 8. Preview enriquecido — ✅ HECHO (ver Estado)

### Extras menores — ✅ HECHO

- [x] **Empty states de los pickers con `<EmptyState>`** — `MyGamesPicker`,
  `LocationPicker` y `PlayerPicker` usan `<EmptyState variant="filtered" compact>`
  en vez de `<p>` de texto plano (distingue "sin datos" vs "sin coincidencias").
- [x] **Respetar la tab/origen al volver** — los deep-links pasan un param
  `volver=<ruta>` (colección → tab colección; "cargar otra" / FAB → la tab
  actual); `CreatePlay.goBack` lo usa (validado: solo rutas `/bg-watch/...`, si
  no cae al fallback por-juego/perfil).
