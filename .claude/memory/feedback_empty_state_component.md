---
name: feedback-empty-state-component
description: "Use the shared <EmptyState> for all \"no data / no results\" views — never ad-hoc .empty divs + emoji"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 284df98d-3f1e-41c5-98c2-a95b8bae69f8
---

Since 2026-06-04 (handoff `design_handoff_empty_states`), all empty states use the shared
`<EmptyState>` in [client/src/components/shared/EmptyState.jsx](client/src/components/shared/EmptyState.jsx).
Illustrations live in `EmptyArt.jsx` (ArtMesa/Evento/Torneo/Compartida/Comunidad/Notif/Noticia/Search),
ghost skeletons in `EmptyGhosts.jsx` (GhostMesa/Rows/Polaroids/Members).

**Why:** the old pattern (emoji 🎲/📰/👥 + one centered line) looked poor and wasted space.

**How to apply:**
- Two variants — `first` (illustration + ghost previews behind + CTA, invites to create) and
  `filtered` (compact, `ArtSearch`, chips + "Limpiar filtros", NO ghosts). Detect which by whether a
  search/filter is active; if the base dataset is empty → `first`.
- Props: `variant`, `art`, `ghost` (only `first`), `eyebrow` (string — gets a `<Meeple>` bullet in
  `first`), `title`/`hint` (ReactNode — wrap accent words in `<em>` for cyan), `text`,
  `primary`/`secondary` (`{ label, icon, to | onClick }` — `to` → `<Link>`, else button; `icon` is a
  keyword `'plus'|'compass'|'clear'|'search'`, a node, or null), `chips` (`[{ label, count, onClick }]`),
  `compact`.
- Gate the primary CTA by permission (isAdmin/host/user) exactly like the old code did.
- SVG illustrations use CSS vars (`var(--amber)`, `var(--bg-card)`, …) so they work in both themes;
  brand-material literals (felt green, polaroid cream, trophy gold) stay literal on purpose. SVG presentation
  attributes accept `var(--x)` (same as [ErrorScreen.jsx](client/src/pages/error/ErrorScreen.jsx)).
- **Data-driven chips** (the user's choice): show real chips with live counts ONLY where the page tracks
  per-filter counts client-side (Notifications builds them from its `counts` map; MeFeed `/mi` derives them
  from its `countFor` helper; Dashboard derives `open`/`public` counts from the loaded page). Server-side-filtered
  pages (Eventos/Torneos/Compartidas/UsersList) just show "Limpiar filtros" — do NOT fabricate chips.
- Migrated views (2026-06-04): Dashboard, Eventos, Torneos, Compartidas, UsersList (Comunidad), Noticias,
  Notifications, **MeFeed `/mi`** (ArtMesa + GhostRows for first-run; ArtSearch + `countFor`-based chips for filtered).
- Gotcha: the title's `<em>` splits text across nodes, so `getByText("full title")` fails in tests —
  assert on the no-`<em>` body `text` instead, or on a button's accessible name.
- Narrow embedded empties (EventoInscripciones triage columns, CompartidasSidebar widget) were intentionally
  left compact — the full illustrated EmptyState doesn't fit there. Related: [[padding_system]], [[skeleton_pattern]],
  [[feedback_primary_cta_pattern]], [[feedback_meeple_brand_bullet]].
