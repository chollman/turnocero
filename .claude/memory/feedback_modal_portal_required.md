---
name: feedback-modal-portal-required
description: 'El componente shared `<Modal>` debe rendererse via `createPortal(..., document.body)` — caso contrario queda clippeado por ancestros con `overflow: clip` + `will-change: transform` (o cualquier propiedad que cree containing block para position:fixed).'
metadata:
  type: feedback
---

`<Modal>` shared (`client/src/components/shared/Modal.jsx`) usa `createPortal(content, document.body)`. NO revertir esto a render inline.

**Why:** En EventoDetail el `.main` tiene `will-change: transform` (necesario para la animación cyberpunk-glitch — ver [[feedback-cyberpunk-glitch]]) y `overflow: clip` (para contener el `::after { translateY(100%) }` del scan beam). La combinación rompe `position: fixed` en descendientes — el fixed se posiciona respecto al `.main` en vez del viewport y queda clippeado al box del main. Síntoma observado: el picker "Agregar juego" de la Ludoteca aparecía dentro de la columna del main en lugar de cubrir la pantalla, y el backdrop solo oscurecía esa columna. Otros ancestros con `transform`, `filter`, `perspective`, `contain: paint`, `backdrop-filter` o `will-change` con esas props tienen el mismo efecto.

**How to apply:**

- Cualquier modal nuevo va por `<Modal>` shared (ya portea). No reimplementar overlays con un `<div className={styles.backdrop}>` inline.
- Si por algún motivo necesitás un overlay propio (drawer, popover full-screen, lightbox), también porta a `document.body` con `createPortal` o usá un container fixed en el shell de la app, NO renderices inline dentro de la página.
- Tests del Modal queryan `document.body.querySelector(...)` para el backdrop (no `container.querySelector(...)`), porque con portal el contenido NO está dentro del container devuelto por `render()`.
- Si en el futuro alguien quita el portal por un test que falla, el fix correcto es actualizar el test, no quitar el portal.
