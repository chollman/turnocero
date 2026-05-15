---
name: skeleton-pattern
description: Skeleton shimmer pattern used across all loading states — files created, CSS variables, and which screens still need it
metadata:
  type: project
---

## Skeleton shimmer standard

All loading states use shimmer skeleton components — no spinners, no "Cargando…" text, no dado 🎲 emoji.

### CSS animation pattern (copy exactly into each `*.module.css`):
```css
@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
/* apply to each bone: */
background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%);
background-size: 400% 100%;
animation: shimmer 1.6s ease-in-out infinite;
```

### Rules:
- Each skeleton component: `<Name>Skeleton.jsx` + `<Name>Skeleton.module.css` alongside the real component
- Wrapper always has `aria-hidden="true"`
- Colors use only `var(--bg-elevated)` and `var(--bg-hover)` — never hardcoded
- Skeleton replicates the visual structure (dimensions, border-radius) of the real content

### Screens implemented:
| Component | Skeleton file | Notes |
|-----------|--------------|-------|
| Compartidas | `CompartidaSkeleton.jsx` | reference implementation, existed before this work |
| Noticias | inline in `Noticias.module.css` | existed before |
| NoticiaDetail | inline skeleton | existed before |
| CompartidaPost | reuses `CompartidaSkeleton` | replaced inline spinner |
| MeFeed | `FeedCardSkeleton.jsx` | `pages/me/` |
| UsersList | `UsersListSkeleton.jsx` | `pages/users/` |
| Dashboard | `TableCardSkeleton.jsx` | `pages/dashboard/`, 9 skeletons in grid |
| UserProfilePublic | `ProfileSkeleton.jsx` | `pages/users/`, full-page early return |
| TableDetail | `TableDetailSkeleton.jsx` | `pages/tables/`, full-page early return |
| DatabaseViewer | `DatabaseSkeleton.jsx` | `pages/admin/`, inline replace |

### Skipped / still pending:
- **BggProfile** (`pages/bgg/`) — skipped by user request; still shows 🎲 per tab

**Why:** Visual consistency — skeleton loaders communicate content shape during load, spinners don't. Established during padding+skeleton standardization sprint (May 2026).

**How to apply:** Any new page that fetches data should get a skeleton from day one. Match structure to real content. For early-return loading states use `return <XyzSkeleton />`. For inline loading use the ternary pattern.
