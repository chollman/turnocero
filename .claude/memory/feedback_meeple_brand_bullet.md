---
name: feedback_meeple_brand_bullet
description: "The brand bullet/motif is now a <Meeple> SVG component, replacing the old ◆ glyph everywhere"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7921e9c9-7049-4637-bdcc-723f664ecffe
---

Desde 2026-06-01 el motivo de marca de TurnoCero dejó de ser el glifo rombo `◆` (U+25C6) y pasó a ser un **meeple** (silueta de ficha). Componente: `client/src/components/shared/Meeple.jsx` (+ `Meeple.module.css`, `Meeple.test.jsx`).

**Why:** el usuario pidió cambiar el rombo por un meeple "del mismo color y un poco más grande". El `◆` aparecía en ~100 lugares (52 archivos) como viñeta de eyebrows (`◆ MI PERFIL`, `◆ board game meetups`) y como placeholder del avatar en `AvatarColorPicker`.

**How to apply:**
- Para cualquier viñeta/eyebrow nueva usá `<Meeple />` en vez de `◆`. NO reintroducir `◆`.
- `<Meeple>` es SVG inline (patrón [[feedback_inline_svg_icons]]), hereda color via `currentColor` y tamaño en `em` (1.15em por defecto vía `.meeple`), así matchea el color/tipografía del contexto en dark y light ([[feedback_theme_support]]) sin tocar el CSS module de cada página. Pasá `className` para sobrescribir el tamaño (ej. `.previewMeeple` en AvatarColorPicker = 60% de la caja).
- El avatar SIN foto sigue mostrando **iniciales** (no se tocó `Avatar.jsx`); el meeple sólo reemplaza el placeholder `◆` del color-picker cuando todavía no hay nombre.
- Pendiente/flagged: los glifos `♦` (U+2666, distinto) siguen como decoración ambiente en `BoardGameBackground`/`SplashScreen` y como `♦ HOST` dentro del SVG de `TableMap` — NO se convirtieron (contexto SVG `<text>` no admite el componente; el usuario decide si quiere meeplificarlos).
