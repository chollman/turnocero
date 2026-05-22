# Reporte arquitectónico — Sección Eventos

## Contexto

Revisión arquitectónica de la sección de Eventos de Turnocero como segunda iteración tras el rediseño de mayo 2026 (ver `feedback_eventos_section_design.md`). El objetivo es enumerar bugs, inconsistencias y oportunidades de mejora encontradas en los flujos completos (servidor, cliente, sockets, notificaciones, tests, integración cross-feature). Este documento es un reporte; no contiene cambios de código y la priorización sirve para decidir qué atacar en futuras tareas.

Material auditado:
- **Servidor**: [`server/models/Evento.js`](server/models/Evento.js), [`server/routes/eventos.js`](server/routes/eventos.js), [`server/jobs/eventoReminders.js`](server/jobs/eventoReminders.js), [`server/jobs/scheduler.js`](server/jobs/scheduler.js), [`server/server.js`](server/server.js), [`server/models/Notification.js`](server/models/Notification.js), [`server/utils/saveNotification.js`](server/utils/saveNotification.js).
- **Cliente**: 21 componentes + 13 tests + 1 utils en [`client/src/pages/eventos/`](client/src/pages/eventos/); rutas en [`client/src/App.jsx`](client/src/App.jsx); contextos relacionados ([`NotificationContext`](client/src/context/NotificationContext.jsx), [`ToastContainer`](client/src/components/layout/ToastContainer.jsx)); navegación ([`Sidebar`](client/src/components/layout/Sidebar.jsx), [`BottomNav`](client/src/components/layout/BottomNav.jsx)).

---

## Resumen ejecutivo

La sección está **arquitectónicamente sólida**: state management limpio, socket cleanup correcto, race conditions de inscripción resueltas atómicamente con `findOneAndUpdate`, lazy migration de `location`, leak prevention de drafts en broadcasts, idempotencia garantizada en el cron de recordatorios.

Sin embargo hay **dos bugs reales con impacto en UX y seguridad-por-defecto**, varias **inconsistencias con convenciones del proyecto** (especialmente vs. `TorneoDetail`/Mesas), **deuda técnica acumulada** (tickers duplicados, badge mappings copiados x3, hardcoded colors), y algunas **brechas de cobertura de tests**.

Totales: **9 bugs/correcciones**, **8 inconsistencias arquitectónicas**, **10 mejoras de deuda técnica**, **6 oportunidades de feature**, **5 huecos de tests**.

---

## 🔴 BUGS CRÍTICOS (prioridad alta)

### B1 — `EventoDetail` no marca notificaciones como leídas al entrar al detalle
**Ubicación**: [`client/src/pages/eventos/EventoDetail.jsx`](client/src/pages/eventos/EventoDetail.jsx) (todo el componente — falta el `useEffect`)

**Síntoma**: cuando el usuario abre `/eventos/:id` después de recibir una notificación tipo `evento_confirmed`/`evento_rejected`/`evento_cancelled`/`evento_updated`/`evento_reminder`, el badge de notificaciones sigue mostrando esa notif como no-leída. Toasts del mismo evento se siguen mostrando aunque el usuario esté viendo el detalle.

**Causa**: el componente nunca importa `useNotifications` ni llama a `setActiveEvento(id)`. `NotificationContext` expone ese setter ([`NotificationContext.jsx:487-489`](client/src/context/NotificationContext.jsx)) específicamente para este caso de uso, igual que `setActiveTable`/`setActiveTorneo` que sí están enchufados en `TableDetail`/`TorneoDetail`.

**Fix**: agregar al inicio del componente:
```jsx
const { setActiveEvento } = useNotifications();
useEffect(() => {
  setActiveEvento(id);
  return () => setActiveEvento(null);
}, [id, setActiveEvento]);
```

**Impacto**: alto — afecta UX de la feature de notificaciones recién agregada.

---

### B2 — `/eventos/:id/inscripciones` no usa `<AdminRoute>` en la definición de la ruta
**Ubicación**: [`client/src/App.jsx:150`](client/src/App.jsx)

**Síntoma**: la ruta solo se envuelve en `<PrivateRoute><SectionGate section="eventos">`. La protección de admin queda solo en el `if (!user?.isAdmin) return <Navigate to="/" />` dentro de `EventoInscripciones`. Si un usuario no-admin entra a la URL directa, el componente se monta, dispara su `useEffect` de fetch contra `GET /api/eventos/:id/inscripciones`, recibe un 403 del backend, y recién entonces redirige.

