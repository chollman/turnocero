---
name: padding-system
description: "CSS variables for page padding — values, where defined, and how each page type uses them"
metadata: 
  node_type: memory
  type: project
  originSessionId: c105802a-014b-47dd-b456-9527cfc0eaa0
---

## Page padding system (standardized May 2026)

Three CSS custom properties defined in `client/src/index.css` `:root`:

```css
--page-padding: 1.5rem;       /* desktop: all directions */
--page-padding-left: 0.75rem; /* desktop: left side only (asymmetric — matches appFrame border-left: none) */
--page-padding-mobile: 0.5rem; /* mobile (≤959px): all directions */
```

### Why asymmetric left padding:
The `appFrame` overlay has `border: 0.75rem solid var(--bg-card)` with `border-left: none`, so the left side already has 0.75rem of visual frame — matching the content left padding keeps the visual rhythm consistent.

### `.container` class (used by Dashboard, TableDetail, DatabaseViewer):
```css
.container {
  margin: 0 auto;
  padding: 0 var(--page-padding) 0 var(--page-padding-left);
}
@media (max-width: 959px) {
  .container { padding: 0 var(--page-padding-mobile); }
}
```

### Pattern for pages with `.inner` or `.layout` wrapper (MeFeed, Noticias, Compartidas, UserProfile, etc.):
```css
/* desktop */
.inner { padding: 0 var(--page-padding) 0 var(--page-padding-left); }
/* mobile */
@media (max-width: 959px) {
  .page  { padding-bottom: var(--page-padding-mobile); }
  .inner { padding: 0 var(--page-padding-mobile); }
}
```

### Pattern for direct-padding pages (Notifications, Messages, UsersList):
```css
/* desktop */
.page { padding: var(--page-padding) var(--page-padding) var(--page-padding) var(--page-padding-left); }
/* mobile */
@media (max-width: 959px) {
  .page {
    padding-right: var(--page-padding-mobile);
    padding-bottom: var(--page-padding-mobile);
    padding-left: var(--page-padding-mobile);
  }
}
```

### Key invariants:
- `--navbar-h` top padding on mobile is **structural** (offsets fixed navbar) — never replace it with `--page-padding-mobile`
- Full-width banners (UserProfilePublic, TableDetail) live on `.page` with no horizontal padding; horizontal padding stays on `.inner`/`.container`
- On desktop (≥960px), top padding uses `var(--page-padding)` not `var(--navbar-h)` (navbar is not fixed on desktop)
- **Pages must fill the available width** — the sidebar already reserves its space, so the content area should expand into the rest. **Never put `max-width` + `margin: 0 auto` on `.page`, `.inner`, `.layout`, or `.container`**. The only exception is in-content elements that need a reading-width cap (e.g. a long-form article body), and those are styled inside child elements, not on the page wrapper. Caught: PanelAdmin originally shipped with `max-width: 980px` and looked narrow on wide screens — fixed by removing the cap.

**Why:** All screens had inconsistent hardcoded paddings (16px, 24px, 28px, 4rem, etc.). Single source of truth makes global spacing changes a one-line edit. Full-width also keeps the visual rhythm with the rest of the app.

**How to apply:** Every new page must use these variables. Never hardcode pixel padding values on `.page`, `.inner`, `.layout`, or `.container`, and never cap their width.
