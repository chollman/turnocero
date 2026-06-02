---
name: feedback-mongo-latest-tiebreak
description: "Elegir 'el último' en una aggregation de Mongo ($sort + $first / top-N) SIEMPRE desempata por _id, o el orden es indefinido con timestamps empatados"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8bcb51b4-2015-4bb3-9e66-48df60228e3a
---

Cuando una aggregation de Mongo elige "el más reciente" con `$sort` + `$first` (o un top-N), **el sort tiene que desempatar por `_id`**, no solo por `createdAt`/timestamp.

**Por qué:** inserts en ráfaga pueden compartir `createdAt` al milisegundo. Con la clave de sort empatada, Mongo rompe el empate en **orden indefinido** → `$first` devuelve a veces el doc viejo. Es un bug **no determinístico** que aparece como test flaky (típicamente bajo carga, donde los inserts caen en el mismo ms). El `_id` de ObjectId es **monótono por inserción**, así que `_id: -1` garantiza que gane el insertado último = el realmente más reciente.

**Patrón:**

```js
{ $sort: { createdAt: -1, _id: -1 } }   // no solo { createdAt: -1 }
```

Si después agrupás y volvés a ordenar por un campo anidado, desempatá igual: `{ "lastMessage.createdAt": -1, "lastMessage._id": -1 }`.

**Caso real:** la lista de conversaciones de DM (`server/routes/dm.js`, `GET /api/dm`) devolvía el mensaje viejo como "último mensaje" cuando dos mensajes empataban en `createdAt`. Fix = agregar `_id` a ambos sorts de la pipeline. Detectado como falla flaky de `tests/integration/dm.test.js` (`'hi 1'` en vez de `'hi 2'`) en la corrida completa bajo carga.

**Ojo con los tests de regresión de esto:** no se puede forzar el branch malo de forma determinística (el bug ES el orden indefinido; mongodb-memory-server casualmente suele romper el empate en orden de `_id`, así que un test de empate forzado pasa con y sin el fix). El test sirve como documentación del contrato, no como "falla antes".
