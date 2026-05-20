---
name: feedback-bgg-username-case
description: "User.bggUsername se guarda case-preserved, BggPlay.bggUsername se guarda lowercase. Cualquier match que cruce ambos modelos debe ser case-insensitive (collation strength 2 en Mongo)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9099d291-a3e5-40aa-9a9f-b0de83c3a6e6
---

`User.bggUsername` se persiste tal cual lo ingresa el usuario (case-preserved). `BggPlay.bggUsername` tiene `lowercase: true` en el schema, así que siempre se normaliza a minúsculas. Esto significa que **cualquier código que joinea o filtra entre los dos modelos usando bggUsername debe ser case-insensitive**.

**Why:** Bug real encontrado en Phase 4. `stampReconcileResult` y `stampProbeOutcome` hacían `User.updateOne({ bggUsername: lowercaseValue })` para stampear `bggSync` después de un reconcile. Para usuarios con bggUsername mixed-case (como `H3rmit87`), el match contra el User stored como `"H3rmit87"` fallaba silenciosamente — la `updateOne` retornaba `{ matchedCount: 0 }` sin error. Resultado: el reconcile insertaba 106 plays correctamente pero `User.bggSync` quedaba `null`, el botón "Reconciliar todo" en /perfil no mostraba el estado actualizado, y el throttle de 5 min nunca se activaba (siempre se disparaba probe). El bug pasaba todos los tests porque los tests usaban bggUsername lowercase.

**How to apply:**
- `User.updateOne({ bggUsername })` o `User.findOne({ bggUsername })` con un valor que vino del path de BGG (ej. lowercase porque pasó por `bggUsername.toLowerCase()`): SIEMPRE agregar `{ collation: { locale: 'en', strength: 2 } }` como tercer argumento. Strength 2 = case-insensitive.
- Si tenés el `User._id` disponible (porque ya lo lookuppeaste por otro lado), preferí `User.findById(id)` / `User.updateOne({ _id: id })` — no toca el problema.
- Si necesitás joinear los dos modelos (raro): `User.aggregate` con `$lookup` también acepta `collation`, o normalizá ambos en el código.
- Tests: cuando agregues una feature nueva relacionada a BGG, escribí AL MENOS UN test que use bggUsername con mayúsculas mezcladas (ej. `'MixedCase'`). El bug pasó porque toda la suite usaba lowercase. Hay un regression test en [server/tests/integration/bgg.test.js](server/tests/integration/bgg.test.js) — `stamps bggSync via the probe path regardless of bggUsername casing`.

Alternativa no aplicada: cambiar el schema de `User.bggUsername` a `lowercase: true`. No lo hicimos porque (a) requiere migración de docs existentes, (b) algunos usuarios pueden tener UI que muestra el bggUsername con el case original (no es solo un identifier interno). Mejor mantener case-preserved en User y resolver case-insensitive en queries.

Relacionado: [[feedback-bgg-sync-engine]] usa este patrón en `stampReconcileResult` y `stampProbeOutcome`.
