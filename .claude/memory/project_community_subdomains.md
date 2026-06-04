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

**Infra (la hace el dueño):** wildcard DNS `*.turnocero.app` → Vercel + dominio en Vercel; backend único `api.turnocero.app` (Render) con `CORS_ORIGIN_SUFFIX=.turnocero.app`; cliente con `VITE_TENANT_DOMAIN=turnocero.app`. Env documentadas en `server/.env.example` + `client/.env.example`. **El dominio real es `.app`** — el `.com` en plan/env.example es solo placeholder.

**Deploy productivo (2026-06-04, mergeado a master).** Lecciones del primer subdominio (`elclu.turnocero.app`, comunidad "El Clu"):
- **DNS en Cloudflare:** CNAME `*` → `cname.vercel-dns.com` en **"DNS only"** (gris, NO proxied). El warning de Cloudflare ("expone la IP origen") es inofensivo: el target es Vercel (anycast, público por diseño), no un server propio.
- **Cert: subdominio PUNTUAL en Vercel, NO wildcard.** Un cert wildcard (`*.turnocero.app`) requiere desafío **DNS-01**, que Vercel solo puede automatizar si controla los nameservers — pero el DNS lo maneja Cloudflare (y mover NS a Vercel rompería el email de Resend `send.*` + el CNAME `api` de Render). Solución: NO usar dominio wildcard en Vercel; agregar cada `<slug>.turnocero.app` como **dominio puntual** (valida por **HTTP-01** vía el CNAME `*` ya existente, emite cert en minutos, sin tocar NS ni TXT). Síntoma del wildcard mal: `Invalid Configuration` + Vercel insistiendo con cambiar nameservers; el subdominio falla el TLS handshake (`SSL_ERROR_SYSCALL`, curl `000`).
- **OAuth por subdominio:** **Google** NO acepta wildcards en *Authorized JavaScript origins* → hay que agregar `https://<slug>.turnocero.app` explícito por cada subdominio (sino "Continuar con Google" tira `origin_mismatch`). **Facebook** sí matchea subdominios: con el **App Domain** `turnocero.app` quedan cubiertos todos los `*.turnocero.app` (una sola vez). Privacy Policy URL + Data Deletion Instructions URL de la app FB → `https://turnocero.app/privacidad` (la sección 5 "Conservación y baja" cubre la eliminación de datos).

**Checklist al activar `subdomainEnabled` en una comunidad nueva:** (1) agregar `<slug>.turnocero.app` como dominio puntual en **Vercel**; (2) agregar `https://<slug>.turnocero.app` a **Google** Authorized JS origins. DNS (CNAME `*`) y backend (`resolveTenant`) ya lo cubren solos — no hay que tocar nada más.

**Marca tenant en login + guest nav (commit 5558297, 2026-06-04):** `Auth.jsx` (login/registro), `GuestSidebar.jsx` y `GuestNavbar.jsx` consumen `useCommunity()` → `{ isTenant, brand }` y muestran logo+nombre+tagline de la comunidad en modo tenant (igual que el `Sidebar` autenticado ya hacía). Fallback al nombre de la comunidad si el skin no definió `brandName`; default TurnoCero fuera de tenant. Se borró `AuthLogo.jsx` (código muerto del rediseño de auth, sin imports, CSS path roto — commit ce518f9).

**Limitación conocida:** login NO se comparte entre subdominios (token en `localStorage`, por-origin). Para la vidriera read-only no bloquea; **fase 2 (pendiente)** = cookie `Domain=.turnocero.app` + SSO vía `/api/auth/me` — resolvería también el tener que registrar cada subdominio en Google (todo el OAuth viviría en el apex).

**Tests:** server `tests/integration/communityTenant.test.js` (7), unit en `Community.test.js` (resolveTenant) + `cors.test.js` (suffix); client `utils/tenant.test.js` (13) + `context/CommunityContext.tenant.test.jsx` (archivo aparte que mockea `../utils/tenant` porque `TENANT_SLUG` se resuelve al cargar el módulo) + caso tenant en `CommunitySwitcher.test.jsx`. Suites: server touched-files verdes; client full 2111 verde. Nota: el full server suite tira un "Worker exited unexpectedly" flaky en Windows (víctima distinta cada corrida, sin fallo de assert) — environmental, no del cambio.
