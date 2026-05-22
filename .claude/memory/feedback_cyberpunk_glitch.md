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

## Gotcha #2 — stagger en `.container > *` aplica a children dinámicos

Cuando un container usa `.container > * { animation: rowIn ... ; animation-delay: 0.4s+ }` con `opacity: 0 → 1`, **cualquier child nuevo montado después también recibe el delay**. Ejemplo: si agregás tabs y `.container > *:nth-child(2) { animation-delay: 0.46s }`, al cambiar de tab React monta el contenido nuevo como segundo child y queda **invisible ~500ms** — el click parece no hacer nada.

**Fix:** scopear el stagger excluyendo al elemento que marca el inicio de contenido dinámico:

```css
.tabs,
.tabs ~ * {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}
```

Ya aplicado en `.main` de [EventoDetail.module.css](client/src/pages/eventos/EventoDetail.module.css) — las tabs (`Detalle · Ludoteca · Mesas`) y todo lo que sigue al `<nav>` aparecen instantáneamente. El stagger se mantiene para el resto del contenido (hero, ticket stub).

Aplicable a cualquier container con boot-in animado al que después se agregue contenido condicional o un cambio de pestañas.

## Gotcha #3 — el kill-switch de Gotcha #2 también mata animaciones nuevas que SÍ querés

El `.tabs ~ * { animation: none !important }` es absoluto: si después querés meter, por ejemplo, un slide entre tabs, la animación queda silenciada y NO se puede vencer con specificity normal (es `!important`). Tratar de pelearla con más `!important` arma una guerra cascada que es frágil.

**Fix limpio**: aislar el elemento animado en un wrapper. El wrapper es el que es sibling de `.tabs` y recibe el kill-switch; el elemento animado adentro **no es sibling** de `.tabs`, así que la regla no lo matchea.

```jsx
<nav className={styles.tabs}>...</nav>
<div className={styles.tabContentWrap}>          {/* sibling de .tabs → animation: none */}
  <div                                            {/* NO sibling de .tabs → animation libre */}
    className={styles.tabContent}
    key={activeTab}                                {/* re-mount en cada switch */}
    data-direction={tabDirection}                  {/* "right" | "left" */}
  >
    {/* tab body */}
  </div>
</div>
```

```css
.tabContent {
  animation: 0.24s ease-out both;
}
.tabContent[data-direction="right"] { animation-name: tabSlideInRight; }
.tabContent[data-direction="left"]  { animation-name: tabSlideInLeft; }
@keyframes tabSlideInRight { from { transform: translateX(28px); opacity: 0; } to { ... } }
@keyframes tabSlideInLeft  { from { transform: translateX(-28px); opacity: 0; } to { ... } }
```

Dirección computada en el setter del tab activo: comparar índices en el array de orden (`VALID_TABS`) — forward = `"right"`, back = `"left"`. `key={activeTab}` fuerza unmount/mount en cada switch para re-disparar el keyframe (sin esto, React mantendría el div y la animación no se vuelve a ejecutar).

Ya aplicado en [EventoDetail.jsx](client/src/pages/eventos/EventoDetail.jsx) (slide entre Detalle · Ludoteca · Mesas) + [EventoDetail.module.css](client/src/pages/eventos/EventoDetail.module.css).

**Patrón general**: cuando hay una regla con `!important` que necesitás respetar para un caso pero esquivar para otro, no pelees con specificity — cambiá la estructura DOM para que el selector deje de matchear el caso que querés exonerar.
