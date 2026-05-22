---
name: feedback-bgg-image-over-thumbnail
description: 'Para renders de juegos BGG donde la imagen ocupa >150px de ancho, usar `image` (high-res) en vez de `thumbnail` (200×150). Ambos campos están en BggGame, BggCollection y Evento.ludoteca; el server siempre persistió los dos, faltaba consumirlos del lado cliente.'
metadata:
  type: feedback
---

**Regla**: en cualquier render de juego BGG donde la imagen se muestre a más de ~150px de ancho, usar el campo `image` con fallback a `thumbnail`:

```jsx
<img src={game.image || game.thumbnail} />
```

**Why**: `thumbnail` de BGG es 200×150 (`fit-in/200x150/filters:strip_icc()`) — al renderizarse a 200px+ queda pixelado en pantallas retina y a 300px+ es un desastre. `image` es el original (típicamente 500–3500px). El navegador downscalea con calidad muy superior a la imagen estirada.

**Dónde están los datos**:

- `BggGame` ([server/models/BggGame.js](server/models/BggGame.js)): `thumbnail` + `image`, ambos persistidos por `resolveGame()` del XML API2 `/thing`.
- `BggCollection` ([server/models/BggCollection.js](server/models/BggCollection.js)): `games[].thumbnail` + `games[].image`, parseado del `/collection` XML (que sí trae ambos).
- `Evento.ludoteca[]` ([server/models/Evento.js](server/models/Evento.js)): `thumbnail` + `image` hidratados de `resolveGame()` al crear el item.
- `/api/bgg/search`: ahora también enriquece `image` (no antes) via `resolveGamesBatch`.

**Cuándo NO usar `image`**: lists con thumbs chicos (<100px) — dropdown del `BggGameSearch`, autocomplete inline, etc. Ahí el ancho de bytes extra del `image` no se justifica. Mantener `thumbnail`.

**How to apply** al agregar render BGG nuevo:

1. Si el card/preview muestra el juego a tamaño normal (≥150px ancho) → `image || thumbnail`.
2. Si propagás el juego al `onPick`/`onSelect` de un picker, pasá **ambos** campos (`thumbnail` y `image`) para que el consumer elija según contexto.
3. Si agregás un endpoint nuevo que devuelva juegos BGG, hidratá `image` también, no solo `thumbnail`.

Ya aplicado en (2026-05-22): EventoLudoteca card, EventoLudotecaPicker (grid + preview), ColeccionPanel.GameCard, BggGameSearch (propagación al onPick), /api/bgg/search response.

Relacionado: [[feedback-bgg-cache-pattern]] (capas memoria→Mongo→BGG aplican igual para ambos campos — `resolveGame*` ya guarda los dos).
