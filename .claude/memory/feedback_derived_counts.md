---
name: feedback-derived-counts
description: "Si la UI tiene un array y counts derivables del array (pendientes/confirmadas/rechazadas), derivar con useMemo en vez de mantener counts en state. Optimistic updates + listeners de socket que mutan ambos suelen duplicar el conteo. Single source of truth: el array."
metadata:
  node_type: memory
  type: feedback
---

**Bug pattern**: el state tiene `{ registrations: [...], counts: { pending, confirmed, rejected } }`. Una acción del usuario hace un optimistic update aritmético sobre `counts` (`counts.confirmed + 1`). Más tarde, el listener de socket recibe `evento:registration-reviewed` y también suma a `counts`. Resultado: double-count.

Pasó concretamente en [EventoInscripciones.jsx](client/src/pages/eventos/EventoInscripciones.jsx):
1. Admin clickea "Confirmar" → handler optimista hace `counts.confirmed + 1, counts.pending - 1`.
2. Server emite `evento:registration-reviewed` al room `evento:<id>`.
3. El admin también está en ese room (porque `EventoInscripciones` hace `join:evento`).
4. Listener de socket recibe el payload y agrega de nuevo a counts.

Resultado: pendientes y confirmadas terminaban descuadradas vs las columnas reales.

**Fix idiomático**: derivar counts con `useMemo` sobre el array:

```js
const counts = useMemo(() => {
  const regs = data?.registrations || [];
  return {
    total:     regs.length,
    pending:   regs.filter(r => r.status === 'pending').length,
    confirmed: regs.filter(r => r.status === 'confirmed').length,
    rejected:  regs.filter(r => r.status === 'rejected').length,
  };
}, [data]);
```

Después, eliminar:
- `counts: { ... aritmética }` de cada handler optimista.
- `counts: payload.counts || prev.counts` de cada listener de socket.

El array es la única fuente de verdad. El optimistic update toca el array, el socket también toca el array (idempotente: si el listener mete una update equivalente, el resultado es el mismo). Los counts siempre coinciden con los items renderizados.

**Cuándo aplicar**:
- Cualquier UI con triage/columnas (tareas, kanban, inscripciones, requests).
- Cualquier counter que sea estrictamente derivable del array que ya tenés en state.
- Cuando hay tanto optimistic update como confirmación server (REST + socket, REST + polling).

**Cuándo NO aplicar**:
- Si el counter cuenta cosas que NO están en el array local (ej. total global del backend, contador histórico).
- Si el array tiene paginación y el counter debe reflejar el total no paginado — en ese caso el counter viene del server y no se deriva.

Para esos casos, mantener counts en state pero **escribirlos sólo desde el response del server** (no optimistic, no aritmética local).