**Comparación**: `/base-de-datos` ([App.jsx:139](client/src/App.jsx)), `/panel-admin` ([App.jsx:140](client/src/App.jsx)) y `/mensajes-admin` ([App.jsx:159](client/src/App.jsx)) sí usan `<AdminRoute>`.

**Fix**: envolver en `<AdminRoute>` y usar `isActuallyAdmin` (no `user.isAdmin`) — esta es una página estructural admin que debe seguir reachable aún con "view as user" activo (ver `feedback_admin_view_as_user.md`):
```jsx
<Route path="/eventos/:id/inscripciones"
  element={<AdminRoute><SectionGate section="eventos"><EventoInscripciones /></SectionGate></AdminRoute>} />
```

Y dentro de [`EventoInscripciones.jsx:34`](client/src/pages/eventos/EventoInscripciones.jsx) cambiar el guard imperativo por `isActuallyAdmin`.

**Impacto**: medio — la protección server-side ya bloquea, pero la URL es accesible a usuarios no-admin que ven el spinner antes del redirect. Es declarativamente incorrecto y rompe el patrón del resto del proyecto.

---

### B3 — Comprobantes huérfanos en Cloudinary cuando admin rechaza con `permanent: true`
**Ubicación**: [`server/routes/eventos.js`](server/routes/eventos.js) (PATCH `/:id/inscripciones/:userId/rechazar`)

**Síntoma**: cuando un admin rechaza una inscripción con `permanent: true`, el comprobante (imagen o PDF) NO se borra de Cloudinary. El usuario queda bloqueado para reintentar (403 en POST `/inscribirse`), así que tampoco se ejecuta el path que limpia el comprobante viejo (líneas 727-746). El archivo queda como huérfano permanente.

**Fix**: en el handler de rechazar, si `permanent === true`, llamar a `cloudinary.uploader.destroy(reg.comprobante.publicId, { resource_type: reg.comprobante.resourceType })` después de marcar el rechazo, en un best-effort try/catch.

**Impacto**: bajo en magnitud (Cloudinary tier free aguanta), pero rompe la consistencia del cleanup que sí se hace en DELETE evento y en reciclado de rechazo no-permanente.

---

### B4 — Race entre fetch HTTP y conexión del socket en `EventoDetail`
**Ubicación**: [`client/src/pages/eventos/EventoDetail.jsx:53-171`](client/src/pages/eventos/EventoDetail.jsx)

**Síntoma**: el `useEffect` que conecta el socket depende de `evento?._id` (l.171), pero el socket recién se crea DESPUÉS del fetch HTTP exitoso (l.53-71). Si en la ventana entre fetch start y socket connect ocurre un `evento:counts-changed` (otro usuario se inscribe, admin confirma), el cliente no lo recibe. Los counts pueden quedar 1 atrás hasta el próximo evento socket.

**Fix razonable**: o bien (a) conectar el socket en paralelo con el fetch (no esperar `evento?._id`, usar `id` directo), o (b) re-emitir el fetch al recibir cualquier socket event para reconciliar. Opción (a) es mucho más simple.

Adicionalmente: este componente abre una **conexión Socket.IO propia** (línea 81-84) en vez de reutilizar la del `NotificationContext`. Cada navegación a un detalle crea/destruye un socket. Considerar exponer el `socket` desde `NotificationContext` y solo emitir `join:evento` / `leave:evento` desde el detalle (mismo patrón que ya se usa para `user:<id>` room).

**Impacto**: bajo en frecuencia (la ventana es ~ms), pero el síntoma "counts inconsistentes" puede aparecer en testing y confundir.

---

### B5 — `evento_reminder` puede perder eventos si el cron se atrasa más de 1h
**Ubicación**: [`server/jobs/eventoReminders.js`](server/jobs/eventoReminders.js) — ventana [now+23h, now+25h]

**Síntoma**: el cron corre cada hora (`0 * * * *`). Si una corrida se demora >1h (deploy, contención DB, restart de container), un evento cuya ventana de 24h cae en ese hueco no recibe reminder, porque al próximo tick ya no está en la ventana [+23h, +25h].

