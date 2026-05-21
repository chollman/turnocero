---
name: feedback-cyberpunk-glitch
description: 'Cyberpunk glitch is the user''s preferred aesthetic for "impactful" / "striking" effects — use it as the default when asked for an impressive entrance/transition.'
metadata:
  node_type: memory
  type: feedback
  originSessionId: f182a745-93aa-4191-b084-7968b30e2f8b
---

When the user asks for an "efecto impactante", "algo llamativo", a striking entrance, or any kind of dramatic transition/animation, default to a **cyberpunk glitch** aesthetic rather than tasteful pop-ins, bounces, or fades. He explicitly loved this style applied to the floating chat windows.

**Why:** He rejected a clean spring/bounce pop-in and a generic RGB-split glitch in favor of full cyberpunk. The style fits the visual personality he wants for these moments.

**How to apply:** Reference the implementation in [client/src/components/chat/ChatWindow.module.css](client/src/components/chat/ChatWindow.module.css) (the `chatWindowCyberIn` animation + `::before` scanlines + `::after` scan beam). The key ingredients:

- **CRT boot-in slice**: `clip-path: inset(50% 0 50% 0)` → `0`, with `brightness(2.4)` flash at start.
- **Neon RGB split**: chromatic aberration via `filter: drop-shadow()` with magenta `#ff2a6d` and cyan `#05d9e8` (the cyberpunk palette — NOT the standard `var(--red)` / generic cyan).
- **Jitter + skew**: small async `translate()` + `skewX()` per keyframe.
- **`animation-timing-function: steps(1, end)`**: frames jump, no interpolation — that's what makes it feel digital instead of smooth.
- **One inverted frame** (`filter: invert(1) hue-rotate(180deg)`) mid-animation for the "broken signal" shock.
- **Scanlines overlay** (`::before`): repeating cyan horizontal lines + inset cyan border + inset magenta glow, `mix-blend-mode: screen`, fades out at end.
- **Scan beam** (`::after`): vertical gradient with magenta→white→cyan band, `translateY(-100%) → 100%` sweeping once.
- Always respect `prefers-reduced-motion: reduce` (disable animation + hide pseudo-elements).
- Use accent-color tokens (`var(--amber)`, `var(--purple)`) sparingly for variety in intermediate frames; the magenta + cyan should dominate.

This is for _impactful moments_, not everyday transitions — applying it to mundane UI (button hovers, page nav) would dilute the effect. Reserve for first-mount entrances of important overlays/windows.

## Gotcha — scroll fantasma del beam (`::after`)

El scan beam termina con `transform: translateY(100%)` (queda posicionado justo debajo de la caja del contenedor). Como es un pseudo-elemento `position: absolute`, ese box transformado **se suma al `scrollHeight` del documento** — efectivamente duplicando la altura del contenedor en el scroll. Resultado: scroll vacío más allá del contenido, y en layouts con sidebar fijo + main content, parece que "se scrollea el sidebar" porque el body es más largo de lo que debería.

**Fix**: `overflow: clip` en el contenedor animado.

- **NO usar `overflow: hidden`** — rompe `position: sticky` en descendientes (ej. el `TicketStub` del aside en EventoDetail). `clip` no crea contexto de scroll y preserva sticky.
- Síntoma típico: `element.scrollHeight ≈ 2× element.offsetHeight` y `body.scrollHeight` infla cuando el efecto está activo.
- Aplicar al mismo elemento que tiene el `position: relative` + animación + pseudo-elementos.

**Ya aplicado en:**

- `.comments` de [CompartidaCard.module.css](client/src/pages/compartidas/CompartidaCard.module.css) (aparición al expandir comentarios — más notorio en la última card del feed).
- `.main` y `.aside` de [EventoDetail.module.css](client/src/pages/eventos/EventoDetail.module.css) (boot-in del detalle + cascade del TicketStub).

Cualquier nueva aplicación del efecto cyber-glitch con beam debe incluir `overflow: clip` desde el inicio.
