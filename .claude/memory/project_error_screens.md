---
name: project_error_screens
description: Pantallas 404/500 reimaginadas + el 500 doblando como takeover de backend-caído vía health-check de SiteConfig
metadata:
  type: project
---

2026-06-01 (handoff `design_handoff_errores`): pantallas de error full-screen con lenguaje de juego de mesa ("esta carta no está en el mazo" / "se nos volcó el tablero").

**Arquitectura** (`client/src/pages/error/`):
- `ErrorScreen.jsx` — base presentacional compartida (prop `variant: '404'|'500'`). Backdrop SVG de piezas flotando, monograma de marca, heroes inline (dado-con-`?` / tiles volcados + dado-con-`X`), código gigante con gradiente, copy lúdico, acciones, quick links (404) / chip de incidente copiable (500). **Se portalea a `document.body`** (como `Modal`) para escapar de los transforms de `PageTransition`; `z-index: 1100` para tapar el chrome flotante del shell (FAB/ChatLauncher en 1001). Theme-aware (tokens del proyecto, anda en dark y light). Título **imperativo** (`document.title` + restaura `prev` en unmount), NO Helmet — así el 500 es auto-contenido y una recuperación in-place no deja el tab pegado en "error".
- `NotFound.jsx` (404) — catch-all `path="*"` en App.jsx (antes redirigía a `/`). Quick links filtrados por `isSectionEnabled`. "Página anterior" usa el patrón `window.history.state?.idx > 0` (ver [[feedback_router_back_button_idx]]).
- `ServerError.jsx` (500) — wrapper; `onRetry`/`onHome` inyectables.
- `components/ErrorBoundary.jsx` — boundary de clase que envuelve `<AppShell>` y rinde `<ServerError>` ante un crash de render (BrowserRouter no tiene `errorElement`).

**500 = también takeover de "backend caído"** (lo pidió el usuario, le parecía gracioso que si el backend no anda aparezca el 500): el boot pega a `GET /api/site-config` (request pública que corre siempre). En `SiteConfigContext` se expone `backendDown` + `retryConnection`. Discriminación `isBackendDown(err)`: **sin respuesta (network/CORS/timeout) o 5xx ⇒ caído**; un 4xx significa server vivo y NO dispara. Timeout de 8s en el request para que un backend colgado no deje el splash girando. `AppShell` hace `if (backendDown) return <ServerError onRetry={retryConnection} />` (early-return DESPUÉS de todos los hooks). El splash espera `loading || !configLoaded` para que la toma del 500 entre sin flash del shell. OJO: un Error Boundary NO atrapa fallos async de fetch — por eso el health-check explícito, no el boundary.

Tests: `ErrorScreen/NotFound/ServerError/ErrorBoundary.test.jsx`, casos de `backendDown` en `SiteConfigContext.test.jsx`, y caso de takeover en `App.test.jsx`.

Pendiente (no implementado): status HTTP real 404/500 server-side (es SPA en Vercel, todo 200 vía rewrite) — requeriría edge/middleware.