**Fix**: cambiar de "evento dentro de ventana" a "evento dentro de ventana **AND** no tuvo reminder enviado todavía". Hay dos formas:
- (a) agregar `reminderSentAt: Date` al `eventoSchema`; el cron filtra `reminderSentAt: { $exists: false }` y lo seta al notificar (consistente, sobrevive deploys). Tirar test de regresión.
- (b) confiar en la idempotencia del `saveNotification` upsert (que ya garantiza una notif por `(recipient, type, eventoId)`) y ampliar la ventana a `[now+0h, now+25h]` filtrando los que ya tienen notif registrada. Más invasivo, menos eficiente.

Recomiendo (a).

**Impacto**: bajo en frecuencia esperada (el job es liviano y rara vez se atrasa), pero el silencio es invisible — los inscriptos confirmed esperan el recordatorio.

---

### B6 — `EventoDetail` mantiene state local `actionError` y muestra inline en vez de toast
**Ubicación**: [`EventoDetail.jsx:43, 502-504`](client/src/pages/eventos/EventoDetail.jsx), [`EventoInscripciones.jsx:19`](client/src/pages/eventos/EventoInscripciones.jsx), [`TicketStub.jsx:62-78`](client/src/pages/eventos/TicketStub.jsx)

**Síntoma**: errores de PUT/POST/DELETE se renderizan como `<p className={styles.actionError}>{actionError}</p>` sin auto-dismiss, sin centralización, y no aparecen como toast global. El resto del proyecto usa toasts del `NotificationContext` con auto-dismiss para errores transitorios.

**Fix**: reemplazar `actionError` state por `addToast({ tone: 'error', message: ... })` o equivalente desde el context. Mantener inline solo para validation errors persistentes del form (ej. "title is required" mientras escribís).

**Impacto**: medio en UX consistency.

---

### B7 — `EventoDetail` lanza `throw err` después de setear `actionError` — double error path
**Ubicación**: [`EventoDetail.jsx:199-207`](client/src/pages/eventos/EventoDetail.jsx) (handleInscribirse) y [`EventoDetail.jsx:255-263`](client/src/pages/eventos/EventoDetail.jsx) (handleSaveEdit)

**Síntoma**: el handler hace `setActionError(msg)` y luego `throw err`. El caller (`TicketStub`/`EventoForm`) atrapa el throw y muestra su propio error. Resultado: dos lugares mostrando el mismo mensaje. `handleCancelRegistration` (l.221-227) NO hace throw — inconsistente.

**Fix**: decidir un único contrato (recomiendo no-throw + return de éxito/error, o solo throw sin setear local). Documentar en la convención.

**Impacto**: bajo, pero confuso para mantenimiento.

---

### B8 — Validación de ObjectId ausente en endpoints `:id`
**Ubicación**: múltiples handlers en [`server/routes/eventos.js`](server/routes/eventos.js): GET `/:id`, PUT `/:id`, DELETE `/:id`, POST `/:id/inscribirse`, PATCH `/:id/inscripciones/:userId/*`

**Síntoma**: `req.params.id` se pasa directo a `Evento.findById()`. Si llega un string que no parsea como ObjectId, Mongoose lanza `CastError` (status 500 sin un global error handler que lo traduzca) o devuelve null (404). No hay 400 explícito.

**Fix**: validar con `mongoose.Types.ObjectId.isValid(req.params.id)` early y devolver 400 si falla. Idealmente un middleware compartido para todas las rutas con `:id`.

**Impacto**: bajo (404 también es razonable), pero ensucia logs y oculta bugs de parsing en el cliente.

---

### B9 — `permanent` flag coerciona string `'true'` en rechazar, pero ningún otro endpoint hace eso
**Ubicación**: [`server/routes/eventos.js:1055-1056`](server/routes/eventos.js)

**Síntoma**: `reg.permanentlyRejected = req.body.permanent === true || req.body.permanent === 'true'`. Esto es defensivo contra clients que mandan strings, pero ningún otro endpoint del proyecto lo hace. Pequeña inconsistencia.

**Fix**: confiar en JSON proper desde el cliente; usar solo `req.body.permanent === true`. Si llega string en pruebas manuales (curl), que el cliente lo arregle.

**Impacto**: muy bajo. Cosmético.

---

## 🟠 INCONSISTENCIAS ARQUITECTÓNICAS

### I1 — Falta supresión de toasts para el evento activo (sí existe para mesas)
**Ubicación**: [`NotificationContext.jsx:359-389`](client/src/context/NotificationContext.jsx)

