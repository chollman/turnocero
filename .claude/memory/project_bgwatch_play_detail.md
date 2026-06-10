---
name: project_bgwatch_play_detail
description: "Detalle de partida BG Watch como página pública con ruta propia, shortlink/OG con tapa del juego y panel de stats del mismo grupo (reemplazó al PlayDetailModal)"
metadata:
  type: project
---

El detalle de partida de BG Watch es una **página pública con ruta propia** `/bg-watch/:bggUsername/partidas/:playId` ([PlayDetail.jsx](client/src/pages/bg-watch/PlayDetail.jsx), mergeada a master 2026-06-10), compartible por short link tipo `partida`. Reemplazó al `PlayDetailModal` (borrado); todos los ex-openers (BgWatchProfile, BgWatchPerGameView, JugadorDetail, UbicacionDetail) navegan a la ruta. Diseño del handoff `handoff/design_handoff_bgwatch_create` (PlayDetailScreen): hero con tapa + pills, tabla de resultados con medallas, notas serif, acento púrpura de sección.

**Endpoints (todos públicos, en routes/bgg.js):**
- `GET /api/bgg/partida/:user/:playId/detalle` — play (playToApi + **overlay aplicado**) + `game` (resolveGame, imagen alta para el hero). Fallback `findPlayOnBgg` si no hay espejo Mongo.
- `GET /api/bgg/partida/:user/:playId/og` — metadata para crawlers (tapa = `BggGame.image`), cache 30 min, **solo plays espejadas** (sin espejo → OG default del SPA; no se escanea BGG por un crawler).
- `GET /api/bgg/partida/:user/:playId/grupo` — partidas con el mismo grupo + stats, paginado.

**Why / gotchas:**
- El preload de edición `GET /partida/:user/:playId` (sin sufijo) sigue **owner-only y SIN overlay**: el form de edición escribe los valores crudos de vuelta a BGG — aplicarle la curación corrompería los nombres en BGG. La página usa `/detalle` (público, con overlay). No unificar.
- **"Mismo grupo" = roster exactamente idéntico como conjunto** (decisión del usuario; ni uno más ni uno menos). `computeGroupStats` (bggAggregations) usa la **identidad canónica del overlay**: rawKey (`u:`/`n:`) → `o:<overlayId>` si está reclamada por una fusión, así los alias cuentan como la misma persona. El route le pasa `overlayIndex` y aplica `applyOverlayToPlayers` también al `roster` devuelto (las filas tienen name/username → la misma función sirve).
- `matchedPlays` INCLUYE la partida de referencia (los totales leen mejor: "jugaron juntos N veces"); el cliente la excluye solo del listado. El panel cliente ([GroupStatsPanel.jsx](client/src/pages/bg-watch/GroupStatsPanel.jsx)) es desplegable con fetch perezoso y se resetea al cambiar de playId (navegación detalle→detalle).
- El botón de grupo solo se muestra con roster ≥ 2 (en solitario "mismo grupo" no significa nada).
- Kicker del hero: flujo **inline, no flex** — con playIds largos el flex reordenaba los items al quebrar en mobile.
- Share: `buildPartidaShare` en utils/share.js (mismo contrato que buildCompartidaShare: caption sin url). `useShortLink({ type: "partida", ref: `${lower}/${playId}`, eager: true })`.

Relacionado: [[project_short_links]] (tipo `partida`), [[feedback_og_image_card_sizing]] (tapa BGG → summary card), [[feedback_share_deeplink_once]], [[feedback_router_back_button_idx]] (el "Volver" cae a `/bg-watch/:user/partidas` sin historial).
