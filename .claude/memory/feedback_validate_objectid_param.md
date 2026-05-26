---
name: feedback-validate-objectid-param
description: "En cualquier router con :id, registrar router.param('id', validateObjectId) para devolver 400 temprano en lugar de un CastError 500 silencioso"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 34d2559e-0433-4d98-9eb2-2c0acd998365
---

Cualquier router de Express con rutas que usen `:id` o `:userId` debe registrar `router.param(...)` con el middleware [`validateObjectId`](server/middleware/validateObjectId.js) al inicio. Devuelve 400 si el param no es un ObjectId válido — antes Mongoose lo pasaba y tiraba CastError 500 (o devolvía null silencioso → 404).

**Why:** Implementado en B8 del review de Eventos (mayo 2026). Antes en `server/routes/eventos.js` y otros routers, un `GET /api/eventos/not-an-id` pegaba a `Evento.findById('not-an-id')` que tiraba CastError sin global error handler que lo tradujera, terminando en 500 silencioso o stack-trace en logs. Con el middleware, devuelve 400 sin tocar la DB.

**How to apply:**

Al tope del router file, después de los imports:

```js
const validateObjectId = require('../middleware/validateObjectId');

router.param('id', validateObjectId('id'));
router.param('userId', validateObjectId('userId'));
```

Esto se aplica automáticamente a cualquier handler con `:id` o `:userId` en la URL. NO afecta paths sin esos params (`/api/eventos/mine` no pasa por el middleware).

**Orden importa:** declarar `router.param` ANTES de las rutas que lo usan, pero por debajo de cualquier `router.use(...)` global del router (auth, section gate, etc.).

**Estado (2026-05-22, P0.2 del audit, commit `9435802`):** aplicado en **todos** los routers que exponen `:id`, `:userId`, `:matchId`, `:gameId`, `:groupId`, `:commentId`, `:imageId`, `:imgId`, `:cid` — eventos, torneos, tables, bgg, compartidas, noticias, friends, dm, users, comments, messages, ratings, images, adminChat, admin. Sub-routers montados sobre `/api/tables/:id/...` usan `router.use(...)` porque el param viene del parent mount, no del propio router.
