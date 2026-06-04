---
name: project-community-subdomains
description: "Subdominios single-tenant por comunidad (feature/community-subdomains, 2026-06-03)"
metadata: 
  node_type: memory
  type: project
  originSessionId: ffba6fd6-d96a-4339-90b4-62423a1cefed
---

Subdominios single-tenant por comunidad — rama `feature/community-subdomains` (2026-06-03). Extiende [[project-comunidades]]: una comunidad con `subdomainEnabled: true` es accesible en `<slug>.turnocero.com` y ahí el sitio se acota a ESA comunidad ("como si las demás no existieran"). Decisiones: **vidriera pública** (anónimos/no-miembros ven contenido público read-only), **opt-in por comunidad** (flag), código + guía de infra. La base NUNCA es tenant.

**Activación (UI):** `/panel-admin` → sección Comunidades (`CommunitiesAdmin.jsx`) → "Editar" en una comunidad no-base → bloque "Subdominio propio" con el checkbox "Activar single-tenant en este subdominio" (guarda al instante vía `PUT /api/comunidades/:slug` con `{ subdomainEnabled }`; muestra la URL `<slug>.<VITE_TENANT_DOMAIN>`). Oculto para la base. El slug se muestra en cada fila de la lista.

**Slug — "todo junto" + editable a mano:** `Community.generateSlug` ahora arma el slug como el nombre todo junto, sin espacios ni símbolos (solo a-z0-9, NFD sin acentos); colisiones con número al final sin separador (`rosario`, `rosario1`). Helper `Community.normalizeSlug(str)` (extraído, reusado). El slug NO cambia al renombrar (alimenta subdominio/URLs/`data-community`), pero es **editable explícitamente** en el admin: campo "Slug (subdominio / URL)" en el editor (no-base) → `PUT /:slug` con `{ slug }` (normaliza + valida unicidad 409 + prohibido en base + invalida tenant cache). Decisión del usuario: editable a mano, no auto-regenerar al renombrar.

**Mecanismo (un solo chokepoint por lado):**
- Cliente: `client/src/utils/tenant.js#detectTenant()` parsea `window.location.hostname` vs `VITE_TENANT_DOMAIN` (reservados www/app/api; dev override `?tenant=<slug>` + `<slug>.localhost`). `main.jsx` setea el header default de axios `X-Community-Slug`.
- Server: middleware **global** `resolveTenant` (en `server/middleware/resolveCommunities.js`, montado en `app.js` antes de las rutas) → `req.tenant` vía `Community.resolveTenant(slug)` (cache TTL 60s + negativo; solo `subdomainEnabled`; base excluida; `__resetTenantCache()` en tests/setup.js y en las rutas de edición de comunidad). `resolveCommunities` cortocircuita a `viewingCommunities=[tenant]`+`skinCommunity=tenant`. Creación forzada al tenant vía `resolveCreateCommunity(user, requested, tenant)` (no-miembro → 403). Directorio `GET /api/comunidades` acotado al tenant.
- `CommunityContext`: `GET /api/comunidades/:slug`, entra en modo solo si `data.subdomainEnabled`; fuerza skin/marca/sections desde el tenant (sirve para anónimos); expone `isTenant`/`tenant`. Oculta `CommunitySwitcher`, item "Mis Comunidades" del `Sidebar`, y `CommunitySelect`.

**CORS:** `server/config/cors.js` ahora soporta `CORS_ORIGIN_SUFFIX` (ej. `.turnocero.com`) — matcheo de sufijo https compartido por Express + Socket.IO (`isAllowedOrigin` exportado). Agregado `X-Community-Slug` a `allowedHeaders` (preflight). `socketCorsOptions.origin` pasó de array a función.

**Infra (la hace el dueño):** wildcard DNS `*.turnocero.com` → Vercel + dominio wildcard; backend único `api.turnocero.com` con `CORS_ORIGIN_SUFFIX`; cliente con `VITE_TENANT_DOMAIN`. Env documentadas en `server/.env.example` + `client/.env.example`.

**Limitación conocida:** login NO se comparte entre subdominios (token en `localStorage`, por-origin). Para la vidriera read-only no bloquea; fix futuro = cookie `Domain=.turnocero.com` + SSO vía `/api/auth/me`.

**Tests:** server `tests/integration/communityTenant.test.js` (7), unit en `Community.test.js` (resolveTenant) + `cors.test.js` (suffix); client `utils/tenant.test.js` (13) + `context/CommunityContext.tenant.test.jsx` (archivo aparte que mockea `../utils/tenant` porque `TENANT_SLUG` se resuelve al cargar el módulo) + caso tenant en `CommunitySwitcher.test.jsx`. Suites: server touched-files verdes; client full 2111 verde. Nota: el full server suite tira un "Worker exited unexpectedly" flaky en Windows (víctima distinta cada corrida, sin fallo de assert) — environmental, no del cambio.
