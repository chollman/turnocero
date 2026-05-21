---
name: feedback-put-partial-update
description: "En endpoints PUT que aceptan multipart form-data, sólo modificar campos PRESENTES en `req.body`. El patrón viejo `evento.field = req.body.field || undefined` clobereaba campos no enviados (los seteaba a undefined). Combinado con un cliente que enviaba todos los campos completos quedaba consistente; pero cualquier llamada parcial (ej. `PUT { status: 'cancelled' }`) borraba eventDate, description, location, etc."
metadata:
  node_type: memory
  type: feedback
---

**Patrón correcto** ([server/routes/eventos.js](server/routes/eventos.js) — PUT /:id):

```js
// Partial update: sólo modificar campos PRESENTES en req.body.
// El form siempre envía todo (string vacío para "clear"); calls parciales
// (cancel/reopen vía PATCH-like PUT) sólo envían `status`.
if (req.body.title !== undefined && req.body.title.trim()) {
  evento.title = req.body.title.trim();
}
if (req.body.description !== undefined)     evento.description     = req.body.description.trim()     || undefined;
if (req.body.conditions !== undefined)      evento.conditions      = req.body.conditions.trim()      || undefined;
if (req.body.fee !== undefined)             evento.fee             = parseFloat(req.body.fee) || 0;
if (req.body.transferDetails !== undefined) evento.transferDetails = req.body.transferDetails.trim() || undefined;
if (req.body.eventDate !== undefined)       evento.eventDate       = req.body.eventDate              || undefined;
if (req.body.location !== undefined)        evento.location        = req.body.location.trim()        || undefined;
if (req.body.maxParticipants !== undefined) {
  evento.maxParticipants = req.body.maxParticipants ? parseInt(req.body.maxParticipants) : undefined;
}
if (req.body.status) evento.status = req.body.status;
```

**Anti-pattern** (el bug que estaba en producción):
```js
evento.description = req.body.description?.trim() || undefined;  // ← clobber
evento.eventDate   = req.body.eventDate || undefined;            // ← clobber
```
Cuando `req.body.description` es `undefined`, esto setea el campo a `undefined` en el doc → Mongoose lo borra al save.

**Cliente complementario** ([client/src/pages/eventos/EventoForm.jsx](client/src/pages/eventos/EventoForm.jsx)): el form siempre envía todos los campos, incluyendo strings vacíos, para que "limpiar un campo" funcione (string vacío en body → trim → undefined → cleared en DB).

```js
Object.entries(form).forEach(([k, v]) => {
  fd.append(k, v == null ? '' : v);  // string vacío explícito, no skip
});
```

**Síntoma del bug original**: el botón "Cancelar evento" hacía `PUT { status: 'cancelled' }` (sólo ese campo). El server, con la lógica vieja, clobereaba eventDate/description/location/maxParticipants. El evento perdía toda su data tangible y el filtro "Cancelados" no lo mostraba bien.

**Regresión cubierta** en server tests:
- `partial update preserves untouched fields (regression: cancel was clobbering eventDate, description, etc.)`
- `full form update can still clear individual fields with empty strings`

Aplica a cualquier endpoint que mezcle "form completo" y "calls parciales" sobre el mismo recurso.
