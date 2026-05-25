---
name: feedback-cron-idempotency-flag
description: "Crons que emiten \"una vez por evento\" deben usar un flag en el doc (xxxSentAt) en vez de ventanas estrechas — sobreviven atrasos del cron"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 34d2559e-0433-4d98-9eb2-2c0acd998365
---

Crons que disparan "una vez por evento" (recordatorios, sweeps de cierre, etc.) deben usar un flag persistente en el doc (`xxxSentAt: Date`) en vez de depender de una ventana temporal estrecha. Si el cron se atrasa, la ventana se pierde y el evento nunca recibe trigger.

**Why:** Implementado en B5 del review de Eventos (mayo 2026). Antes `eventoReminders` filtraba por `eventDate ∈ [now+23h, now+25h]`. Si el cron se atrasaba >1h (deploy, container restart, contención DB), eventos que caían en ese hueco se saltaban silenciosamente. El usuario inscripto esperaba el recordatorio y nunca llegaba.

**How to apply:**

1. En el schema del doc, agregar `xxxSentAt: { type: Date, default: null }`.
2. En el cron, ampliar la ventana a `[now, now + maxLookahead]` y filtrar `$or: [{ xxxSentAt: null }, { xxxSentAt: { $exists: false } }]`.
3. Después de procesar, setear `doc.xxxSentAt = now` y guardar — aún si no había nada para notificar (sirve como "checked" marker).
4. `saveNotification` u operación equivalente debe ser idempotente vía upsert para complementar el flag.

Ejemplo del cron de reminders (24h):

```js
const eventos = await Evento.find({
  eventDate: { $gte: now, $lte: new Date(now.getTime() + 25 * HOUR_MS) },
  status: { $in: ['open', 'closed'] },
  $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }],
});
for (const evento of eventos) {
  // ... notify ...
  evento.reminderSentAt = now;
  await evento.save();
}
```

**Múltiples ventanas en el mismo doc:** si el cron dispara 2 reminders distintos (24h y 2h en F6 de Eventos), usar flags separados (`reminderSentAt` + `reminder2hSentAt`). Cada ventana se marca por separado.

Aplicar a cualquier futuro cron con semántica "una vez por X" — bgg-watch sync, retención de notifs, cleanup de assets, etc.
