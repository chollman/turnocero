---
name: padding-system
description: CSS variables for page padding — values, where defined, and how each page type uses them
metadata:
  type: project
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

**Why:** All screens had inconsistent hardcoded paddings (16px, 24px, 28px, 4rem, etc.). Single source of truth makes global spacing changes a one-line edit.

**How to apply:** Every new page must use these variables. Never hardcode pixel padding values on `.page`, `.inner`, `.layout`, or `.container`.
