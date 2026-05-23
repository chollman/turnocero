---
name: project-ludoteca-de-eventos
description: 'Feature mergeada a master — agrega "Ludoteca del Evento" y "Mesas del Evento" dentro del detalle de cada Evento, con tabs y permisos para confirmed registrants.'
metadata:
  node_type: memory
  type: project
  originSessionId: 12809272-6ba5-42b7-9140-52782f4d77f7
---

**Estado (2026-05-22):** mergeada a master. Commits originales en master: `9290998` (schema phase 1), `408291e` (server endpoints phase 2), `aa1b29c` (client UI phase 3), `d201fee` (docs), `875e89d` (polish — tab slide + mesas count). La branch local `ludoteca-de-eventos` quedó congelada antes del lint-zero (`6faf3dc`) y se puede borrar — todos sus commits ya están en master.

**Why:** Un Evento hoy es estático (fecha, lugar, condiciones, inscripciones). Faltaba el lado operativo del día del encuentro: qué juegos van a estar y qué mesas armar. Con esto el detalle del evento gana 2 pestañas nuevas: Ludoteca (juegos aportados por la comunidad) y Mesas (sub-mesas scoped al evento).

**How to apply:**

- **Mesas del Evento**: el modelo `Table` tiene ahora `eventoId` (null = global, ObjectId = mesa del evento). El listado `/api/tables` filtra `eventoId: null` — las del evento NUNCA aparecen en el global. Nuevo endpoint `GET /api/eventos/:id/mesas` reusa el helper `listTables()` exportado por `routes/tables.js`. Chat/comments/images/ratings funcionan idénticos sin cambios.
- **Ludoteca**: array embedded en `Evento.ludoteca`, con metadata BGG hidratada server-side via `resolveGame()`. Dedupe lógico por `(addedBy, bggGameId)`.
- **Permisos write**: helper único `server/utils/eventoPermissions.js#canActInEvento(evento, user)` — admin del sitio | author del evento | confirmed registrant.
- **Cascada**: cuando un evento se cancela o elimina, `cancelAssociatedTables()` flipea todas sus mesas a `status: 'cancelled'` y emite `table:cancelled` a host + players + followers.
- **2 tipos nuevos de notificación agregables**: `evento_ludoteca_added`, `evento_mesa_created` (ruteados por el listener unificado `evento:notification` con `type` discriminador).
- **UI**: tabs en `EventoDetail.jsx` (`Detalle · Ludoteca · Mesas`) sincronizadas con `?tab=`. Componentes nuevos en `client/src/pages/eventos/`: `EventoLudoteca.jsx`, `EventoLudotecaPicker.jsx`, `EventoMesas.jsx`. Componente shared nuevo: `client/src/components/shared/BggGameSearch.jsx` (extraído de `CreatePlayModal`).

**Patrones reusables (relevantes para otras features):**

- Para sincronizar `?param=` con state, ver [[feedback-react-router-search-params]] — `useSearchParams` no dispara re-render.
- Picker de juegos BGG con colección + búsqueda: ver `EventoLudotecaPicker.jsx`. Reusable si otra feature lo necesita.

**Pending al cierre del session:** Fase 4 del plan original (verificación E2E + docs) — no se ejecutó. Si se merge la branch, considerar correr el smoke manual descrito en `/Users/claudiohollman/.claude/plans/glittery-juggling-rainbow.md`.