**Síntoma**: para `chat:notification` (mesas), el context chequea `activeTableRef.current === notif.tableId` y suprime el toast. Para `evento:notification` no hay equivalente. Si el usuario está viendo `/eventos/X` y le confirman su inscripción a X, recibe toast Y notif persistente. Solo se quiere la notif (no el toast).

**Fix**: agregar `activeEventoRef` (paralelo a `activeTableRef`) y chequear en el handler de `evento:notification`. Esto se desbloquea naturalmente cuando se haga el fix B1 (que ya setea `activeEvento`).

---

### I2 — Tres componentes mantienen su propio `now` ticker
**Ubicación**: [`Eventos.jsx:71-74`](client/src/pages/eventos/Eventos.jsx), [`EventoDetail.jsx:47-51`](client/src/pages/eventos/EventoDetail.jsx), [`EventoInscripciones.jsx:24-27`](client/src/pages/eventos/EventoInscripciones.jsx)

**Síntoma**: cada uno hace `setInterval(() => setNow(Date.now()), 30000)` con cleanup. Lógica copiada 3 veces.

**Fix**: extraer a `useTickingNow(intervalMs = 30000)` en `client/src/utils/hooks/` con su test. Tres líneas en cada caller en vez de 5+cleanup.

---

### I3 — Status badge mapping duplicado en tres componentes
**Ubicación**: [`PosterCard.jsx`](client/src/pages/eventos/PosterCard.jsx), [`TimelineRow.jsx`](client/src/pages/eventos/TimelineRow.jsx), [`InscItem.jsx`](client/src/pages/eventos/InscItem.jsx)

**Síntoma**: cada componente define su propio `STATUS_BADGES` / `STATUS_OPTIONS` para `open`/`closed`/`cancelled`/`draft` etc. Tres copias que se pueden desincronizar.

**Fix**: extraer a `client/src/utils/eventoStatus.js` con `getEventoStatusBadge(status)` retornando `{ label, tone, icon }`. Test único.

---

### I4 — `ComprobanteDropzone` e `ImageDropzone` casi idénticos
**Ubicación**: [`ComprobanteDropzone.jsx`](client/src/pages/eventos/ComprobanteDropzone.jsx) (81 líneas), [`ImageDropzone.jsx`](client/src/pages/eventos/ImageDropzone.jsx) (62 líneas)

**Síntoma**: la lógica de drag/drop, file picker, preview y validación es la misma; difieren en accept (`image/*` vs `image/*,application/pdf`) y label.

**Fix**: consolidar en `<FileDropzone accept={...} preview={...} maxSize={...} />` en `client/src/components/shared/`. Si hay diferencias estéticas grandes, mantener wrappers thin.

---

### I5 — Hardcoded colors que rompen el light theme
**Ubicación**:
- [`InscItem.module.css:165`](client/src/pages/eventos/InscItem.module.css) — `#001712`, `#1aef9a`
- [`PosterCard.module.css:60`](client/src/pages/eventos/PosterCard.module.css) — `#16203a`
- [`EventoDetail.module.css:68-142`](client/src/pages/eventos/EventoDetail.module.css) — drop-shadow rgb específicos (efectos visuales)

**Síntoma**: estos colores no respetan `data-theme="light"`. Tipos shadows con `rgba(0,0,0,X)` son theme-agnostic; los hex sólidos no.

**Fix**: extraer a variables CSS nuevas o usar las existentes (`--green`, `--bg-elevated`, etc). Si son efectos cyberpunk decorativos que deben ser fijos, considerar incluirlas como variables theme-locked.

Ver `feedback_theme_support.md`.

---

### I6 — `mergeEventoUpdate` helper local que debería ser util compartido
**Ubicación**: [`EventoDetail.jsx:234-244`](client/src/pages/eventos/EventoDetail.jsx)

**Síntoma**: helper privado para preservar `userRegistration` y `confirmedRegistrations` al mergear updates del server. El comentario es claro y útil. Si otros detalles (torneos, compartidas) tienen el mismo problema, deberíamos extraer.

**Fix**: por ahora dejar local — no hay otros usuarios. Documentar el patrón en el comentario para que otra feature lo encuentre.

---

### I7 — `evento_cancelled` se usa para cancelación Y eliminación del evento
**Ubicación**: [`server/routes/eventos.js:562`](server/routes/eventos.js) (PUT status=cancelled) y [`server/routes/eventos.js:643`](server/routes/eventos.js) (DELETE evento)

