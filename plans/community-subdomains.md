# Subdominios single-tenant por comunidad

> Rama: `feature/community-subdomains`. Estado: **código completo + tests verdes**. Falta solo la **infra** (DNS/Vercel/env) que se hace en los paneles — ver "Instrucciones pendientes".

## Context

Comunidades es multi-tenancy **suave**: un usuario pertenece a varias comunidades, elige un subconjunto para "ver juntas" y un skin; el contenido se mezcla en un feed combinado. La marca sigue siendo "TurnoCero".

Objetivo de este cambio: darle a una comunidad un **subdominio propio** (`<slug>.turnocero.com`) de modo que, al entrar por ahí, **todo lo que se ve sea exclusivo de esa comunidad — como si las demás no existieran**.

Decisiones tomadas (del usuario):

1. **Vidriera pública**: no-miembros y anónimos ven el contenido público (read-only) + CTA para unirse.
2. **Opt-in por comunidad**: solo las que un admin marca con `subdomainEnabled`.
3. **Código + guía de infra**: implementado todo el código; la infra (DNS wildcard + dominio Vercel) la configura el dueño.
4. **Slug**: el slug es el nombre "todo junto" (sin espacios ni símbolos) y es **editable a mano** en el admin (no se autogenera al renombrar).

## Por qué fue de bajo riesgo

Hay **un único punto de decisión por lado**:

- **Server**: `resolveCommunities` ([server/middleware/resolveCommunities.js](../server/middleware/resolveCommunities.js)) fija `req.viewingCommunities` y `req.skinCommunity`. Todo el contenido scopeado filtra por `communityFilter(req)`.
- **Cliente**: `CommunityContext` ([client/src/context/CommunityContext.jsx](../client/src/context/CommunityContext.jsx)) inyecta el skin y resuelve el `effectiveViewing`.

Forzar single-tenant = sobrescribir esos valores cuando hay subdominio.

## Mecanismo

El cliente detecta el subdominio desde `window.location.hostname` y lo manda en el header `X-Community-Slug` en cada request. El server lo resuelve a una comunidad (cacheada) y fuerza el scope. Se eligió el header explícito (no parsear Host/Origin) porque el backend vive en host aparte (`VITE_API_URL`), es testeable, y funciona en dev con `?tenant=`. No es frontera de seguridad dura — los filtros de privacidad siguen aplicando.

## Qué se implementó

### Server

- **`Community` model** ([server/models/Community.js](../server/models/Community.js)): campo `subdomainEnabled` (default false, index). Static `resolveTenant(slug)` (cache TTL 60s + negativo, solo `subdomainEnabled`, base excluida) + `__resetTenantCache()`. `generateSlug` ahora arma el slug "todo junto" (a-z0-9, NFD sin acentos, colisiones con número sin separador). Helper `normalizeSlug(str)` extraído y exportado.
- **Middleware `resolveTenant`** (en resolveCommunities.js, montado **global** en [server/app.js](../server/app.js) antes de las rutas): lee `X-Community-Slug` (fallback `?tenant=`), setea `req.tenant`. No toca Mongo si no hay header.
- **`resolveCommunities`**: si `req.tenant`, cortocircuita a `viewingCommunities=[tenant]` + `skinCommunity=tenant` (anónimos, no-miembros y miembros por igual).
- **Creación de contenido**: `resolveCreateCommunity(user, requested, tenant)` ([server/services/communityService.js](../server/services/communityService.js)) fuerza el destino al tenant; un no-miembro recibe 403. Aplicado en los 6 routers de create (tables, compartidas, eventos, torneos, noticias, mathtrade).
- **Directorio**: `GET /api/comunidades` se acota al tenant si hay `req.tenant`.
- **Slug editable**: `PUT /api/comunidades/:slug` acepta `{ slug }` (normaliza + valida unicidad 409 + prohibido en base + invalida tenant cache) y `{ subdomainEnabled }` (toggle, no-base).
- **CORS** ([server/config/cors.js](../server/config/cors.js)): nuevo `CORS_ORIGIN_SUFFIX` (ej. `.turnocero.com`) → matcheo de sufijo https compartido por Express + Socket.IO (`isAllowedOrigin` exportado). `X-Community-Slug` agregado a `allowedHeaders`. `socketCorsOptions.origin` pasó de array a función.

### Cliente

- **`client/src/utils/tenant.js`** `detectTenant()`: parsea hostname vs `VITE_TENANT_DOMAIN`; reservados `www`/`app`/`api`/`turnocero`; override dev `?tenant=<slug>` + `<slug>.localhost`.
- **`main.jsx`**: setea el header default de axios `X-Community-Slug` si hay tenant.
- **`CommunityContext`**: `GET /api/comunidades/:slug`, entra en modo tenant solo si `data.subdomainEnabled`; fuerza skin/marca/sections desde el tenant (sirve para anónimos); expone `isTenant`/`tenant`; `effectiveViewing=[tenant]`.
- **UI cruzada oculta en modo tenant**: `CommunitySwitcher` (null), item "Mis Comunidades" del `Sidebar`, `CommunitySelect` ("Publicar en").
- **Admin** ([client/src/pages/admin/CommunitiesAdmin.jsx](../client/src/pages/admin/CommunitiesAdmin.jsx)): bloque "Subdominio propio" (checkbox `subdomainEnabled` + URL resultante), campo "Slug (subdominio / URL)" editable (no-base), y el slug se muestra en cada fila.

