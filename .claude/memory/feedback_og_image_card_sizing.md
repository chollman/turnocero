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
