---
name: feedback-errors-as-toasts
description: "Convención para errores transitorios del cliente — usar addToast({ type: 'error' }) en vez de state local actionError + inline <p>"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 34d2559e-0433-4d98-9eb2-2c0acd998365
---

Errores de PUT/POST/DELETE en handlers de páginas deben mostrarse como toast global vía `NotificationContext.addToast({ type: 'error', title, message })`, no como state local `actionError` + `<p>` inline.

**Why:** Implementado en B6+B7 del review de Eventos (mayo 2026). Antes cada página mantenía su propio `actionError` state + `<p className={styles.actionError}>` sin auto-dismiss, sin centralización, inconsistente con el resto. El `ToastContainer` ya tenía duraciones por tipo y soporte para click-to-dismiss.

**How to apply:**
- Importar `addToast` del `useNotifications` hook.
- En el `catch` del PUT/POST/DELETE: `addToast({ type: 'error', title: 'No pudimos guardar', message: err.response?.data?.message || 'Reintentá en unos segundos.' })`.
- Validation errors persistentes (form field vacío) SÍ pueden quedar inline — son feedback contextual al campo, no transitorios.

**Contrato del throw después del toast:**
- Re-tirar `throw err` SOLO si el caller del handler necesita signal para no cerrar su UI (ej: `TicketStub` mantiene el form abierto al fallar la inscripción).
- NO tirar cuando el caller no escucha el reject (cancel/reopen de evento).
- Si re-tirás, el caller debe atrapar y NO mostrar el mismo mensaje — el toast ya cubre.

El tipo `error` está registrado en [`ToastContainer.jsx`](client/src/components/layout/ToastContainer.jsx) con ícono ⚠️, título "Algo salió mal" (fallback), duración 5000ms, y click-to-dismiss sin navegar.

Aplicar a Mesas/Torneos/Compartidas/BgWatch cuando se toquen handlers similares — el patrón viejo de `actionError` está deprecado.
