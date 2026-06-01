---
name: feedback_helmet_version_react18
description: react-helmet-async@3.0.0 está roto bajo React 18 (no aplica ningún tag al head); fijar en ^2.0.5
metadata:
  type: feedback
---

`react-helmet-async@3.0.0` (release genuino de staylor con "native support for React 19+", del registry oficial — NO supply-chain) **está roto bajo React 18**: aplica **cero** tags al `<head>`. Síntoma visible: el **título de la pestaña** de TODAS las páginas queda en el default de `index.html` ("TurnoCero 🎲") en vez del propio de cada página. El `<title>` real no tiene atributo `data-rh` y `document.head.querySelectorAll('[data-rh]').length === 0`.

OJO con el alcance: el fix arregla el **title del tab** (beneficio real y visible) + cualquier lectura client-side de meta. **NO** cambia los previews sociales al compartir, porque los crawlers no ejecutan JS — leen el HTML crudo (OG estáticos de `index.html` + el `client/middleware.js` que inyecta OG para compartidas). Con Helmet ya funcional quedan OG duplicados en el DOM cliente (estático de index.html + el de Helmet) — cosmético/inofensivo, los crawlers ni lo ven.

**Why:** el dispatcher detecta la versión de React (`isReact19 = major >= 19`) y bajo <19 usa el `HelmetDispatcher` clásico, pero su flush al DOM no registra/aplica instancias correctamente en este setup (React 18.3 + Vite). No es por `StrictMode` (lo descarté con A/B test), no es React duplicado, no es config.

**How to apply:** mantener `react-helmet-async` en **`^2.0.5`** (última battle-tested con React 18, misma API `Helmet`/`HelmetProvider`, sin cambios de código). El caret `^2.0.5` capa por debajo de 3.0.0, así npm no re-trae el roto. NO subir a 3.x hasta migrar a React 19. App diagnosticada y arreglada el 2026-06-01 (estuvo rota un tiempo sin que nadie lo notara — los títulos no son visibles en uso normal).

Detalle relacionado: las pantallas de error ([[project_error_screens]]) NO usan Helmet para el título — lo setean imperativo (`document.title` + restaura en unmount) para ser auto-contenidas; eso quedó así a propósito y coexiste bien con Helmet ya funcional.
