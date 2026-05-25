---
name: feedback-cron-lease
description: "Every cron job that mutates data is wrapped in `withLease(name, fn)` from `server/utils/cronLease.js` so multi-instance deploys don't double-fire"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 92c9193d-d562-4786-a099-944475d22163
---

# Cron lease distribuido (tech-debt P4.6)

**Desde:** 2026-05-22 — todo cron job que muta data va envuelto en `withLease(name, fn)` desde `server/utils/cronLease.js`.

## El problema

`node-cron` corre por proceso. En deploys rolling, restarts con overlap, o blue/green, hay momentos donde hay >1 instancia del server up. Sin coordinación, ambas disparan el mismo cron al mismo tiempo:

- 2× emisión de notificaciones de evento_reminder → un user recibe la misma notif duplicada
- 2× cierre de eventos → conflictos al guardar
- 2× re-fetch a BGG → rate limit del provider

La memoria previa [[feedback-cron-idempotency-flag]] decía: usá un flag en el doc (`reminderSentAt`) + ventana amplia. Eso ayuda PERO no es suficiente: dos workers que arrancan en el mismo tick leen el doc con `reminderSentAt: null`, ambos disparan, ambos hacen `ev.save()`. El doc termina con un solo `reminderSentAt`, pero ya se enviaron 2 notificaciones.

## La solución

`withLease(name, fn, { leaseMs? })` agarra un Mongo doc (`CronLease` con TTL index) ANTES de correr el job. Si otra instancia ya tiene el lease activo, devuelve `{ acquired: false }` y el caller skip.

```js
const { withLease } = require("../utils/cronLease");

cron.schedule("0 * * * *", async () => {
  const outcome = await withLease("myJob", async () => myJob.runOnce());
  if (!outcome.acquired) return; // otra instancia tiene el lease
  if (outcome.value.didWork) logger.info("[myJob] done", outcome.value);
});
```

Tres garantías:

1. **Atomic acquire** vía `findOneAndUpdate` con `$or: [expiresAt <= now, !exists]`.
2. **TTL safety net** — si el proceso muere mid-job, el doc se borra solo a los ~60s post-expiresAt (granularidad TTL de Mongo).
3. **Cleanup explícito** — al terminar (success o throw) `withLease` borra el doc para liberar el próximo tick rápido. El TTL solo cubre el caso del proceso que cae.

## Cuándo aplicarlo

- **Cron jobs que mutan data o disparan side effects externos** (notificaciones, emails, calls a third-party APIs): SÍ.
- **Cron jobs read-only** (métricas, healthchecks que no escriben): NO necesitan lease.

## Estado actual

Aplicado en `server/jobs/scheduler.js`:

- `eventoReminders` (hourly)
- `closePastEventos` (daily)

Si agregás un cron job nuevo en `scheduler.js`, envolvelo en `withLease` desde el momento — el patrón en el file existe como template.
