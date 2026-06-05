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

## Pendientes

### 2. Reusar la última junta
Precargar automáticamente jugadores + ubicación de la partida más reciente del
usuario (un botón "Usar última junta" o prefill al abrir el form). Fuente: la
última `BggPlay` por fecha; reusa el roster (nombre + @BGG) y `location`.

### 3. Score / posiciones más ricos
- Autocalcular la posición a partir del score (mayor score = 1°; empates
  comparten posición), como ya hace el server para partidas de grupos.
- Ordenar visualmente los jugadores por score.
- Atajos +/- para cargar el puntaje más rápido.

### 4. Borrador local (localStorage)
Guardar el form en progreso en `localStorage` (key tipo `turnocero_play_draft`)
para no perder lo cargado si se sale sin querer; ofrecer "Retomar borrador" al
volver. Limpiar al guardar/cancelar.

### 5. Validación de fecha + duración sugerida
- No permitir fecha futura.
- Sugerir la duración a partir del promedio histórico del juego
  (`computeGameStats(...).avgDuration` ya existe en
  [bggAggregations.js](../server/services/bgg/bggAggregations.js)).

### 6. Deep-link de carga desde otras vistas
Botón "Cargar partida" directo desde un `PlayCard` o desde la colección
(`ColeccionPanel`), navegando a `/bg-watch/:user/partidas/nueva?juego=<id>`.
Hoy solo se entra desde el perfil y la vista por-juego.

### 7. Autodetección de "Nuevo" para invitados con @BGG
Extender la detección actual (solo dueño) a los demás jugadores que tengan
usuario BGG cargado, consultando `GET /api/bgg/jugado/:bggUsername/:gameId`
por jugador (mejor en lote / con cuidado de rate limits y colecciones privadas;
best-effort, sigue siendo editable... aunque hoy "Nuevo" es read-only — ver nota).

> Nota: "Nuevo" hoy es **read-only** y autodetectado solo para el dueño. Si se
> extiende a invitados, definir si pasa a ser editable o sigue automático.

### 8. Preview enriquecido
Mostrar avatares vinculados (vía `useBggUserMap`) en la `<PlayCard>` de la vista
previa del form, no solo el nombre. Hoy el preview pasa `userMap={}`.

### Extras menores
- Empty states de los pickers con el componente compartido `<EmptyState>`
  (hoy usan texto plano).
- Al volver del form, respetar la tab/origen de donde se vino (parcialmente
  hecho: vuelve a la vista por-juego si se entró con `?juego`).
