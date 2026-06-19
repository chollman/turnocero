---
name: feedback-widget-panel-gap
description: Gaps entre widgets/paneles apilados en un layout usan el token --gap-widgets (0.75rem), no px sueltos
metadata:
  type: feedback
---

El gap **entre widgets o paneles** apilados en un layout es `0.75rem` en toda la app, vía el token `--gap-widgets` definido en [client/src/index.css](client/src/index.css) (junto a `--navbar-h`).

**Qué califica** (usar `var(--gap-widgets)`): el `gap`/`row-gap`/`column-gap` de cualquier contenedor que apile **cajas autónomas o bloques de contenido** — rails laterales que apilan widgets (ej. `CompartidasSidebar .sidebar`, `BgWatchProfile .playsSideCol`), columnas de página que apilan paneles, grids/feeds de cards (mesas, eventos, torneos, usuarios, math-trade, util, play cards), el gap entre columnas de un shell multi-columna (ej. `partidasLayout 1fr 300px`), **e incluso listas/feeds anidados dentro de un panel o el ritmo de una columna de contenido** (ej. BG Watch: `.playsMain` envolviendo lista+paginación, y el `.playsList` "otras partidas" dentro de `GroupStatsPanel` — el usuario los quiso todos a token).

**Qué NO califica** (dejar en px): solo el spacing **atómico interno** de un componente — icono+texto, contenido de botón, stacks label+valor, filas de form, tabs, chips, breadcrumbs, números de stat. Regla práctica: si lo que se separa son **cards/paneles/widgets/filas-de-contenido** → token; si son **iconos/labels/controles dentro de un control** → px. El `.inner` que apila hero→contenido de una página (18–28px) es la excepción que dejé afuera (ritmo de sección de página, no gap entre widgets) — confirmá con el usuario antes de tocarlo.

**Why:** unifica el ritmo entre secciones; antes cada rail/columna/feed tenía su propio valor (10/14/16/18/24/28px, 1.5rem…). Encaja con el resto del sistema tokenizado (padding, breakpoints en `@custom-media`). El usuario tiende a querer **más** unificación, no menos: ante la duda, tokenizá la lista/feed.

**How to apply:** en features nuevas, cualquier contenedor que apile widgets/paneles/cards/filas-de-contenido arranca con `gap: var(--gap-widgets)`. Si un override responsive solo apretaba ese mismo gap, también usar el token.

**Gotcha de barrido:** módulos CSS enormes (ej. `BgWatchProfile.module.css`, 3400+ líneas) se sub-escanean fácil — `partidasLayout` y los `.playsList`/`.playsSideCol` se escaparon del primer barrido. Al sweepear, revisá grandes por separado y `grep` el selector compilado en el preview (`document.styleSheets` → regla → `.style.gap`) para confirmar que resuelve a `var(--gap-widgets)`. Ver [[padding-system]] y [[feedback-canonical-breakpoints]].
