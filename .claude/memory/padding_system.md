---
name: padding-system
description: "Page layout standard — padding variables, full-width rule (no max-width caps, even long-form/legal), editorial hero header; CSS variables for page padding — values, where defined, and how each page type uses them"
metadata:
  node_type: memory
  type: project
  originSessionId: c105802a-014b-47dd-b456-9527cfc0eaa0
---

## Page padding system (standardized May 2026)

Three CSS custom properties defined in `client/src/index.css` `:root`:

```css
--page-padding: 1.5rem; /* desktop: all directions */
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
  .container {
    padding: 0 var(--page-padding-mobile);
  }
}
```

### Pattern for pages with `.inner` or `.layout` wrapper (MeFeed, Noticias, Compartidas, UserProfile, etc.):

```css
/* desktop */
.inner {
  padding: 0 var(--page-padding) 0 var(--page-padding-left);
}
/* mobile */
@media (max-width: 959px) {
  .page {
    padding-bottom: var(--page-padding-mobile);
  }
  .inner {
    padding: 0 var(--page-padding-mobile);
  }
}
```

### Pattern for direct-padding pages (Notifications, Messages, UsersList):

```css
/* desktop */
.page {
  padding: var(--page-padding) var(--page-padding) var(--page-padding)
    var(--page-padding-left);
}
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
- **Match the rest of the app's width — never ship an outlier.** The sidebar already reserves its space; content expands into the rest, and `+ var(--sidebar-freed)` lets it reclaim space when the sidebar collapses. Two cases:
  - **Listing / grid / form / content pages** use a content cap of `max-width: calc(1180–1200px + var(--sidebar-freed))` + `margin: 0 auto` on the wrapper (`.page`/`.inner`/`.layout`): Dashboard & Eventos `1200`, Compartidas & Noticias listing & NoticiaForm `1180`. A new screen must adopt the width its section already uses. **Caught (2026-06-17):** `NoticiaForm` (`/noticias/crear` + `/editar`) shipped at a narrow `820px` column — widened to `1180` to match the Noticias listing.
  - **Long-form reading & admin pages** (legal `pages/legal/`, PanelAdmin) use **NO cap** (fill width) — a narrow cap looked bad with no grid to justify it (PanelAdmin was `980`, legal `820`, both un-capped 2026-06-01). The `820/980` anti-pattern is the lesson: don't cap a reading page narrow, and don't cap a content/form page narrower than its section.
- **Standard page header (editorial hero)** — new top-level screens open with the hero pattern from Dashboard/Eventos/Colaborar/legal: a `--font-mono` uppercase eyebrow with a leading `<Meeple/>` + short rule, a `clamp()` title (`--font-display` generically; a section may theme it — Noticias keeps `--font-serif` to match its newspaper masthead + serif article body), an optional meta line (`--text-muted`), all in a `<header>` with `border-bottom: 1px solid var(--border)`. On **form / sub-pages reached via a back link** (e.g. NoticiaForm), the `<BackButton flush>` sits ABOVE the `<header>` as a sibling — the column wrapper's `gap` separates them — not inside it. **Gotcha:** the header wrapper MUST be `display: flex; flex-direction: column` — a plain `block` lets the inline-flex BackButton + inline-flex eyebrow collapse onto one line (the `.header`/`.hero` rule was simply missing in NoticiaForm and they overlapped).

**Why:** All screens had inconsistent hardcoded paddings (16px, 24px, 28px, 4rem, etc.). Single source of truth makes global spacing changes a one-line edit. Full-width also keeps the visual rhythm with the rest of the app.

**How to apply:** Every new page must use these variables. Never hardcode pixel padding values on `.page`, `.inner`, `.layout`, or `.container`, and never cap their width.
