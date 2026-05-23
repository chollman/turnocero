---
name: shared-helpers-catalog
description: Catálogo de hooks/utils compartidos client + server — usar siempre estos en lugar de reimplementar el patrón
metadata:
  type: feedback
---

**Desde 2026-05-22 (Fase 2 del audit, commit `0971bb7`).** El monorepo tiene un set de hooks y utils que reemplazan patrones duplicados. **Antes de escribir un helper nuevo, mirar acá.**

**Why:** Cada uno apareció ≥3 veces antes de extraerse. Reimplementarlos genera drift (regex de password distintos en Register vs ResetPassword; defaults de pagination distintos por router; `count.toString() === other.toString()` con typos en 1 de 180 lugares).
**How to apply:** Cuando hagas un PR nuevo o modifiques algo que use un patrón listado abajo, migrar al helper. Si vas a crear un helper similar, primero buscar acá si ya existe.

## Client — `client/src/hooks/`

- **`useApi(fn, opts)`** — wrap async + `{ loading, error, data, execute }`. Auto-cleanup en unmount (evita setStates sobre componentes desmontados). Error usa `getErrorMessage`.
- **`useShowcaseTables({ enabled? })`** — fetch de `/api/tables/showcase` con seed estable. Reemplazó el patrón duplicado en las 5 auth pages (Login/Register/Forgot/Reset/Verify). `enabled` permite saltarse el request cuando `SiteConfig.sections.mesas` está OFF.
- **`useDebouncedValue(value, ms)`** — debounce de inputs → fetch ([[debounce-inputs]]).

## Client — `client/src/utils/`

- **`getErrorMessage(err, default)`** — extrae `err.response?.data?.message` (forma estándar `{ message }` del server), fallback a `err.message` y a `default`. Reemplaza el patrón `err.response?.data?.message || 'algo'` en ~10 catches.
- **`passwordValidation`** — `isValidPassword(pwd)` + `PASSWORD_REQUIREMENTS` (string en español). 8+ chars, una mayúscula, un número.
- **`storageKeys`** — `STORAGE_KEYS` frozen object: `TOKEN`, `VIEW_AS_USER`, `THEME`, `BANNED_MESSAGE`, `FLASH_MESSAGE`, `PENDING_VERIFY_EMAIL`. **No usar strings hardcoded** — un typo silencioso podía romper login persistence.
- **`distance.js#formatDistanceKm`** — formateo "Aquí mismo" / "850 m" / "12,3 km" / "250 km".
- **`userDisplay.js#getUserDisplay`** — normalizar shape de user populated (ver [[deleted-user-ui]]).

## Server — `server/utils/`

- **`idCompare.isSameId(a, b)`** — comparación de ObjectIds tolerante a strings vs instances. Reemplaza `a.toString() === b.toString()` (aparece 180+ veces en server, migración incremental cuando se toque cada router).
- **`paginate.parsePagination(query, opts)`** — `{ page, limit, skip }` con defaults configurables. Migrado en compartidas, tables, eventos, noticias, torneos. **No reinventar `Math.max/Math.min` manual.**
- **`socketHelpers`** — `emitToUser`, `emitToTableRoom`, `emitToEventoRoom`, `emitToEventosList`, `emitToAdminRoom`. Best-effort (nunca propaga errores). eventos.js ya migrado; tables/torneos/dm migran al toque.
- **`regex.escapeRegex(str)`** — antes vivía duplicado en 5 routers como `.replace(/[.*+?^${}()|[\]\]/g, "\$&")`.
- **`clamp(n, lo, hi)`** — tolerante a NaN/Infinity → devuelve `lo`.
- **`asyncHandler(fn)` + `httpError(status, msg)`** — ver [[asyncHandler-errorHandler-pattern]].
- **`logger`** — usar `logger.info/warn/error("Label", { meta })`, NO `console.*`. Output JSON estructurado con timestamp y stack. Migrado en eventos + BGG modules + jobs + saveNotification; el resto migra al toque.
- **`emitNotificationReq(req, recipientId, type, fields, socketEvent, extra?)`** — el helper canónico de notificaciones que inyecta `notifId`+`count`+`timestamp`. **Awaitearlo siempre** antes de `res.json(...)`.

## Server — `server/config/`

- **`cors.js`** — `allowedOrigins` + `corsOptions` exportados. Reemplaza la duplicación entre `app.js` (callback) y `server.js` (Socket.IO).

## Patrones que NO tienen helper aún (oportunidad)

- `axios.get/post/...` con `AbortController` + cleanup — los componentes lo inline; podría ser un `useFetch` o ya cubierto por `useApi` según el caso.
- `try { JSON.parse(localStorage.x) }` aún aparece en algunos contextos fuera de Auth.
- Server: `Cloudinary.uploader.destroy(publicId)` con catch silencioso en cleanup de uploads.