## Instrucciones pendientes (las hace el dueño en los paneles)

1. **DNS**: wildcard `*.turnocero.com` → Vercel (CNAME), además de apex/`www`.
2. **Vercel**: agregar el dominio wildcard `*.turnocero.com` al proyecto del frontend (sirve el mismo build SPA para todos los subdominios; los rewrites de [client/vercel.json](../client/vercel.json) ya mandan todo a `/index.html`).
3. **Backend** (host único `api.turnocero.com`): setear env `CORS_ORIGIN_SUFFIX=.turnocero.com` (+ mantener `CORS_ORIGIN` con apex/www).
4. **Client env**: `VITE_TENANT_DOMAIN=turnocero.com`. `VITE_API_URL` queda igual.
5. **Activar una comunidad**: `/panel-admin` → Comunidades → Editar → "Activar single-tenant en este subdominio" (o `subdomainEnabled: true` en Mongo). Publicarla en `<slug>.turnocero.com`.

## Deploy productivo (2026-06-04) — lecciones del primer subdominio

> Dominio real: **`turnocero.app`** (no `.com`, que era placeholder). Primer tenant: `elclu.turnocero.app` (comunidad "El Clu"). Mergeado a master.

- **DNS (Cloudflare):** CNAME `*` → `cname.vercel-dns.com` en **"DNS only"** (gris). El warning de "expone IP origen" es inofensivo (el target es Vercel, anycast público).
- **Cert — subdominio PUNTUAL en Vercel, NO wildcard.** Un cert wildcard requiere desafío DNS-01, que Vercel solo automatiza si controla los nameservers; pero el DNS está en Cloudflare (y mover NS rompería el email de Resend + el `api` de Render). **Solución:** agregar cada `<slug>.turnocero.app` como dominio puntual en Vercel → valida por HTTP-01 vía el CNAME `*`, emite cert en minutos, sin tocar NS. Síntoma del wildcard mal configurado: `Invalid Configuration` + TLS handshake fallido (`SSL_ERROR_SYSCALL`).
- **Env productivas:** Render `CORS_ORIGIN_SUFFIX=.turnocero.app` (+ `CORS_ORIGIN` con apex/www); Vercel `VITE_TENANT_DOMAIN=turnocero.app` (build-time → requiere redeploy).
- **OAuth:** Google NO acepta wildcards en _Authorized JS origins_ → agregar `https://<slug>.turnocero.app` por cada subdominio. Facebook sí cubre subdominios con el App Domain `turnocero.app` (una vez). FB Privacy/Data-Deletion URLs → `https://turnocero.app/privacidad`.
- **Marca tenant:** login (`Auth.jsx`) + guest nav (`GuestSidebar.jsx`, `GuestNavbar.jsx`) muestran logo/nombre de la comunidad en modo tenant (commit 5558297). Borrado `AuthLogo.jsx` muerto (ce518f9).

**Checklist por comunidad nueva:** (1) dominio puntual `<slug>.turnocero.app` en Vercel; (2) origin `https://<slug>.turnocero.app` en Google. DNS + backend ya lo cubren.

## Cómo probar en dev (sin DNS)

- `npm run dev` (Mongo + back :4000 + front :3000).
- Crear/seedear una comunidad y marcarla `subdomainEnabled`.
- Abrir `http://localhost:3000/?tenant=<slug>` → verificar: solo contenido de esa comunidad (mesas/compartidas/etc.), skin aplicado, selector de comunidades oculto, "Publicar en" fijo. Repetir sin login (vidriera pública).
- Alternativa: `http://<slug>.localhost:3000`.

## Limitaciones conocidas / próximos pasos

- **Login NO se comparte entre subdominios**: el token vive en `localStorage`, que es por-origin → un miembro logueado en `turnocero.com` aparece deslogueado en `patagonia.turnocero.com`. Para la vidriera read-only no bloquea. **Fix futuro (fase 2)**: cookie de auth con `Domain=.turnocero.com` + SSO vía `/api/auth/me`.
- **OG/crawlers por subdominio**: [client/middleware.js](../client/middleware.js) podría derivar el slug del `Host` para branding correcto en previews — opcional, no incluido.
- Cambiar el slug de una comunidad existente rompe links/bookmarks viejos y el subdominio anterior (por eso es acción deliberada del admin, no automática al renombrar).

## Verificación (tests)

- **Server**: `tests/integration/communityTenant.test.js` (scoping por header, vidriera anónima, slug no-habilitado/desconocido ignorado, no-miembro create 403, directorio acotado); `tests/integration/comunidades.test.js` (edición de slug: normaliza/resuelve, duplicado 409, base inmutable, renombrar no cambia el slug); unit `Community.test.js` (resolveTenant + slug todo-junto) + `config/cors.test.js` (suffix matcher). Tenant cache reseteado entre tests en `tests/setup.js`.
- **Cliente**: `utils/tenant.test.js` (detección); `context/CommunityContext.tenant.test.jsx` (modo tenant fuerza skin + isTenant; no entra si falta subdomainEnabled); caso tenant en `CommunitySwitcher.test.jsx`; slug + toggle en `CommunitiesAdmin.test.jsx`.
- **Estado**: suites de los archivos tocados verdes; client full 2111 verde. Nota: el full server suite tira un `Worker exited unexpectedly` flaky en Windows (víctima distinta cada corrida, sin fallo de assert) — ambiental, no del cambio.
