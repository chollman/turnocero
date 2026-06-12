---
name: feedback-dice-search-loader
description: DiceLoader (dado d6 animado) es EL loader de todos los buscadores dropdown de la web — al usuario le encantó y pidió usarlo en el resto
metadata:
  node_type: memory
  type: feedback
  originSessionId: 424bf8a3-b898-407f-b754-62196e89053c
---

**Qué:** `client/src/components/shared/DiceLoader.jsx` (+ `.module.css`) — dado d6 SVG inline que se hamaca y recorre las caras 1→6 (los pips se prenden/apagan en 4 grupos con `steps(1, end)`: centro / diagonal corta / diagonal larga / laterales) + tres puntos rebotando junto al texto + hint opcional. `role="status"`, tokens theme-aware (`--amber`, `--bg-elevated`), respeta `prefers-reduced-motion`. Props: `text` (default "Buscando") y `hint` (default sin hint).

**Why:** Nació para el buscador de juegos de BGG (2026-06-12); al usuario le pareció que "quedó genial" y pidió explícitamente usar la MISMA animación en los buscadores de tipo dropdown del resto de la web, en lugar de skeletons o un "Buscando…" de texto plano que no comunican espera.

**How to apply:** En todo buscador dropdown con espera de red, renderizar `<DiceLoader text="Buscando X" />` en el estado loading; si la espera es contra BGG (lenta de verdad), sumar `hint="puede tardar unos segundos"`. Ya aplicado en: `BggGameSearch` (compartido: partida, juntada, compartidas, ludoteca de eventos, math trade), `ExpansionsPicker`, `MyGamesPicker`, `PlayerPicker`, `LocationPicker`. Candidatos pendientes al tocar esas pantallas: los buscadores de `LocationEditModals` / `PlayerEditModals` y cualquier dropdown de búsqueda nuevo. Los skeletons (`SearchRowSkeleton`, [[skeleton-pattern]]) quedan para listas/paneles de contenido, no para dropdowns de búsqueda. Relacionado: [[feedback-shared-form-components]].