**Síntoma**: el usuario recibe el mismo tipo de notif en dos casos semánticamente distintos. Para el destinatario es lo mismo (el evento no va), pero el evento ya no existe → el deep-link de la notif a `/eventos/:id` rompe en 404.

**Fix razonable**: en el handler de DELETE, después de notificar, cambiar el `link` o un flag en la notif para que el cliente sepa "no naveges al detalle, el evento fue eliminado". O simplemente agregar `evento_deleted` como tipo distinto.

**Impacto**: bajo. Solo se siente si el usuario clickea la notif después de la eliminación.

---

### I8 — Errores silenciados sin logging en el cliente
**Ubicación**: [`Eventos.jsx:99-101`](client/src/pages/eventos/Eventos.jsx) y similares

**Síntoma**: `catch { /* silent */ }` en el fetch principal. Si la API falla, el usuario ve loading infinito o lista vacía sin mensaje.

**Fix**: mostrar al menos un toast de error y un retry button. Considerar usar el patrón "fetch retry" con backoff.

---

## 🟡 MEJORAS DE DEUDA TÉCNICA

### M1 — Modales sin focus management
**Ubicación**: [`EventoDetail.jsx:373-386`](client/src/pages/eventos/EventoDetail.jsx) (lightbox), [`TicketStub.jsx:254-277`](client/src/pages/eventos/TicketStub.jsx) (confirmación)

**Síntoma**: modales sin `role="dialog"` / `aria-modal="true"`, sin focus trap, sin restauración de focus al cerrar. Cierre con click outside pero sin tecla Escape (lightbox sí escucha onClick en backdrop).

**Fix**: crear `<ConfirmModal>` shared component (que tiene candidates en TicketStub, EventoInscripciones para "rechazar permanente") con focus management correcto. Reutilizable en Mesas/Torneos.

---

### M2 — `confirmedRegistrations` mantenido a mano via socket merging
**Ubicación**: [`EventoDetail.jsx:119-144`](client/src/pages/eventos/EventoDetail.jsx)

**Síntoma**: el cliente reconstruye un array de confirmados por sucesivos `evento:registration-reviewed` events. La lógica es correcta pero frágil — un payload sin `registration.user` populated lo rompe (el server siempre populates en la línea 1006, pero esto está implícito).

**Fix**: documentar el contrato en el handler (que el payload SIEMPRE trae `registration.user` populated cuando status=confirmed) o re-fetchar el evento cuando se detecta status=confirmed (más simple, una request por confirmación, escala bien dado el volumen esperado).

---

### M3 — `Eventos.jsx` no tiene búsqueda por texto
**Ubicación**: [`Eventos.jsx`](client/src/pages/eventos/Eventos.jsx)

**Síntoma**: hay filtro por status (open/closed/mine/draft/cancelled) y por distancia (slider), pero no por nombre del evento. Esperable a futuro.

**Fix**: agregar input con `useDebouncedValue(300)` y `?search=` query param en `GET /api/eventos`. Patron ya en uso en `/api/tables`.

---

### M4 — `now` ticker re-renderiza toda la página
**Ubicación**: [`Eventos.jsx:67-74`](client/src/pages/eventos/Eventos.jsx)

**Síntoma**: cada 30s se actualiza el state `now`, re-renderizando toda la lista de eventos aunque solo los countdowns la usan. Para 10-20 eventos no se nota, pero a escala podría.

**Fix**: mover el ticker DENTRO de `PosterCard`/`TimelineRow` (cada card tiene su tick local) o usar React Context con `useSyncExternalStore` para un store global de "now" que solo subscribe lo que lo necesita.

Esperar a tener el problema; no premature optimization.

---

### M5 — Inline styles en JSX en vez de CSS classes
**Ubicación**: [`EventoDetail.jsx:477-479`](client/src/pages/eventos/EventoDetail.jsx) — `style={{ marginLeft: 6, color: "var(--green)", fontWeight: 600, fontSize: "0.85em" }}`

**Síntoma**: badges de distancia con inline styles. Diluye CSS Modules.

**Fix**: agregar `.distanceBadge` al `EventoDetail.module.css`.

---

### M6 — Socket por componente (EventoDetail, EventoInscripciones, Eventos)
**Ubicación**: cada uno crea `io(socketUrl, {...})` con su propio token

