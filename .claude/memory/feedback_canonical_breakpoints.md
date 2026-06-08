---
name: feedback-canonical-breakpoints
description: Responsive breakpoints are a single canonical scale (@custom-media tokens), never raw px literals for shared transitions
metadata:
  type: feedback
---

Desde 2026-06-08: los breakpoints de media-query son una **escala canónica única** en [client/src/breakpoints.css](client/src/breakpoints.css), expuestos como `@custom-media` y resueltos en build por `postcss-custom-media` + `@csstools/postcss-global-data` ([client/postcss.config.js](client/postcss.config.js), que inyecta las defs en cada `*.module.css`). Tokens:

- `--desktop` (`min-width: 960px`) / `--below-desktop` (`max-width: 959px`) — quiebre ESTRUCTURAL del shell (sidebar de escritorio ⟷ drawer mobile). El dominante (~95 usos).
- `--tablet` (`max-width: 880px`) — contenido ancho/forms a 1 columna.
- `--phone` (`max-width: 600px`) — cards/grids a 1 columna.
- `--compact` (`max-width: 480px`) — teléfonos chicos.

Uso: `@media (--below-desktop) { … }` en cualquier módulo, sin import.

**Why:** las CSS custom properties NO funcionan dentro de `@media` (`@media (max-width: var(--x))` es inválido), así que para reutilizar breakpoints de verdad hay que usar `@custom-media`, no variables. El detonante fue un bug: Compartidas usaba `940px` como su quiebre desktop/mobile mientras el resto de la app usaba `959px` → un widget de BG Watch se renderizaba dos veces en la franja 941–959px (el sidebar ya estaba oculto a ≤940 pero el slot in-feed recién aparecía a ≤959... o al revés). Valores casi-iguales para la MISMA transición = franja de solapamiento.

**How to apply:**
- Para cualquier transición compartida entre componentes, usá el token, nunca un px crudo. Un literal cercano-pero-distinto (940 vs 959, 980 vs 960, 540 vs 600) es el patrón de drift a evitar.
- Anchos one-off (una card/modal puntual que reflowa a su ancho natural) pueden quedar literal, pero snapeá al token más cercano si encaja.
- `npm run lint:breakpoints` ([scripts/check-breakpoints.mjs](client/scripts/check-breakpoints.mjs)) falla si un valor reservado (960/959/880/600/480/940) aparece como literal o si hay un ancho en la franja de drift 941–958px. Correr en pre-commit junto a ESLint.
- Migración inicial: 151 reemplazos en 69 archivos (script one-shot, ya borrado). Quedaron como literal a propósito valores no-estructurales de la cola larga (980×5, 520, 720, 640, 820, 560, 620, 580…); snapealos al token más cercano cuando toques esos archivos.
- NO confundir con [[padding_system]] (que define `--page-padding*` y la regla full-width) ni con [[feedback_sidebar_freed_space]] (`--sidebar-freed`, que sí es una CSS var normal porque se usa en `calc()`, no en `@media`).
