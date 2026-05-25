---
name: project-ludoteca-de-eventos
description: 'Feature mergeada a master — agrega "Ludoteca del Evento" y "Mesas del Evento" dentro del detalle de cada Evento, con tabs y permisos para confirmed registrants.'
metadata:
  node_type: memory
  type: project
  originSessionId: 12809272-6ba5-42b7-9140-52782f4d77f7
---

**Estado (2026-05-22):** mergeada a master. Commits originales en master: `9290998` (schema phase 1), `408291e` (server endpoints phase 2), `aa1b29c` (client UI phase 3), `d201fee` (docs), `875e89d` (polish — tab slide + mesas count).

**Why:** Un Evento hoy es estático (fecha, lugar, condiciones, inscripciones). Faltaba el lado operativo del día del encuentro: qué juegos van a estar y qué mesas armar. Con esto el detalle del evento gana 2 pestañas nuevas: Ludoteca (juegos aportados por la comunidad) y Mesas (sub-mesas scoped al evento).

**How to apply:**

- **Mesas del Evento**: el modelo `Table` tiene ahora `eventoId` (null = global, ObjectId = mesa del evento). El listado `/api/tables` filtra `eventoId: null` — las del evento NUNCA aparecen en el global. Nuevo endpoint `GET /api/eventos/:id/mesas` reusa el helper `listTables()` exportado por `routes/tables.js`. Chat/comments/images/ratings funcionan idénticos sin cambios.
- **Mesa-del-evento hereda `location` y día del evento (single source of truth)**: cuando `POST /api/tables` recibe `eventoId`, el server IGNORA cualquier `location` del body y la copia del evento; y fuerza el día de `date` al de `evento.eventDate`, preservando solo la hora-del-día elegida por el host. El cliente refleja esto: `CreateTable.jsx` oculta el campo Ubicación y reemplaza el `datetime-local` por un `time` picker cuando hay `?evento=`. `EventoMesas.jsx` pasa `eventDate` por nav-state al navegar a `/mesas/crear?evento=` para evitar un refetch (con fallback defensivo a fetch si el state se pierde por refresh). Tests: `server/tests/integration/eventos-mesas.test.js` cubre los dos overrides defensivos.
- **Ludoteca**: array embedded en `Evento.ludoteca`, con metadata BGG hidratada server-side via `resolveGame()`. Dedupe lógico por `(addedBy, bggGameId)`.
- **Permisos write**: helper único `server/utils/eventoPermissions.js#canActInEvento(evento, user)` — admin del sitio | author del evento | confirmed registrant.
- **Cascada**: cuando un evento se cancela o elimina, `cancelAssociatedTables()` flipea todas sus mesas a `status: 'cancelled'` y emite `table:cancelled` a host + players + followers.
- **2 tipos nuevos de notificación agregables**: `evento_ludoteca_added`, `evento_mesa_created` (ruteados por el listener unificado `evento:notification` con `type` discriminador).
- **UI**: tabs en `EventoDetail.jsx` (`Detalle · Ludoteca · Mesas`) sincronizadas con `?tab=`. Componentes nuevos en `client/src/pages/eventos/`: `EventoLudoteca.jsx`, `EventoLudotecaPicker.jsx`, `EventoMesas.jsx`. Componente shared nuevo: `client/src/components/shared/BggGameSearch.jsx` (extraído de `CreatePlayModal`).

**Patrones reusables (relevantes para otras features):**

- Para sincronizar `?param=` con state, ver [[feedback-react-router-search-params]] — `useSearchParams` no dispara re-render.
- Picker de juegos BGG con colección + búsqueda: ver `EventoLudotecaPicker.jsx`. Reusable si otra feature lo necesita.
