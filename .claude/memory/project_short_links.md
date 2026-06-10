---
name: project_short_links
description: "Short links /s/:code para deeplinks compartibles — endpoint genérico get-or-create, swap transparente en los botones de compartir"
metadata: 
  node_type: memory
  type: project
  originSessionId: 68ddbc94-22f3-41c5-994b-4d616294fd5a
---

Capa de short links sobre el mismo dominio (`<origin>/s/<code>`) para los deeplinks que se comparten por redes. **En master** (2026-06-10). Decisiones tomadas con el usuario: alcance = TODOS los compartibles (Compartidas, Eventos, Noticias, perfiles BG Watch; partidas BG Watch sumadas después); mismo dominio `/s/:code` (cero infra); aplicación **automática y transparente**.

**Por qué endpoint genérico get-or-create (no un campo por modelo):** trata todos los tipos igual, incluidos los de BG Watch que **no tienen documento propio** (perfil = bggUsername; una partida puede vivir solo en BGG). Creación perezosa, dedup por índice unique `{type, ref}`, sin migración.

**Tipos:** `compartida` / `evento` / `noticia` (ref = ObjectId), `bgwatch` (ref = bggUsername) y `partida` (2026-06-10, ref **compuesto** `"<bggUsername>/<playId>"` → `/bg-watch/<user>/partidas/<playId>`; assertShareable valida solo formato `/^[^/]+\/\d+$/`). Gotcha del router: la validación de tipo hace `pathFor(type, "x/1")` — el ref de prueba tiene que satisfacer también los formatos compuestos; y el check de ObjectId usa la allowlist `NON_OBJECTID_TYPES` (bgwatch, partida).

**Backend:**
- `server/models/ShortLink.js` — `code` (base62×7, unique) + unique `{type, ref}` (dedup) + static `generateCode()` retry-on-collision (espeja `Community.generateSlug`). NO usa `communityScoped` (puntero global; la visibilidad la gobierna el recurso).
- `server/services/shortlinkService.js` — `pathFor(type,ref)` / `getOrCreate` (valida que el recurso EXISTE y es público: Compartida `privacy==='public'`, Evento status open/closed, Noticia existe, bgwatch solo formato) / `resolve(code)` (`$inc clicks`).
- `server/routes/shortlinks.js` — `POST /` (**optionalAuth** — los anónimos comparten contenido público + rate-limit por IP) y `GET /:code`. Montado en `app.js`.
- `server/routes/noticias.js` — nuevo `GET /:id/og` (espejo del de compartidas) para que el preview de short links a noticia funcione en crawlers.

**Cliente:**
- `utils/shortlink.js` `getShortUrl/getShortPath` — `Map` cache por `type:ref` + dedupe in-flight; **NUNCA tira** (contrato: null ante cualquier error; el `Promise.resolve().then(()=>axios.post(...))` atrapa hasta throws síncronos). Caller cae al deeplink largo.
- Hook `hooks/useShortLink.js` → `{ shortUrl, prime }`. **Detalle** (un recurso): `eager:true` (resuelve en mount). **Feed cards** (N recursos): perezoso, `prime` enganchado a `onPointerEnter/onPointerDown/onFocusCapture` del `.shareGroup` para NO mintear un código por tarjeta.
- `utils/share.js` `buildCompartidaShare(post, origin, overrideUrl)` — overrideUrl = short link ya resuelto.
- Call-sites: CompartidaCard, ResenaCard, NoticiaDetail (eager), EventoDetail.handleShare, CreatePlay.runShare, PlayDetail (eager, tipo `partida` — ver [[project_bgwatch_play_detail]]). El perfil BG Watch no tiene botón de compartir (el backend igual soporta `bgwatch`).
- `pages/shortlink/ShortLinkRedirect.jsx` + ruta pública `/s/:code` en `App.jsx` (cubre dev — Vite no corre el middleware — y fallback).

**Middleware previews (`client/middleware.js`):** matcher suma `/s/:code*` + `/noticias/:id*`. `/s/:code` actúa para humanos también: resuelve vía `GET /api/shortlinks/:code` → **humano 302 al canónico, crawler sirve OG** del recurso (despacha por tipo a handleCompartida/Evento/Noticia/BgWatch; reusan `url.origin` → preservan subdominio). Nuevo `handleNoticia`.

**Verificado en browser (stack real):** POST anónimo → 201 + dedup mismo code; `GET /:code` resuelve; unknown→404; `/s/<code>` redirige al canónico; botones WhatsApp/Telegram hacen swap transparente al short link en interacción. Tests: nuevos server (24) + suite client completa verde; los 4 tests existentes con asserts de share se actualizaron al short link.

**Gotcha de testing (browser/jsdom):** React mapea `onPointerEnter` desde el evento **burbujeante `pointerover`**, NO desde `pointerenter` (no burbujea). Para disparar el `prime` desde un eval hay que dispatchar `pointerover`/`pointerdown` con `bubbles:true`, no `pointerenter`.

Relacionado: [[feedback_share_deeplink_once]] (buildCompartidaShare: deeplink una vez), [[project_community_subdomains]] (origin preserva subdominio), [[feedback_public_page_protected_calls]] (optionalAuth para anónimos), [[feedback_service_layer]], [[feedback_async_handler_pattern]], [[feedback_api_endpoints_pattern]].
