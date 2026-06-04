# Plan: Custom domains por comunidad (bring-your-own-domain)

> Estado: **propuesta / para más adelante**. No implementado.
> Relacionado: [community-subdomains.md](community-subdomains.md) (lo que YA existe: `<slug>.turnocero.app`).

## Objetivo

Permitir que una comunidad use su **dominio propio** (ej. `elclu.app`) en vez de
—o además de— el subdominio `elclu.turnocero.app`. El usuario entra a `elclu.app`,
ve `elclu.app` en la barra de direcciones, y la experiencia es 100% transparente:
como si TurnoCero no existiera (salvo la atribución "por TurnoCero" y las páginas
de plataforma/legales, que se mantienen a propósito).

**No es** un redirect, iframe ni masking. Es la **misma deployment** servida en
otro dominio; la app resuelve qué comunidad es a partir del **Host**. Es el patrón
estándar de multitenancy "custom domain" (Substack / Notion / Shopify).

## Punto de partida (lo que ya tenemos)

El modo tenant ya funciona por subdominio de turnocero.app:

- Cliente: `client/src/utils/tenant.js#detectTenant()` parsea `hostname` contra
  `VITE_TENANT_DOMAIN` (`.turnocero.app`) → saca el slug → lo manda en el header
  `X-Community-Slug` (default de axios en `main.jsx`).
- Server: middleware global `resolveTenant` (`server/middleware/resolveCommunities.js`)
  lee el header (o `?tenant=`) → `Community.resolveTenant(slug)` → `req.tenant`.
- `resolveCommunities` cortocircuita a `viewingCommunities=[tenant]` + skin del tenant.
- `CommunityContext` modo `isTenant` (fuerza skin/marca, oculta switcher/directorio/CommunitySelect).
- CORS por sufijo `CORS_ORIGIN_SUFFIX=.turnocero.app`. SSO fase 2 vía cookie httpOnly `Domain=.turnocero.app`.

**El gap:** todo eso asume que el slug se puede DERIVAR del hostname (`<slug>.turnocero.app`).
Un custom domain apex (`elclu.app`) no tiene ese sufijo → hay que mapear **Host → comunidad**.

## Diseño

### 1. Modelo

`Community`:

- `customDomain: { type: String, default: null, unique (partial/sparse), lowercase, trim }`
  — ej. `"elclu.app"`. Normalizar (sin protocolo, sin `www.`? decidir si `www` y apex
  se tratan como el mismo tenant — recomendado: guardar el apex y aceptar `www.` como alias).
- (opcional) `customDomainVerified: Boolean` — para un flujo de verificación de propiedad
  (TXT record) antes de activarlo, estilo Vercel/Netlify.

Índice único parcial (igual que `googleId`/`facebookId`): solo cuando es string.

### 2. Resolución por Host (server)

En `resolveTenant`:

- Si `Host` es `<slug>.<VITE_TENANT_DOMAIN>` → comportamiento actual (resolver por slug).
- Si NO matchea el sufijo conocido → tratar el Host completo como custom domain:
  `Community.resolveByCustomDomain(host)` (cacheado, igual que `resolveTenant`/`getBase`,
  con invalidación `__resetTenantCache` al editar el dominio).
- `req.tenant` se setea igual que hoy; el resto (`resolveCommunities`,
  `resolveCreateCommunity`) NO cambia — ya laburan sobre `req.tenant`.

Importante: usar el Host real (`req.hostname`), no confiar en el header `X-Community-Slug`
para custom domains (el cliente no puede derivar el slug de `elclu.app`).

### 3. Cliente

`detectTenant()` no puede sacar el slug de un hostname arbitrario. Opciones:

- **A (recomendada):** el cliente NO intenta derivar slug en custom domains; arranca
  "tenant desconocido por host" y `CommunityContext` lo resuelve con un GET
  (ej. `GET /api/comunidades/by-host?host=<hostname>` o que `/api/comunidades/resolve-tenant`
  acepte host). El server devuelve la comunidad (o null). Mantener el header opcional para
  el caso subdominio (que ya anda).
- **B:** inyectar el slug en build/runtime por dominio (no escala, descartar).

