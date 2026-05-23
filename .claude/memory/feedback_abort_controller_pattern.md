---
name: feedback-abort-controller-pattern
description: "AbortController obligatorio en useEffect que hace axios.get con setState — evita stale-data races entre detalle pages"
metadata:
  node_type: memory
  type: feedback
---

**Desde:** 2026-05-23 — la auditoría React encontró 12 páginas que hacían `useEffect(() => { axios.get(...).then(setX) }, [id])` sin cancelación. Cuando el user navega rápido entre dos detalles (ctrl-click en lista, cambio de tab, filtro de UsersList con debounced search), el GET de la página anterior podía resolver DESPUÉS del nuevo id mount, pisando datos correctos con stale.

**Why:** axios sigue completando el request aunque el componente desmonte. `then(setX)` ejecuta sin warning sobre componente desmontado en React 18, y el último setState gana — que puede ser el viejo.

**How to apply:**

Patrón obligatorio para todo `useEffect` que hace `axios.get(...)` + `setState`:

```js
useEffect(() => {
  const ac = new AbortController();
  axios.get(URL, { signal: ac.signal })
    .then(({ data }) => { if (!ac.signal.aborted) setX(data); })
    .catch((err) => {
      if (axios.isCancel(err)) return;
      // real error handling
    })
    .finally(() => { if (!ac.signal.aborted) setLoading(false); });
  return () => ac.abort();
}, [deps]);
```

**Variantes**:

- **Multi-fetch en useCallback** (`TorneoDetail.loadAll`, `Torneos.load`, `UsersList.fetchUsers`): el callback toma `signal` opcional como último param, el useEffect crea el AbortController y lo pasa. Las llamadas imperativas (refresh, page-load-more) no pasan signal — `signal?.aborted` da falsy y la lógica de cancelación es no-op para ellas.
- **Debounced search** (`CreatePlayModal`): el cleanup hace `clearTimeout(timerRef.current); ac.abort();` — cancela timer pendiente Y request in-flight.

**Convención de detección**: usar `axios.isCancel(err)` para detectar cancelación. NO usar `err.code === 'ERR_CANCELED'` o `err.name === 'CanceledError'` — `axios.isCancel` cubre ambos y es el contrato público.

**Archivos migrados** (commit `9f669b6`):
- `TableDetail.jsx`, `EditTable.jsx`
- `TorneoDetail.jsx`, `EditTorneo.jsx`, `Torneos.jsx`
- `CompartidaPost.jsx`, `CompartidasSidebar.jsx`
- `NoticiaDetail.jsx`
- `UserProfilePublic.jsx`, `UsersList.jsx`
- `MeFeed.jsx` (ambos useEffects)
- `CreatePlayModal.jsx` (debounced BGG search)

**Antecedente**: el patrón viejo era `let cancelled = false; ... if (cancelled) return; ... return () => { cancelled = true; }` (P3.3 del tech-debt audit). AbortController es estrictamente mejor: también aborta el HTTP request server-side (no solo el setState), y axios v1 ya soporta `signal` nativo. CreateTable.jsx fue la referencia inicial (`abortRef.current`).
