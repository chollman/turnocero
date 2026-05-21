---
name: feedback-optimistic-vs-socket
description: "Cuando un handler hace `await axios.X(...)` y aplica un optimistic update numérico (`prev.count + 1`, `Math.max(0, prev.count - 1)`) sobre un valor que el server también emite por socket al room del actor, se duplica: el socket gana la carrera contra la respuesta HTTP y el optimistic suma encima del valor autoritativo. Eliminar el optimistic numérico y dejar que el socket sea la fuente única; mantener optimistic solo para campos asignados (no incrementados) como `userRegistration: data` o flags booleanos."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3b5a2af8-4a2a-4de0-ae92-64476c5c9ea5
---

**Bug que disparó esta regla**: en `EventoDetail.jsx` el `handleInscribirse` hacía:

```js
await axios.post(`/api/eventos/${id}/inscribirse`, fd, ...);
setEvento(prev => ({
  ...prev,
  userRegistration: userReg,
  registrationCount: {
    total:   (prev.registrationCount?.total   || 0) + 1,
    pending: (prev.registrationCount?.pending || 0) + 1,
  },
}));
```

Y el socket listener separado hacía:

```js
socket.on("evento:counts-changed", (payload) => {
  setEvento((prev) => ({ ...prev, registrationCount: payload.counts }));
});
```

El server emite `evento:counts-changed` ANTES del `res.json()`. WebSocket es más rápido que el roundtrip HTTP, así que el socket gana y replace counts con el valor autoritativo (ya incluye el +1). Después la promise de axios resuelve y el optimistic suma OTRO +1 encima → cuenta de a 2. Síntoma: usuario se inscribe, cupo salta de "2 de 20" a "4 de 20" en vez de "3 de 20".

**Fix aplicado**: remover el optimistic de `registrationCount`. Mantener solo `userRegistration: userReg` (asignación, no incremento — idempotente con el reemplazo del socket).

**Why**: el patrón "optimistic numérico + socket que reemplaza" parece seguro porque socket reemplaza, no suma. Pero la race-window invertida (socket primero, optimistic después) suma el optimistic sobre el valor ya autoritativo. No es teórico — pasa consistentemente porque el server siempre emite ANTES de responder.

**How to apply** — chequear en handlers que:

1. Hacen `await axios.post/put/delete/patch(...)`.
2. Aplican un optimistic con `prev.X + 1`, `prev.X - 1`, `(prev.X || 0) + 1`, `Math.max(0, prev.X - 1)` sobre un valor numérico.
3. **Y** existe un `socket.on(...)` en el mismo componente/contexto que reasigna ese mismo campo con un valor autoritativo del server (e.g. `payload.counts`, `payload.X`).
4. **Y** el cliente está en un room (`evento:<id>`, `table:<id>`, `eventos:list`) al que el server emite ese broadcast — es decir, recibe su propio broadcast.

Si las 4 se cumplen → es bug, eliminar el optimistic numérico. Si solo agarra 3 (e.g., el server NO broadcastea al actor, o el optimistic es un ARRAY con dedup por `_id`), generalmente está OK.

**Auditoría confirmó que no se repite** (2026-05-21):

- `TableDetail.sendMessage`/`handleAddComment`: arrays con dedup por `_id` en el listener (`prev.some(m => m._id === data._id) ? prev : [...prev, data]`) → safe.
- ~~`Eventos.handleCreate`: prepend optimistic + `evento:created` broadcast, pero el listener tiene `prev.some(e => e._id) → prev` → safe.~~ **CORREGIDO 2026-05-21**: la auditoría se equivocó. El listener dedupea, pero `handleCreate` por sí solo NO. Cuando el socket llega primero (caso típico en localhost), el evento se agrega via socket, luego `handleCreate` agrega de nuevo SIN chequear → duplicado. Fix: agregar el mismo `prev.some(e => e._id === data._id) ? prev : [data, ...prev]` también en `handleCreate`. **Regla**: el dedup tiene que vivir en AMBOS lados de la race (socket listener Y optimistic handler), no solo uno.
- `CompartidaCard.handleLike`: el socket `compartida:like` solo notifica al autor, no toca el like count → safe.
- `NotificationContext` y `ChatContext` cuentan en el RECIPIENT (que no hace HTTP), sin race posible.

**Distinción con [[feedback-derived-counts]]**:

- Si el cliente tiene el ARRAY (e.g., `data.registrations`) local: derivar counts con `useMemo` → single source of truth = el array. Aplica en `EventoInscripciones.jsx` donde el admin tiene la lista completa de inscripciones.
- Si el cliente solo tiene el COUNTER agregado (sin el array): no se puede derivar; remover el optimistic numérico y dejar que el socket sea la única fuente. Aplica en `EventoDetail.jsx` donde el server devuelve `registrationCount` y `confirmedRegistrations` pero NO toda la lista de inscripciones.

Las dos memorias atacan el mismo síntoma (doble-conteo) desde lados distintos según los datos disponibles en el cliente.

Relacionado también: [[feedback-socket-handler-race]] cubre la race server-side de registración de listeners en `io.on('connection')`. Esta regla es del lado cliente.
