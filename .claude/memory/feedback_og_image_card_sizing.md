---
name: feedback-og-image-card-sizing
description: "OG previews — Cloudinary images go large-card; BGG/square images go summary-card (can't crop)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3f07e6ca-6eb0-43f9-bee7-80b87961cc1f
---

`client/middleware.js` (Vercel edge fn) genera OG previews para crawlers por tipo de recurso (`handleCompartida/Evento/Noticia/BgWatch/Mesa/Partida/TenantRoot`), cada uno con su endpoint `GET /api/<x>/:id/og` (público, body vacío en 404 — defensivo, no info-leak). Mesas se sumaron 2026-06-09: `/mesas/:id` → imagen del juego (`bggImage` alta-res, fallback `bggThumbnail`) vía `GET /api/tables/:id/og`, solo mesas públicas no canceladas. Partidas BG Watch se sumaron 2026-06-10: `/bg-watch/:user/partidas/:playId` → tapa del juego (`BggGame.image`) vía `GET /api/bgg/partida/:user/:playId/og` (solo plays espejadas en Mongo — sin espejo cae al OG default; no se escanea BGG por un crawler) + shortlink type `partida` (ref `<user>/<playId>`).

**Regla del tamaño de card (lo no-obvio):**

- Imágenes **en Cloudinary** (compartidas/eventos/noticias) → recortables a 1200×630 con `.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto/")` → `summary_large_image` (`imageIsLarge: true`).
- Imágenes de **BGG** (mesas, BG Watch) → ≈cuadradas y NO están en Cloudinary, así que NO se pueden transformar → `summary` (card chica, `imageIsLarge: false`). Sin imagen, ambas caen al `og-default.png` 1200×630 (large).

**Why:** poner una imagen cuadrada en un slot 1.91:1 la deja con bandas/recorte feo; y el transform de Cloudinary no aplica a URLs de `cf.geekdo-images.com`.

**How to apply:** al agregar un handler OG nuevo, decidí el `imageIsLarge` por origen de la imagen, no por gusto: Cloudinary→large, externa/cuadrada→summary. Espejá `handleBgWatch`/`handleMesa`. Hereda la marca de comunidad en subdominios tenant (ver [[project_community_subdomains]]). Cada handler nuevo trae sus tests (server integration + `client/src/middleware.test.js`). Distinto de [[feedback_share_deeplink_once]] (caption de compartir) y [[project_short_links]] (`/s/:code`, que aún NO soporta mesas).

## WhatsApp no renderiza imágenes pesadas — forzar `f_jpg,q_auto` (2026-06-16)

Bug real: una noticia compartida en WhatsApp mostraba `og-default` aunque el server servía la portada. Causa: la portada era un **PNG de ~1.3 MB** (collage 1200×630) y **WhatsApp no renderiza imágenes pesadas (ni WebP)**. El transform `w_1200,h_630,c_fill,g_auto` **mantiene el formato original** (PNG queda PNG). Fix: agregar **`f_jpg,q_auto`** al transform → JPEG comprimido (~216 KB):

```
.replace("/upload/", "/upload/w_1200,h_630,c_fill,g_auto,f_jpg,q_auto/")
```

Aplicado en `handleNoticia` (middleware) + `ogImage()` de NoticiaDetail. **NO uses `f_auto`** (puede servir WebP, que WhatsApp no toma) — usá `f_jpg`. Compartidas zafaba porque sus fotos ya son JPG chicas; las portadas de noticias suelen ser PNG. Considerá `f_jpg,q_auto` para los demás handlers Cloudinary.

## Gotcha: el endpoint OG está detrás de `requireSection` → sección apagada = card default

`GET /api/<x>/:id/og` está bajo `router.use(requireSection("<x>"))` (noticias/compartidas/eventos consistentes). Si la sección está **deshabilitada** en el SiteConfig, el crawler (sin auth) recibe **403** → `handleX` hace `if (!apiRes.ok) return null` → el middleware cae al SPA → WhatsApp ve el `og-default.png` del index.html. Un **admin** comparte igual (bypassea SectionGate) pero el preview público se rompe. Fix práctico: **activar la sección en `/panel-admin`**. (Mejora opcional: sacar el OG endpoint del `requireSection`, su comentario dice "public for crawlers".)

## WhatsApp cachea el preview → re-scrapear

Aunque el server sirva bien, WhatsApp/Facebook **cachean** el preview viejo por URL. Forzar refresco: Facebook Sharing Debugger (`developers.facebook.com/tools/debug/`) → pegar la URL → **"Scrape Again"**. Alternativa: compartir una URL distinta (canónica vs short `/s/`). Se vence solo (~7 días). Verificar qué sirve el server: `curl -A "WhatsApp/2.23" -L <url> | grep og:image`.
