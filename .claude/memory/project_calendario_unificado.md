---
name: project-calendario-unificado
description: "Sección Calendario unificado (rama feature/calendario-unificado, 2026-06-02) — agrega mesas+eventos+torneos en grilla mensual + agenda, read-only"
metadata:
  node_type: memory
  type: project
  originSessionId: 82aff99d-8465-4bef-9274-223d7b19c161
---

Sección **Calendario unificado** (`/calendario`), rama `feature/calendario-unificado`, 2026-06-02. Capa de **solo lectura** que agrega las tres entidades con fecha del sistema en una vista de grilla mensual + agenda, con toggle **Mías/Comunidad** y chips de filtro por tipo.

**Único cambio de modelo:** `Torneo.fecha` (Date, opcional, nullable) — los torneos sin fecha no aparecen en el calendario. Se setea en `CreateTorneo`/`EditTorneo` con `<DateTimePicker>`. Mesas usan `date`, eventos `eventDate`.

**Backend:**

- `server/services/calendarService.js#getCalendarItems({ user, friendIds, from, to, scope, tipos, isAdmin })` — normaliza a `{ id, tipo, title, subtitle, date, status, url, host }`. Reutiliza `buildPrivacyFilter` (mesas), filtro de inscripciones de eventos, `visibleStatusFilter` (torneos). Un tipo se omite si su sección está OFF en SiteConfig (salvo admin). `scope=mias` sin user → [].
- `server/routes/calendario.js` — `GET /api/calendario?from&to&scope&tipos`, `optionalAuth` + `requireSection('calendario')`. `scope=mias` sin auth → 401. Rango default = mes corriente + siguiente; clamp a 366 días.
- Section key `calendario` agregado a `SiteConfig.SECTION_KEYS` (default ON).

**Frontend:**

- Página en `client/src/pages/calendario/` (`Calendario`, `MonthGrid`, `AgendaList`, `CalendarItemRow`, `tipos.js`, `Calendario.module.css`). Ruta pública en `App.jsx` (sin `PrivateRoute`, como noticias).
- `client/src/utils/calendar.js` — `buildMonthMatrix` (lunes-primero), `dayKey`, `addMonths`, `monthRange`, `groupByDay`, `monthLabel`. Reutiliza `eventoDate.js` (dateParts/countdown/etc.).
- Color por tipo: mesa=`--amber`, evento=`--green`, torneo=`--purple` (tokens). Nota: en este theme `--amber` renderiza azul (es el accent primario de marca).
- Plumbeada en Sidebar + GuestSidebar (icono propio), `routing.js#getActiveNavId`, `PanelAdmin` SECTION_META, `endpoints.js#API.calendario.LIST`, SiteConfigContext SECTION_KEYS.

Tests: `calendario.test.js` (integration), `calendarService.test.js` (unit), `calendar.test.js`, `Calendario/MonthGrid/AgendaList.test.jsx`. Factory `createTorneo` ahora acepta override `fecha`.

Ver [[feedback_panel_admin_toggles]], [[project_mesa_amigos_privacy]] (buildPrivacyFilter), [[feedback_service_layer]].
