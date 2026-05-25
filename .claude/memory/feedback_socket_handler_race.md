---
name: feedback-socket-handler-race
description: "Todos los `socket.on(...)` en `io.on('connection')` deben registrarse ANTES de cualquier `await`. Si la auth/lookup es async y los handlers vienen después, los emits del cliente durante `connect` (`socket.emit('join:room')`) llegan antes que el handler exista y se descartan silenciosamente — el socket queda fuera del room."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 92c9193d-d562-4786-a099-944475d22163
---

[server/server.js](server/server.js): la estructura correcta del connection handler es:

```js
io.on('connection', async (socket) => {
  // 1) Joins síncronos al user-room (auto).
  socket.join(`user:${socket.userId}`);

  // 2) Registrar TODOS los `socket.on(...)` ANTES de cualquier await.
  socket.on('join:table',  (id) => socket.join(`table:${id}`));
  socket.on('leave:table', (id) => socket.leave(`table:${id}`));
  socket.on('join:evento', (id) => socket.join(`evento:${id}`));
  socket.on('leave:evento',(id) => socket.leave(`evento:${id}`));
  socket.on('join:eventos-list',  () => socket.join('eventos:list'));
  socket.on('leave:eventos-list', () => socket.leave('eventos:list'));

  // 3) Recién acá los awaits para side-effects (admin room, etc.).
  try {
    const user = await User.findById(socket.userId).select('isAdmin');
    if (user?.isAdmin) socket.join('admin:room');
  } catch { /* non-fatal */ }
});
```

**El bug que evita esto**: el evento `connect` de socket.io-client se dispara apenas engine.io abre el transport, **antes** de que el server termine de ejecutar el cuerpo async de `io.on('connection')`. Si el cliente hace `socket.on('connect', () => socket.emit('join:evento', id))` y el server tiene los handlers de `join:evento` registrados DESPUÉS de un `await User.findById(...)`, el emit gana la carrera y socket.io lo descarta porque no hay listener todavía. El socket queda fuera del room → emits posteriores del server no le llegan → la UI no se actualiza en vivo.

**Síntoma observado**: el listado de eventos (`/eventos`) no actualizaba el counter "X/40 inscriptos" ni el cupos bar al confirmar/rechazar inscripciones aunque los emits del server estaban OK y la lógica del listener del cliente también. Probado: el primer socket creado no recibía nada; un `socket.emit('join:eventos-list')` manual diferido sí funcionaba.

**Workarounds que NO usar** (los probé y son band-aids):
- `setTimeout(() => socket.emit('join:room'), 50)` en el cliente — frágil, depende del timing.
- `socket.join('room')` automático server-side dentro del connection handler — acopla "estar autenticado" a "ser suscriptor del room", waste de bandwidth para usuarios no interesados, no escala con más broadcasts.

**La regla general**: el cuerpo de `io.on('connection', ...)` debe ser síncrono en su sección de registración de handlers. Cualquier `await` queda al final, sólo para side-effects que no bloquean el room subscription.

Relacionado: el skill `socket-cleanup-audit` cubre el lado cliente (cleanup de listeners en useEffect). Esta regla es complementaria del lado server.
