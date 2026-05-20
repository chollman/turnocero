---
name: feedback-user-lock-semantics
description: "withUserLock dedupea por key (mismo usuario), no por work function. Dos operaciones distintas sobre el mismo usuario NO corren ambas — la segunda recibe el resultado de la primera. Sequenciar en el caller, no esperar que el lock distinga."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9099d291-a3e5-40aa-9a9f-b0de83c3a6e6
---

`withUserLock(key, fn)` en [server/utils/bggSync.js](server/utils/bggSync.js) es un mutex per-key, pero su mecánica de "dedupe" merece cuidado: si una promesa está en vuelo para esa key, **todas las nuevas llamadas reciben la misma promesa, sin importar qué `fn` pasen**.

```js
const p1 = withUserLock('alice', () => probe('alice'))         // dispara probe
const p2 = withUserLock('alice', () => reconcileFull('alice')) // ← NO corre reconcile
// p1 === p2, ambos resuelven al resultado del probe
```

**Why:** Eso es exactamente lo que queremos cuando dos requests del MISMO trabajo entran simultáneamente (p.ej. dos pestañas abren /bg-watch a la vez y disparan probes — solo uno corre, el otro reusa el resultado). Pero es un footgun cuando el caller mezcla trabajos distintos. Si en el GET /api/bgg/partidas hubiéramos hecho `triggerBackgroundProbe()` Y `triggerBackgroundReconcile()` cuando ambos están "due" para el mismo usuario, una race podría hacer que el reconcile recibiera el resultado del probe (outcome inconsistente) o viceversa.

**How to apply:**
- Diseña triggers MUTUAMENTE EXCLUSIVOS en el caller. En `GET /api/bgg/partidas/:user` decidimos *antes* del trigger: si `lastFullSyncAt > 30d` disparamos reconcile, si no probe — nunca los dos.
- Si necesitás trabajos distintos sobre el mismo usuario en sucesión, secuencialos con `await`. No los dispares en paralelo y confíes en el lock para serializar — el segundo no va a esperar al primero, va a copiar el resultado del primero y volver inmediato.
- El lock libera on settle (resolve O reject). No hay TTL — si el work cuelga, el lock cuelga. Eso es deliberado: un TTL podría liberar el lock mientras el work sigue corriendo y crear writes solapados. Mejor que el work tenga su propio timeout (los `fetchBgg` lo tienen vía `fetch`).
- `fn` se invoca **sincrónicamente** dentro de `withUserLock`. Side-effects sincrónicos (asignaciones de variables, `vi.fn()` counters, logs) ocurren antes de que el `await` regrese — testealo con `expect(fn).toHaveBeenCalledTimes(1)` sin `await` previo. Los tests existentes lo cubren en [server/tests/unit/utils/bggSync.test.js](server/tests/unit/utils/bggSync.test.js).

Anti-pattern detectado y evitado: usar `withUserLock` como cola implícita de tareas distintas. No lo es. Si querés una cola de trabajos heterogéneos por usuario, usá una estructura aparte (Map<key, Array<task>> con un drain serial). Para Phase 4 no lo necesitamos — el route handler decide qué hacer y dispara UN trigger.

Relacionado: [[feedback-bgg-sync-engine]] aplica esta regla — los triggers de probe vs reconcile son mutuamente exclusivos a nivel route handler.