**Síntoma**: tres componentes de la sección abren cada uno su socket. Hay overhead de connection/disconnection en cada navegación.

**Fix mayor**: exponer un socket único desde `NotificationContext` (el que ya tiene). Los componentes se suscriben a events con cleanup. Compatible con `join:evento` / `leave:evento` que ya están separados de la auth.

Es un refactor mayor pero limpia un patrón que se repite también en Torneos, Mesas, Compartidas. Considerar para una PR dedicada cross-feature.

---

### M7 — Lazy `closePastOpenEvents` corre en cada `GET /` y `GET /:id`
**Ubicación**: [`server/routes/eventos.js:118-158, 177, 362`](server/routes/eventos.js)

**Síntoma**: en cada request de lectura, el server busca eventos `open` cuya fecha pasó y los cierra. Es lazy migration, funciona, pero hay carga acumulativa si el feed se hittea mucho.

**Fix**: mover a un cron daily/hourly que cierre los pasados, en vez de en cada read. Idempotente — no rompe nada si ambos conviven.

---

### M8 — `mergeEventoUpdate` no aplica a `EventoInscripciones`
**Ubicación**: [`EventoInscripciones.jsx`](client/src/pages/eventos/EventoInscripciones.jsx)

**Síntoma**: `EventoInscripciones` mergea updates de socket con map/filter ad-hoc. Si el server expande el payload de `evento:updated`, hay que actualizar acá.

**Fix**: usar la misma estrategia que en `EventoDetail` (helper compartido) o documentar las diferencias en el contrato.

---

### M9 — Tests de UI no cubren temas (light mode)
**Ubicación**: tests de eventos componentes

**Síntoma**: ningún test cambia el theme y verifica que los colores se vean correctos. Los hardcoded colors de I5 pasarían silenciosamente.

**Fix**: si vamos a soportar light theme seriamente en eventos, un test que verifica `getComputedStyle(card).backgroundColor` en ambos temas.

---

### M10 — `useEffect` con `eslint-disable react-hooks/exhaustive-deps` justificado pero frágil
**Ubicación**: [`EventoDetail.jsx:170`](client/src/pages/eventos/EventoDetail.jsx)

**Síntoma**: el effect ignora `evento` en deps por buena razón (no queremos reconectar el socket en cada update). El comentario es excelente. Pero si alguien edita el effect y olvida la regla, se desconecta y reconecta a cada cambio.

**Fix**: extraer la lógica del socket a un custom hook `useEventoSocket(id, { onCountsChanged, onReviewed, onUpdated })`. Los deps del effect son sólo `id` + callbacks (que el hook envuelve en refs).

---

## 🔵 OPORTUNIDADES DE FEATURE

### F1 — Compartidas vinculadas a Evento
**Estado**: `Compartida` tiene `linkedTable`, no `linkedEvento`.

**Idea**: permitir a los usuarios postear una compartida diciendo "estuve en este evento". Aumenta engagement entre features. Implica agregar el ref en el modelo y UI en `CreateCompartidaForm`.

---

### F2 — Email transaccional al confirmar/rechazar inscripción
**Estado**: el server populates `email` en `GET /:id/inscripciones` pero ningún handler llama a `sendEmail()` al cambiar status.

**Idea**: usar Resend para mandar email con detalles del evento al confirmar, similar a verification email. Más útil para eventos pagos donde el comprobante implica una transacción real.

---

### F3 — Notificación con flag `eventoDeleted: true` y deep-link no-roto
**Ver I7**. Si vamos por el camino de `evento_deleted` como type separado, el deep-link en la notif puede saltar a `/eventos` (lista) con un mensaje "el evento fue eliminado" en vez de a `/eventos/:id` que tira 404.

---

### F4 — Filtro de eventos pasados vs próximos
**Estado**: Eventos.jsx filtra por status. No por "es del pasado" / "es del futuro".

**Idea**: un toggle "Próximos" / "Pasados" más allá del filtro de status. Si tenés muchos eventos cancelados pasados, el feed se contamina.

---

### F5 — `Web Share API` para compartir evento
**Estado**: hay OG metadata para compartidas (`/api/compartidas/:id/og`), no para eventos.

**Idea**: agregar `GET /api/eventos/:id/og` y un botón "Compartir" que use `navigator.share()` o copia el link. Útil para promocionar.

