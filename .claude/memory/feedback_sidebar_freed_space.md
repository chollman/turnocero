---
name: feedback-sidebar-freed-space
description: Cuando el sidebar de escritorio se contrae, el contenido de cada sección debe reclamar el espacio liberado vía la variable --sidebar-freed (no dejarlo como gutter)
metadata:
  node_type: memory
  type: feedback
---

Cuando el sidebar principal (escritorio, ≥960px) se **contrae** (280px → 76px), el contenido de **cada sección** debe expandirse para ocupar los 204px que el sidebar libera — no dejarlos como gutter vacío.

**Por qué:** `.appShell` es flex y `.appContent` es `flex:1`, así que el ancho liberado pasa automáticamente al área de contenido. PERO las páginas con un `max-width` a nivel de wrapper (Mesas/Eventos/Compartidas/etc.) lo desperdiciaban: con el sidebar expandido el área (~1160px) queda por debajo del cap, pero al contraerse (~1364px) lo supera y el cap deja gutter centrado/lateral.

**Cómo aplicar (mecanismo, junio 2026):**

1. `Sidebar.jsx` refleja el colapso en `<html data-sidebar-collapsed="true">` vía `useEffect([collapsed])` (set/clear + clear on unmount). El Sidebar es la **fuente de verdad** del atributo (sólo se monta logueado, fuera de auth pages). El script inline de `index.html` lo reaplica pre-hidratación **sólo si hay `token`** (un invitado ve el `GuestSidebar` de ancho fijo) para evitar el salto narrow→wide en el primer paint.
2. `index.css` define `--sidebar-freed` (`@property <length>`, `inherits`, init `0px`); `:root` = `0px`; dentro de `@media (min-width:960px)`: `html { transition: --sidebar-freed 0.22s ease }` (anima el ancho en lockstep con la animación de width del sidebar) y `html[data-sidebar-collapsed="true"] { --sidebar-freed: 204px }` (= 280-76).
3. Cada wrapper de **contenido** a nivel de página cambia su cap a `max-width: calc(<base> + var(--sidebar-freed))`. El delta de 204px hace que el contenido crezca EXACTAMENTE lo que el sidebar liberó (en páginas centradas se mantienen los gutters; en grids `1fr <widget>px` crece sólo la columna `1fr`).

**Regla:** **NO** sumar `var(--sidebar-freed)` a:
- Columnas de **widgets/in-page sidebars** (ej. `asideCol` 320px en Compartidas/Notifications) — deben quedar fijas; sólo crece el contenido principal.
- Bloques de **prose/reading-width** (`.description`/`.subtitle`/`.heroSub` con `60ch/70ch`) — son texto de intro, no el contenido de la sección.

Páginas **sin** cap a nivel de página (grids/flex `1fr`: Torneos, Notifications, Calendario, MeFeed, UserProfile, PanelAdmin, BgWatchProfile, etc.) **ya** absorben el espacio liberado por flex — no tocar.

Páginas convertidas a `calc(base + var(--sidebar-freed))`: Dashboard/Mesas (1200), Eventos (1200), EventoDetail (1200), EventoInscripciones (1280), Colaborar (1200), MesaForm (1200), PlayForm (1200), Compartidas `.layout` (1180), CompartidaPost `.layout` (1180), Utilidades `.inner` (860), NoticiaDetail `.inner` (780), MathTradeForm `.inner` (720).

**Verificado** (preview, viewport 1600, shell capeado a 1440): Mesas page 1160→1364px (+204); Compartidas feed 792→996px (+204) con widget fijo en 320px.

Esto matiza la regla histórica de [[padding-system]] ("never cap width"): el cap base se conserva, pero se le suma el espacio liberado en estado contraído. Todo wrapper de sección NUEVO con un `max-width` debe usar este patrón.
