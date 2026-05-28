---
name: feedback-mobile-controls-pattern
description: "Stack list-page controls vertically on mobile (search full-width on top, chips/view/actions below), hide inline primary CTA, show FAB instead. Search input always wraps with an icon."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eventos-mirror-mesas-pattern
---

List-style pages (Mesas, Eventos, future ones) share a controls row with: search input + ListFilters chips + view toggle (grid/list) + inline primary CTA (`+ Nuevo X`). On mobile this row must restructure.

## Mobile layout (inside `@media (max-width: 820-880px)` per page's existing breakpoint)

```css
.controls {
  flex-direction: column;     /* stack vertically */
  align-items: stretch;
  gap: 14px;
}
.searchWrap { flex: 1; min-width: 0; max-width: none; }  /* full width */
.searchInput { width: 100%; flex: 1; min-width: 0; }
.controlsRight { justify-content: space-between; flex-wrap: wrap; }
.newBtn { display: none; }    /* hide inline CTA */
.fab { /* show — see feedback_fab_positioning */ }
```

The inline `newBtn` becomes a floating action button on mobile. Both share the same accessible name ("Nuevo evento", "Crear mesa") — tests must use `getAllByRole(...)[0]` to disambiguate, or assert just one is present.

## Search input shape — ALWAYS wrap with icon

Bare `<input>` is wrong. Use the Mesas/Eventos shared shape:

```jsx
<div className={styles.searchWrap}>
  <span className={styles.searchIcon}><SearchIcon /></span>
  <input className={styles.searchInput} ... />
</div>
```

```css
.searchWrap { position: relative; flex: 1; min-width: 180px; max-width: 360px; }
.searchIcon {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); pointer-events: none; display: inline-flex;
}
.searchInput {
  width: 100%; height: 36px; padding: 0 12px 0 34px;   /* 34px clears the icon */
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 8px; font-family: var(--font-mono); font-size: 12px;
}
.searchInput:focus { border-color: var(--amber); outline: none; }
```

All controls in the row are **height: 36px + box-sizing: border-box** so they align with `<ListFilters>` trigger (also 36px).

Reference: `client/src/pages/dashboard/Dashboard.module.css` (canonical), `client/src/pages/eventos/Eventos.module.css` (mirror).
