---
name: feedback-fab-positioning
description: "All mobile FABs sit at bottom: calc(16px + env(safe-area-inset-bottom, 0px)). The old 56-76px offset existed to clear the BottomNav pill — BottomNav is gone now."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fab-position-post-bottomnav
---

## Convention

Every floating action button on mobile (`@media (max-width: 820-880px)` per page) uses:

```css
.fab {
  position: fixed;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  right: 16px;   /* or left: 16px for the admin toggle */
  z-index: 50;   /* 1001 for app-level toggles like AdminViewToggle */
}
```

The `env(safe-area-inset-bottom, 0px)` clears the iOS home-indicator. The base 16px gutter matches desktop's FABs (which usually sit at 20px).

## Style (amber pill with icon + text)

Used by Dashboard "+ Crear mesa" and Eventos "Nuevo evento":

```css
display: inline-flex; align-items: center; gap: 6px;
background: var(--amber); color: var(--on-amber);
padding: 12px 18px; border-radius: 999px;
font-family: var(--font-display); font-size: 14px; font-weight: 700;
box-shadow: 0 4px 16px var(--amber-glow);
transition: all var(--transition);
```

Hover lifts to `box-shadow: 0 4px 22px var(--amber-glow)` and `background: var(--amber-light)`. Matches the [primary CTA pattern](feedback_primary_cta_pattern.md).

## Components on this convention

- `Dashboard.module.css` `.fab` — "+ Crear mesa" (mobile only)
- `Eventos.module.css` `.fab` — "Nuevo evento" (admin + mobile only)
- `AdminViewToggle.module.css` `.fab` — left side, circular icon, z-index 1001
- `ChatLauncher.module.css` `.fab` — hidden on mobile (`display: none` in `@media (max-width: 959px)`)
- `ToastContainer.module.css` `.container` mobile — `bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))`

## What NOT to do

Don't reintroduce the 56-76px offset. The BottomNav pill that justified it was removed in commit `d5977e6` (May 2026). A fresh FAB needs to sit at 16px + safe-area, period.