`CommunityContext` ya tiene el modo `isTenant`; solo cambia la FUENTE de cómo se entera
(host en vez de slug del subdominio). Todo lo demás (forzar skin/marca, ocultar UI cruzada) igual.

### 4. CORS

`server/config/cors.js` hoy permite `CORS_ORIGIN_SUFFIX=.turnocero.app`. Para custom domains:

- Cargar los `customDomain` activos (cacheado) y permitir `https://<customDomain>` (+ `www.`).
- O un check async contra Mongo en el `origin` callback (con cache para no pegarle por request).
- Aplica a Express CORS **y** a Socket.IO CORS.

### 5. OAuth

- **Google:** cada origin debe estar registrado explícitamente como Authorized JS origin.
  Cada custom domain nuevo → agregarlo a mano en la consola de Google (no hay wildcard).
  Documentar como paso operativo del onboarding de un custom domain.
- **Facebook:** sumar el dominio a App Domains.
- Alternativa para evitar registrar cada dominio: hacer el login SIEMPRE en
  `app.turnocero.app` (popup/redirect al dominio canónico) y volver con la sesión.
  Pero eso rompe la transparencia ("aparece turnocero"). Decisión de producto.

### 6. Login / SSO

La cookie del SSO fase 2 es `Domain=.turnocero.app` → NO abarca `elclu.app` (otro dominio
registrable). Consecuencia: en `elclu.app` el login es **aislado** (su propia cookie
first-party para ese dominio). Para single-tenant puro está bien. Se pierde el SSO cruzado
con turnocero.app / otros tenants. Documentarlo; si se quiere SSO cross-domain, es un
proyecto aparte (OIDC propio / iframe de auth, complejo).

### 7. OG / crawlers

`client/middleware.js` deriva el slug del Host de `*.turnocero.app` para inyectar OG por
comunidad. Extender para resolver custom domains (mismo `resolveByCustomDomain`), si no los
previews de links en `elclu.app` saldrían con la marca default.

### 8. Infra / DNS (operativo, por comunidad)

- **DNS apex:** `elclu.app` es raíz → A / ALIAS (no CNAME) apuntando a Vercel. Con
  Cloudflare hay vueltas (ver notas de cert en community-subdomains.md). `www.elclu.app`
  → CNAME a Vercel.
- **Vercel:** agregar `elclu.app` (+ `www`) como dominios del proyecto → provisiona el cert.
- **`.app` está en HSTS preload** (Google es dueño del TLD) → HTTPS obligatorio, sin http.
  Vercel lo cubre.
- Flujo ideal de onboarding: admin setea `customDomain` en el panel → la app muestra los
  records DNS a crear → (opcional) verificación TXT → activar.

## Decisiones abiertas

- ¿`www.elclu.app` y `elclu.app` = mismo tenant? (recomendado sí; normalizar a apex).
- ¿Verificación de propiedad del dominio antes de activar? (recomendado para evitar que
  alguien apunte un dominio a un tenant ajeno).
- ¿Coexistencia? Una comunidad podría ser accesible por `elclu.turnocero.app` **y**
  `elclu.app` a la vez (canonical + alias) o forzar uno (redirect 301 del subdominio al
  custom domain). Definir canonical para SEO (`<link rel=canonical>`).
- ¿White-label total (ocultar también "por TurnoCero")? Decisión de plan/pricing.

## Alcance / esfuerzo (estimado)

- Backend: `Community.customDomain` + `resolveByCustomDomain` + branch en `resolveTenant`
  - CORS dinámico + endpoint resolve-by-host. (chico-mediano)
- Cliente: `detectTenant`/`CommunityContext` resolviendo por host + `middleware.js` OG. (chico)
- Panel admin: input de custom domain + (opcional) UI de verificación DNS. (chico-mediano)
- Infra/docs: guía DNS + checklist OAuth por dominio. (docs)
- Tests: resolución por host (server), CORS allowlist, tenant mode por custom domain (cliente).

## Notas

- Nada de esto cambia la lógica de scoping de contenido/notifs/secciones — todo eso ya
  trabaja sobre `req.tenant` / `isTenant`, que seguimos seteando; solo cambia **cómo se
  detecta** el tenant (host arbitrario en vez de subdominio de turnocero.app).
- El subdominio `<slug>.turnocero.app` sigue funcionando como está; custom domain es aditivo.
