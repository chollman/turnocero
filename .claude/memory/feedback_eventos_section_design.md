---
name: feedback-eventos-section-design
description: "Decisiones de diseño/UX de la sección Eventos tras el rediseño completo: editorial hero, timeline+poster modes, ticket stub sidebar, 3-column triage admin, cancel reversible vs delete duro, conteo de inscriptos excluye rechazados, auto-close por fecha, rooms socket por evento + list room opt-in."
metadata:
  node_type: memory
  type: feedback
---

Rediseño completo de Eventos (mayo 2026) basado en handoff `handoff/eventos/`. Decisiones importantes que la próxima iteración debería respetar.

## Estructura visual

- **Lista** ([Eventos.jsx](client/src/pages/eventos/Eventos.jsx)): hero editorial ("Eventos de la *comunidad*." con "comunidad" en font-script + dot blanco), chips de filtros (Todos / Abiertos / Mis inscr. / Cerrados / Borradores / Cancelados — los últimos dos admin-only), view toggle Timeline ↔ Posters persistido en `localStorage` bajo `turnocero_eventos_view`.
- **Timeline row**: la row entera es un `<Link>` (sin links anidados), CTA dice siempre "Más info!" sin importar el estado del usuario. El estado (host / inscripto / pending / sin cupo / cancelado) se comunica vía badges + color del dot del riel, no via el label del botón.
- **Detalle** ([EventoDetail.jsx](client/src/pages/eventos/EventoDetail.jsx)): hero 16:9, meta strip de 4 celdas (Cuándo / Dónde / Inscripción / Cupo), ticket stub sticky a la derecha (340px desktop, static mobile) con perforated tear.
- **Inscripciones admin** ([EventoInscripciones.jsx](client/src/pages/eventos/EventoInscripciones.jsx)): 3 columnas triage (Pendientes 1.2fr / Confirmadas 1fr / Rechazadas 1fr → 1col en mobile).

## Reglas de negocio

- **Cancelar evento** = soft (status='cancelled'). El botón antes hacía hard-delete; ahora preserva data. Aparecer en filtro "Cancelados" (admin-only).
- **Reabrir evento**: cuando `status === 'cancelled'` y sos host, el botón "Cancelar" se reemplaza por "Reabrir" (one-click, sin confirm).
- **Rechazar inscripción**: dos botones distintos — "Rechazar" (soft, permite reintentar) vs "Bloquear del evento" (permanente, flag `permanentlyRejected: true`). El permanente bloquea POST /inscribirse con 403.
- **Retry post-rechazo no-permanente**: POST /inscribirse recicla el registro existente (cleanup comprobante anterior en Cloudinary, reset status/notes/reviewedAt, nuevo comprobante). NO duplica registros.
- **Revertir decisión**: vuelve confirmed/rejected → pending con submittedAt fresco. Limpia adminNotes, reviewedAt, permanentlyRejected. Comprobante se conserva.
- **Auto-close por fecha**: `closePastOpenEvents()` corre lazy al inicio de GET /api/eventos y GET /:id. Cualquier evento `status: 'open'` con `eventDate < now` pasa a `'closed'`. Drafts/cancelled no se tocan.
- **Validación de campos requeridos**: title y eventDate son obligatorios (server-side 400, client-side JS validation, sin `required` HTML5 para no chocar con JSDOM en tests). `eventDate` también es `required: true` en el schema de Mongoose.
- **Eventos draft + cancelled** ocultos para non-admins en GET /:id (404). En GET / la lista pública sólo muestra open/closed.

## Conteo de inscriptos

- **Public-facing count = pending + confirmed** (NO total). Los rechazados (perm o no) no ocupan slot. Aplica al meta text de TimelineRow, PosterCard, ticket stub y meta strip del detalle.
- **`registrationCount.total`** en el API se mantiene como dato auditable (lo usa el panel admin de Inscripciones), pero no se renderiza en superficies públicas.
- **EventoInscripciones counts** se derivan de `data.registrations` con `useMemo` — no se mantienen en state separado para evitar doble-conteo entre optimistic update y socket listener. Ver [[feedback-derived-counts]].

## Real-time con Socket.IO

- **Rooms**:
  - `user:<id>` (auto-joined): emits dirigidos a un usuario.
  - `evento:<id>` (opt-in via `join:evento`): viewers de un evento puntual (detalle + inscripciones admin).
  - `eventos:list` (opt-in via `join:eventos-list`): viewers del listado.
- **Eventos emitidos** (ver [server/routes/eventos.js](server/routes/eventos.js)):
  - `evento:created` → `eventos:list` (skip drafts).
  - `evento:updated` → `evento:<id>` + `eventos:list` (transición a draft emite `evento:deleted` a list).
  - `evento:deleted` → `evento:<id>` + `eventos:list`.
  - `evento:counts-changed` → ambos rooms.
  - `evento:registration-created` → `user:<hostId>` (admin del evento).
  - `evento:registration-cancelled` → `user:<hostId>`.
  - `evento:registration-reviewed` → `user:<userId>` (target) + `evento:<id>` (incluye `registration` populado con user para mantener confirmedRegistrations al día).
- **Patrón de subscripción cliente**: `socket.on('connect', () => socket.emit('join:evento', id))` en `useEffect`. El emit en `connect` cubre initial + reconnects. Cleanup hace `socket.disconnect()`. Crítico: los handlers del server deben estar registrados antes del `await` de auth — ver [[feedback-socket-handler-race]].

## Convenciones de tokens / estilos

- Editorial hero usa `var(--font-script)` (Caveat) en `<em>` para palabra-clave (ej. "comunidad") con color `--amber-light`. El "." final fuera del `<em>` para que herede el blanco del título.
- Posters (3:4 aspect) son intencionalmente oscuros en ambos temas (afiche cinematográfico) — overlay con `linear-gradient` hard-coded `rgba(10,13,21,...)`. Documentado en CSS con comentario.
- Forced-dark NO aplica acá (sólo en Utilidades); el resto es theme-aware.
- Cupos bar usa `--amber` → `--amber-light` linear-gradient; `--red` cuando `isFull`.

## Tests

- 33 server tests cubren los flujos críticos: validación de campos, auto-close, partial PUT, permanent rejection + retry recycling, revertir, gates de admin, draft/cancelled visibility, list endpoint enrichment.
- 114 client tests cubren componentes en aislamiento + pages con MSW.
- Patrón de mock de socket: ninguno — los listeners no se mockean en tests, sólo se prueba con MSW + handlers HTTP.
