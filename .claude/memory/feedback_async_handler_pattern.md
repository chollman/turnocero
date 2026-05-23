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

Cuando lo toques por otro motivo. No es un objetivo en sí mismo — la migración es gradual. Si vas a tocar un handler de un router viejo, aprovechá y migrá todo el router (es más limpio que dejar la mitad migrada).

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