---

### F6 — Recordatorios opt-in/out por usuario
**Estado**: `evento_reminder` se envía a todos los confirmed.

**Idea**: permitir al usuario configurar "quiero recordatorio a las 24h" / "quiero a las 2h" / "no quiero recordatorio". Pequeña pero recurrente.

---

## 📊 HUECOS DE TESTS

### T1 — `GET /api/eventos/:id/inscripciones` sin test de integración directo
[`server/routes/eventos.js:895-938`](server/routes/eventos.js). No hay un `describe()` específico que cubra el filter por status, la populate de `email`, los counts.

### T2 — `EventoDetail` sin test del flujo `setActiveEvento` (porque B1 no existe todavía)
Cuando se arregle B1, agregar test que monte `EventoDetail` y verifique que `setActiveEvento` se llama al mount y `setActiveEvento(null)` al unmount.

### T3 — Sin test E2E que cubra create → inscribirse → triage → confirmar
Hay tests aislados de cada paso pero no del flujo entero. Vitest con MSW podría hacerlo, o tirar un test de integración a server.

### T4 — Sin test del race fetch HTTP / socket connect en `EventoDetail` (B4)
Difícil de tester con jsdom puro, pero un caso edge mockeable.

### T5 — Sin test del fallback de cron atrasado (B5)
Cuando se implemente `reminderSentAt`, agregar test unit del job con time travel.

---

## ✅ LO QUE FUNCIONA BIEN (no tocar)

- **Race condition de inscripción resuelta atómicamente**: [`server/routes/eventos.js:759-784`](server/routes/eventos.js) usa `findOneAndUpdate` con condition `'registrations.user': { $ne: userId }`. Test al respecto.
- **Lazy migration de `location`** en pre('init'): elegante, sin script de migración.
- **Idempotencia del cron** de recordatorios via upsert en `saveNotification`.
- **Leak prevention de drafts** en broadcasts: si status=draft, no se emite a `eventos:list`.
- **Cleanup de comprobante en race de inscripción**: si pierde el atomic insert, destruye el upload reciente.
- **Helper `mergeEventoUpdate`** que preserva `userRegistration` y `confirmedRegistrations`: comentario explicativo bueno.
- **`displayName` opcional en `location`** para alias amigables, con `getLocationDisplay(loc, mode)`.
- **Forced multipart vs JSON** en flujos con upload — consistente.
- **Counts derivados con `useMemo`** en `EventoInscripciones` (no duplicado en state). Aplica `feedback_derived_counts.md`.
- **Optimistic updates eliminados** de counts (ver `feedback_optimistic_vs_socket.md`): se dejan solo para asignaciones como `userRegistration`. Patrón aprendido bien aplicado.
- **Section gating completo**: `requireSection("eventos")` server-side + `<SectionGate section="eventos">` client-side + panel admin.
- **Navegación consistente**: Sidebar y BottomNav tienen "Eventos" con mismo ícono, ausente para guests (intencional).

---

## Priorización sugerida (de mayor a menor ROI)

1. **B1** — `setActiveEvento` (impacto UX directo, fix de 3 líneas, test pequeño)
2. **B2** — `<AdminRoute>` en `EventoInscripciones` (corrección de arquitectura, fix de 1 línea en App.jsx)
3. **I1** — supresión de toasts para evento activo (depende de B1)
4. **B3** — cleanup de comprobantes huérfanos en rechazo permanente
5. **I2** — extraer `useTickingNow` hook (3 lugares menos)
6. **I3** — extraer `eventoStatus.js` util
7. **B5** — `reminderSentAt` para hacer el cron robusto a delays
8. **B6+B7** — toasts para errores en vez de inline + contrato consistente
9. **I4** — consolidar `Dropzone` shared component
10. **I5** — quitar hardcoded colors (light theme support)
11. **B4** — socket race (fixable o aceptable según prioridad)
12. **B8** — validación de ObjectId
13. **M6** — socket centralizado en NotificationContext (refactor mayor, candidato a PR separado y aplicarlo a Mesas/Torneos/Compartidas también)
14. Todo lo demás (M1-M10, F1-F6, T1-T5) según necesidad y bandwidth.

---

## Verificación

Este es un reporte; no hay implementación que verificar. Cuando se ataquen los fixes, cada uno debe llegar con sus tests (server o client según corresponda, ver `feedback_tests_required.md`).
