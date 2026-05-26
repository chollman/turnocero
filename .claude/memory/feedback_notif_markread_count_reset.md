# Server markRead debe resetear `count: 0` además de `read: true`

**Desde 2026-05-26** — bug encontrado en producción donde el badge mostraba "4" al
recibir UNA notif nueva.

## El bug

[`server/routes/notifications.js`](../../server/routes/notifications.js)
`PATCH /api/notifications/read` solo seteaba `read: true`:

```js
// ❌ ANTES — desincronización con el cliente
await Notification.updateMany(filter, { $set: { read: true } });
```

El cliente (ver `markReadByPredicate` en `notificationReducers.js`) sí reseteaba
local: `{ read: true, count: 0 }`. Pero el server NO. Resultado:

1. Usuario recibe 3 comments → DB: `count=3, read=false` ✓
2. Usuario abre la compartida → `setActiveCompartida` → cliente local count=0 ✓,
   server PATCH /read → DB queda `count=3, read=true` ❌
3. Nuevo comment → `saveNotification` hace `$inc: count + $set: read=false` →
   DB: `count=4, read=false`
4. Server emite payload con `count: 4` (post-2026-05-22 contract: server source-of-truth)
5. Cliente SETea (no incrementa) `count = 4` → badge "4" con UNA notif nueva 🐛

## El fix

```js
// ✅ AHORA
await Notification.updateMany(filter, { $set: { read: true, count: 0 } });
```

Con eso, el próximo `$inc` arranca de 0 → 1 limpio.

## Por qué no se detectó antes

- El cliente reseteaba locally, así que en una sesión normal el counter se veía
  bien (cliente=0, server=stale).
- El bug aparece al recibir un NUEVO evento después del markRead (cuando el server
  hace $inc desde el count stale).
- También aparece en reloads inmediatamente después del markRead si el cliente
  todavía no había sincronizado el reset.

## Regla a recordar

Cliente y server tienen que tener LA MISMA representación de cada notif. Si el
cliente local trata count como "eventos desde el último markRead", el server tiene
que también — sino el `$inc` se infla entre sesiones/eventos.

Cualquier nuevo endpoint que cambie estado de notifs (mark-as-read, dismiss, etc.)
tiene que escribir `count: 0` también si va a tocar `read: true`.

## Regression test

`server/tests/integration/notifications.test.js` — test "resets count: 0 when
marking read (otherwise next $inc inflates the badge)".

## Bonus — bug pre-existente del test setup

Al correr este test descubrí que `server/tests/setup.js` rompía cuando
`userRateLimit.js` empezó a usar `const { rateLimit, ipKeyGenerator } = require(...)`
(destructuring). El `require.cache` override solo provee `default` y el módulo
entero como función — no las exports nombradas. Fix:

```js
// tests/setup.js
noopFactory.rateLimit = noopFactory;
noopFactory.ipKeyGenerator = (req) => req.ip || "test-ip";
```

Cualquier cambio futuro a la import en `middleware/userRateLimit.js` que rompa el
cache debe arreglarse acá también.
