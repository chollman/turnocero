# asyncHandler + errorHandler pattern (tech-debt-audit P1.6)

**Desde:** 2026-05-22 — commit `a85eeb5` introdujo la infra y migró 2 routers de muestra (`noticias.js`, `friends.js`). El resto de los routers (auth, bgg, tables, torneos, eventos, compartidas, dm, etc.) sigue con el patrón viejo de `try/catch` repetido — migración incremental.

## Las 3 piezas

- **`server/utils/asyncHandler.js`** — `asyncHandler(fn)` envuelve un handler async y captura promise rejections, pasándolos a `next(err)`. Eliminó la necesidad del try/catch externo.
- **`server/utils/httpError.js`** — `httpError(status, message)` crea un `Error` con `.status` adherido. Para throws intencionales del business logic.
- **`server/middleware/errorHandler.js`** — middleware terminal montado al final de `app.js`. Respeta `err.status`/`err.statusCode`, mapea `CastError`/`ValidationError` a 400, default 500. Solo expone `err.message` en 4xx; en 5xx devuelve "Error interno del servidor" + loguea con stack via `logger.error` (no info-leak).

## Patrón de migración

ANTES:
```js
router.get('/:id', async (req, res) => {
  try {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'No encontrado' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener' });
  }
});
```

DESPUÉS:
```js
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw httpError(404, 'No encontrado');
    res.json(doc);
  }),
);
```

## Cuándo migrar un router

**Cierre 2026-05-22: todos los routers ya están migrados.** Si tocás un router viejo y ves un `try/catch` con `res.status(500).json({ message })` genérico, es bug — migralo en el momento.

Si agregás un router nuevo, usá el patrón desde el día 1.

## Estado final (commits 41887ca → cierre ronda 3)

**Migrados:** `noticias.js`, `friends.js`, `compartidas.js`, `dm.js`, `siteConfig.js`, `notifications.js`, `adminChat.js`, `geocode.js`, `users.js`, `admin.js`, `ratings.js`, `images.js`, `messages.js`, `comments.js`, `auth.js`, `tables.js`, `eventos.js`, `torneos.js`, `bgg.js` — los **19 routers** de la app.

## Patrones especiales que mantienen try/catch interno

No todos los handlers se migran al patrón puro `throw httpError(...)`. Algunos preservan try/catch interno por razones específicas:

- **OG endpoints** (`compartidas/:id/og`, `eventos/:id/og`, `bgg/og/:bggUsername`): los crawlers esperan body vacío `{}` en 404/500, no `{ message }`. El try/catch interno usa `res.status(NNN).json({})`.
- **Respuestas anti-leak** (`auth/resend-verification`, `auth/forgot-password`): siempre 200 con generic message para no exponer si el email está registrado. El catch va a generic response, no a 500.
- **Cooldowns con headers** (`bgg/coleccion/:bggUsername`, `bgg/partidas/:bggUsername`): 429 con `X-Refresh-Cooldown-Ms` header + `retryAfterMs` en body — `res.status(429).json()` directo en vez de throw.
- **Códigos especiales** (`auth/login`, `auth/verify-email`): respuestas como `{ code: 'banned' | 'email_not_verified', ... }` van directo con `res.status(403).json()` — no son errores semánticos sino control flow.
- **Errores con extras** (`torneos/:id/next-phase`): cuando el response necesita campos extra además de `message` (ej. `suggestions`), `res.status(400).json()` directo.
- **Mongoose ValidationError → 400 con mensaje específico**: cada router con `create()` / `save()` define un helper `rethrowValidation(err)` que detecta `err.name === 'ValidationError'` o `err.code === 11000` y los re-tira como `httpError(400, primerMensaje)`. Sin esto el errorHandler los dejaría como 500 "Error interno del servidor".

## Gotcha 5xx explícitos

Cuando hacés `throw httpError(502, "Error de BGG: REQUEST_DENIED")` querés que ese mensaje SE EXPONGA al cliente, no que el errorHandler lo enmascare como "Error interno del servidor". El flag `err.isExplicit` (que setea `httpError`) le dice al errorHandler que el caller construyó el mensaje deliberadamente para user-facing.

Si re-tirás un error catched de un service (`throw e` o `e.status === 404`) sin envolverlo en `httpError`, ese error NO tiene `isExplicit` → el errorHandler lo enmascara. Para preservar el mensaje, envolvé: `throw httpError(e.status || 500, e.message)`.

## Gotcha: sync throws

El asyncHandler actual hace `Promise.resolve(fn()).catch(next)`. Si `fn()` es una función no-async y tira **sincrónicamente**, el throw escapa de `Promise.resolve` y NO se captura. Esto está documentado en `tests/unit/utils/asyncHandler.test.js`.

En la práctica todos nuestros handlers son async (lo cual convierte sync throws en promise rejections), así que el contrato actual alcanza. Si en algún momento querés un wrapper más defensivo:

```js
function asyncHandler(fn) {
  return (req, res, next) => {
    try { return Promise.resolve(fn(req, res, next)).catch(next); }
    catch (e) { return next(e); }
  };
}
```

## Convención: 4xx vs 5xx

- **4xx intencional**: `throw httpError(400, 'ID inválido')` — el `.message` viaja al cliente como `{ message }`.
- **5xx unexpected**: cualquier throw sin `.status` (bug, DB caído, lib que falló) → 500 + "Error interno del servidor" + log con stack server-side. **No leakear `err.message` al cliente** en 5xx — podría tener secrets/internals.
