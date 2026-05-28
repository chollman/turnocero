---
name: feedback-mobile-nav-drawer
description: "Mobile nav lives in a slide-in right drawer (Sidebar) toggled by a hamburger that morphs to X in the Navbar. BottomNav is gone."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: replace-bottomnav-with-drawer
---

Since 2026-05-27 there is **no BottomNav**. Mobile navigation lives in the same `Sidebar` / `GuestSidebar` component that desktop uses, presented as a slide-in drawer from the right.

## Architecture

- `App.jsx` holds `const [menuOpen, setMenuOpen]` and passes `menuOpen` + `onToggleMenu` to `Navbar`/`GuestNavbar`, and `open` + `onClose` to `Sidebar`/`GuestSidebar`.
- **Navbar sits above the drawer** with `z-index: 250` (drawer is 200, backdrop 199). The Navbar IS the drawer header on mobile — the Sidebar's internal `.logoRow` is `display: none` inside `@media (max-width: 959px)` (use `.sidebar .logoRow { display: none }` to beat the base `display: flex` rule that appears later in the file).
- Drawer is `position: fixed; inset: 0 0 0 auto; height: 100dvh; width: min(86vw, 320px); transform: translateX(100%); transition: transform .25s ease`. Open state is `.sidebar.sidebarOpen { transform: translateX(0) }` — chain both classes for specificity, the bare `.sidebarOpen` will lose the cascade.
- Drawer background matches Navbar (`background: var(--bg-dark)` on mobile) so the navbar + drawer read as one panel.
- Drawer `padding-top: calc(52px + env(safe-area-inset-bottom, 0px))` so content starts under the navbar.

## Hamburger ↔ X morph

The Navbar's toggle button has **3 `<span class={menuLine}>` children** (no SVG). CSS animates them:

```css
.menuLine:nth-child(1) { top: 11px; }
.menuLine:nth-child(2) { top: 17px; }
.menuLine:nth-child(3) { top: 23px; }
.menuBtnOpen .menuLine:nth-child(1) { top: 17px; transform: rotate(45deg); }
.menuBtnOpen .menuLine:nth-child(2) { opacity: 0; }
.menuBtnOpen .menuLine:nth-child(3) { top: 17px; transform: rotate(-45deg); }
```

Button toggles `aria-expanded` and `aria-label` (`"Abrir menú"` / `"Cerrar menú"`).

## Closing the drawer — TWO paths required

1. `useEffect([location.pathname])` skipping the initial mount via `useRef(initialPathRef)`. Covers route changes from any source.
2. `onClick={onClose}` on **every `<Link>` inside the drawer**. Covers the case where a Link points to the current pathname (e.g. clicking "Mesas" while on `/mesas`) — React Router doesn't fire pathname change, so the effect alone leaves the drawer open.

Also closes on backdrop click and Escape key. Body scroll is locked while open.

## What NOT to do

- Don't reintroduce a floating "X" close button inside the drawer. The morphing hamburger in the Navbar is the only close affordance.
- Don't lower the Navbar z-index below the drawer — that breaks the morph button click target.
- Don't rely only on the `useEffect[pathname]` for closing — same-route clicks won't fire it.
