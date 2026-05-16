---
name: feedback-theme-support
description: "All new features/screens must work in both dark and light themes — use CSS variables, never hardcoded colors"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6747c813-ce6d-46b0-a687-36edc503878e
---

Every new feature, page, component, or modal must render correctly in **both dark and light themes** without further intervention.

**Why:** The app has a theme toggle in `/perfil` (Apariencia section) that switches between `:root[data-theme='dark']` (default) and `:root[data-theme='light']`. The full pass to clean hardcoded colors was painful (~30 CSS module files, multiple commits) and adding new hardcoded colors regresses the work. See [[feedback-style]] for the broader CSS Modules conventions this builds on.

**How to apply:**

1. **Never write hardcoded colors in CSS modules or JSX.** Always use CSS variables from `client/src/index.css`:
   - Backgrounds: `var(--bg-dark)`, `var(--bg-card)`, `var(--bg-elevated)`, `var(--bg-hover)`
   - Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
   - Borders: `var(--border)`, `var(--border-amber)`
   - Brand: `var(--amber)` + light/dark variants, `var(--red)`, `var(--green)`, `var(--orange)`, `var(--purple)`
   - Overlays (theme-aware tints): `var(--overlay-soft)`, `var(--overlay-medium)`, `var(--overlay-strong)`
   - Text-on-accent-bg: `var(--on-amber)` (always white — use for text/icons on amber/red/green/orange/purple buttons or badges, not literal `#fff`)
   - Opacity variants of brand colors: `--amber-10/15/20/25/30/35/40/50`, `--red-10/15/25/30`, `--green-10/15/25/30/35/40`, `--orange-10/15/25/30/45/80`, `--purple-10/15/30/40/70`. Add new opacity variants to `index.css` if you need a value that isn't there yet.

2. **Shadows with `rgba(0,0,0,X)` are theme-agnostic** and stay as literals (they work on both themes). Same for amber-tinted glow shadows like `rgba(24, 136, 239, X)` — but prefer the `--amber-NN` variants if they match.

3. **Light-mode overrides live in [client/src/index.css](client/src/index.css) under `:root[data-theme='light']`.** Adding a new background/text token? Add the dark default at `:root` AND the light override. Brand colors and red/green/orange/purple stay the same in both themes by design — only neutrals flip.

4. **Forced-dark "tool" screens (Dado, Temporizador, FingerSelector)** intentionally use `background: #000` and stay dark regardless of theme — they are fullscreen utilities. If you build a new screen with similar intent (immersive viewer, projector mode), it's OK to hardcode dark colors there. Otherwise default to theme-aware.

5. **Marketing/auth showcase areas** (e.g. `.showcase*` in [Auth.module.css](client/src/pages/auth/Auth.module.css)) intentionally use a fixed dark gradient over an image — text on them stays white. Keep that pattern when building similar "hero over image" UI.

6. **Inline colors in JSX/SVG** (Leaflet markers, inline `<svg fill="...">`, `style={{ color: ... }}`): if the color is theme-dependent, read it from CSS at runtime — `getComputedStyle(document.documentElement).getPropertyValue('--amber')` — and re-apply on theme change with a `useEffect([theme])`. See [UserProfile.jsx](client/src/pages/users/UserProfile.jsx) `buildMarkerIcon` for the pattern.

7. **Verification before shipping:** open the new screen in BOTH themes (toggle from `/perfil`) and check contrast on cards, hover states, borders, status chips, badges, and any modal/toast/dropdown the feature spawns.

The ThemeContext lives at [client/src/context/ThemeContext.jsx](client/src/context/ThemeContext.jsx); use `useTheme()` if a component genuinely needs to branch on the current theme value (rare — CSS variables handle 99% of cases).
