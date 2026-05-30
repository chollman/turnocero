---
name: feedback-lazy-loading-pattern
description: Patrón estándar de lazy loading / infinite scroll para listas con muchos elementos (server pagina, cliente carga de a tandas al scrollear)
metadata:
  type: feedback
---

**Desde 2026-05-30 (commit `28e9dbc`, comentarios de Compartidas).** Toda lista que pueda crecer mucho (comentarios, mensajes, feeds, resultados, etc.) **NO se carga entera de una vez**: el server pagina y el cliente trae de a tandas a medida que se scrollea. Reutilizar este mismo patrón en futuros trabajos con muchos elementos.

**Why:** cargar cientos de docs en una sola query + pintar todo de golpe es lento y caro. Antes los comentarios de una compartida traían todo el array.

## Server
- Paginar con `parsePagination(req.query, { defaultLimit, maxLimit })` (de `server/utils/paginate.js`) → `{ page, limit, skip }`. Default razonable 10–20; cap 50.
- `Model.find(filter).sort(...).skip(skip).limit(limit)` + `Model.countDocuments(filter)` en paralelo (`Promise.all`).
- Responder **objeto** `{ items, total, page, pages: Math.ceil(total / limit) }` (no un array pelado). Ejemplo: `GET /api/compartidas/:id/comments` en `routes/compartidas.js`.

## Client
- Hook `useInfiniteScroll(onLoadMore, { enabled, root, rootMargin })` (`client/src/hooks/useInfiniteScroll.js`): devuelve un `sentinelRef` para colgar de un `<div>` al final de la lista. Dispara `onLoadMore` cuando el sentinel entra en viewport. `root` (ref de un contenedor scrolleable) = observar contra esa caja, no el viewport.
- Estado: `items`, `loading` (inicial), `loadingMore`, `page`, `pages`, `total`. `loadMore(pageNum, replace)` cloná del patrón `loadFeed` de `Compartidas.jsx`: `setItems(replace ? data.items : [...prev, ...data.items])`.
- `onLoadMore` estable con `useCallback` que guarda contra `loadingMore` y `page < pages`. Load inicial con `AbortController` ([[feedback-abort-controller-pattern]]).
- Botón visible de fallback (ej. "Ver comentarios anteriores") con el MISMO `onLoadMore` — accesible y testeable (el mock de IntersectionObserver de jsdom no dispara solo).
- Contadores derivados del **`total` del server**, no de `items.length` (la lista cargada es parcial).

## Caja scrolleable con scrollbar (opcional pero recomendado para secciones embebidas)
- Envolver la lista en un contenedor `max-height` + `overflow-y: auto` (ej. `.commentsScroll`, 400px) y pasar su ref como `root` al hook. Así el infinite scroll ocurre **dentro de la caja** y los headers/forms quedan afuera, siempre visibles.

## Orden + inserción en vivo
- Si mostrás **más nuevos primero** (sort desc): el form va ARRIBA y los items nuevos se **prependean** → la inserción en vivo nunca desordena respecto de páginas viejas no cargadas. Si es cronológico (asc), ojo con dónde insertás lo nuevo.

## Tests
- Server: page 1/2, `total`/`pages`, orden, cap del limit.
- Hook: mock propio de `IntersectionObserver` (capturando el callback) en un `*.test.jsx` (necesita JSX → no `.js`); testear que dispara `onLoadMore` al intersectar, respeta `enabled`, usa el `root`, y desconecta al desmontar.
- Componente: el botón de fallback es el gatillo testeable; verificar prepend + contador (`total`) + que no aparece el botón con una sola página.
