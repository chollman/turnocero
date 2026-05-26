---
name: feedback-shared-modal
description: "Usar <Modal> de components/shared para cualquier overlay full-screen (lightbox, confirmaciones, dialogs). Maneja focus mgmt, Escape, aria-modal."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 34d2559e-0433-4d98-9eb2-2c0acd998365
---

Cualquier overlay full-screen (lightbox de imagen, confirmation dialog, modal de form) debe usar el componente shared [`Modal`](client/src/components/shared/Modal.jsx) en vez de implementar el div+backdrop a mano.

**Why:** Creado en M1 del review de Eventos. Antes cada página tenía su propio `<div className={styles.lightbox}>` sin `role="dialog"`, sin `aria-modal`, sin focus trap, sin Escape key, sin restauración del focus al cerrar. Inaccesible y inconsistente.

**How to apply:**

```jsx
import Modal from '../../components/shared/Modal';

<Modal
  isOpen={open}
  onClose={() => setOpen(false)}
  ariaLabel="Imagen ampliada"        // o ariaLabelledBy="titleId" si hay heading
  backdropClassName={styles.overlay} // estilo del overlay full-screen
  className={styles.dialogContent}   // estilo del contenedor — usar display:contents si no querés un wrapper visual
  dismissOnBackdrop={true}            // default true; false para confirmaciones que no se dismissan sin click explícito
>
  <button onClick={() => setOpen(false)}>✕</button>
  <img src={...} alt={...} />
</Modal>
```

Maneja por vos:
- `role="dialog"` + `aria-modal="true"`
- Escape para cerrar
- Click en backdrop cierra (opt-out via `dismissOnBackdrop={false}`)
- Click adentro NO cierra (stopPropagation)
- Focus inicial en el contenedor + restaura al elemento que tenía focus al abrir

**No usar para:** confirmaciones inline tipo "Sí/No" row dentro de un sidebar (TicketStub). Esas son chips contextuales, no overlays.

Aplicar al lightbox del Compartidas (no migrado todavía) y a futuras modales en Mesas/Torneos.
