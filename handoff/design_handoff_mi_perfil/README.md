# Handoff: Mi Perfil (Private Profile / Account Settings) — Reimagined

## Overview
This is a redesign of TurnoCero's **private profile / account settings page** (`/perfil`,
implemented in `client/src/pages/users/UserProfile.jsx`). It is the page a logged-in user
sees to manage **their own** account — not the public profile other users see.

The reimagining reframes the page as an **"account console"**: a single scrollable column of
settings sections accompanied by a **sticky index rail on the right** (section navigation +
Save button), an identity header at the top, and a prominent **BG Watch / BoardGameGeek
connection** surface.

> ⚠️ **Scope note:** This handoff covers the *private* profile. The public profile
> (`UserProfilePublic.jsx`, route `/usuarios/:id`) was prototyped separately in
> `Perfil Reimagined.html` and is **not** part of this package.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — a
prototype showing the intended look and behavior. They are **not** production code to copy
directly. The Babel-in-browser setup, the inline `tweaks-panel.jsx`, and the mock data are
prototype scaffolding.

The task is to **recreate this design inside the existing TurnoCero client codebase**
(React + CSS Modules — the original is `UserProfile.jsx` + `UserProfile.module.css`), reusing
its established patterns: React Router, `axios`, the `useCommunity` context, the `Meeple`/
`Avatar` shared components, toast/notification helpers, and the existing API endpoints. Wire
the new layout to the **real** data and handlers already present in `UserProfile.jsx` — do not
re-implement the backend calls from the mock.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interaction states are
all specified below and pulled from the shared TurnoCero design tokens (`tc-design.css`, which
mirrors the app's real CSS variables). Recreate the UI pixel-faithfully using the codebase's
CSS Modules. Where the mock uses placeholder content (a fake user, a map placeholder), swap in
the real data/components.

---

## Layout

### Page shell
- Centered column, `max-width: 1120px`, page padding from the app's `--page-padding`
  (the mock uses `padding-top: 26px`).
- Dark theme background: `--bg-dark (#0a0d15)` with two faint radial accent glows
  (top-right blue `rgba(24,136,239,0.06)`, bottom-left cyan `rgba(0,174,255,0.04)`).

### Identity header (`.acctHead`)
- Horizontal flex row, `gap: 18px`, `padding-bottom: 22px`, bottom border `1px solid --border`,
  `margin-bottom: 26px`.
- **Avatar tile** `76×76`, `border-radius: 22px`, user color background (or `--bg-elevated`
  with an image icon when a photo is set), white initial `Poppins 800 / 32px`,
  shadow `0 10px 26px rgba(0,0,0,0.4)`.
- **Identity block**: eyebrow `◆ Mi perfil` (mono 11px, `--accent-light`, letter-spacing
  0.16em, uppercase); name `@username` (Poppins 700, `clamp(1.7rem,4vw,2.4rem)`,
  letter-spacing -0.045em); a **BG Watch chip** appears next to the name when BGG is connected
  (mono 10px, `--purple` text, `--purple-10` bg, `--purple-25` border, pill, green ✓).
  Email line below in mono 12.5px `--text-muted`.

### Main layout (`.acctLayout`)
- CSS grid, **`grid-template-columns: 1fr 234px`** (content left, **rail right**),
  `gap: 30px`, `align-items: start`.
- DOM order: content column first, rail second.
- **Responsive ≤920px**: collapses to one column (`1fr`); the rail loses `position: sticky`
  and is reordered **above** the content (`order: -1`) and becomes a horizontal wrapped nav.
- **Responsive ≤560px**: page padding `18px 14px 90px`; two-column form rows stack;
  the BGG connect form stacks; BGG status grid becomes one column.

### Right rail (`.railWrap`)
- `position: sticky; top: 76px`, vertical flex `gap: 18px`.
- **Nav card** (`.railNav`): `--bg-paper` bg, `1px solid --border`, `border-radius: 14px`,
  `padding: 8px`. Each item (`.railItem`) is a full-width button, mono 11.5px, with a 6px
  leading dot; hover → `--bg-elevated`; **active → `--accent-glow` bg, `--accent-light` text**
  (active state driven by scrollspy).
- **Save button** (`.railSave`): full-width, `--accent` bg, white, Poppins 700 13px,
  `border-radius: 11px`, shadow `0 6px 18px --accent-glow`; hover lifts `-1px`; disabled
  shows "Guardando…". A `✓ Perfil guardado` confirmation (`--green`, mono 11px) appears for
  ~2.5s after save.

---

## Sections (top → bottom of the content column)

Each section is a `.sec` card: `--bg-paper` bg, `1px solid --border`,
`border-radius: 16px`, `padding: 22px 24px`, `scroll-margin-top: 84px`, and an `id` used by
both the rail jump and the scrollspy. Header = `.secNum` (mono 10px `--text-faint`, e.g. `01`)
+ `.secTitle` (Poppins 700 ~1.05rem). Optional `.secHint` description (13px `--text-secondary`,
`max-width: 560px`).

**Above the sections**, one of two banners renders:
- **Connected → BG Watch band** (`.bgwBand`): purple-tinted card (`--purple-25` border,
  radial purple glow), 3-col grid: a 54px gradient avatar with a die badge, info block
  (`@bggUser`, "Conectado a BoardGameGeek" with a pulsing green dot), and right-aligned stats
  (Partidas / Colección counts) + "Ver completo →". Hover lifts `-2px`, border → `--purple`.
- **No BGG username yet → promo banner** (`.promo`): dashed `--purple-25` border, dice icon,
  "¿Llevás partidas en BoardGameGeek?" copy, an "Activá ahora →" CTA that scroll-jumps to the
  BGG section, and a dismiss ✕.

| # | id | Title | Contents |
|---|-----|-------|----------|
| 01 | `apariencia` | Apariencia | Theme toggle (segmented Oscuro / Claro with moon/sun icons). Stored per-device. |
| 02 | `notificaciones` | Notificaciones push | Single button whose state depends on permission: **Activar** (primary), **Desactivar** (ghost) when on, or disabled copy for `denied` / `unsupported`. |
| 03 | `avatar` | Avatar | 88px avatar preview + "Subir/Cambiar avatar" (and "Quitar avatar" when set). When no photo: a color-swatch picker (AUTO + 6 brand colors) for the initial's background. |
| 04 | `datos` | Información personal | `displayName` (full-width) + `nombre`/`apellido` (two-col). |
| 05 | `contacto` | Contacto | `telegram` (with `@` prefix) + `celular` (two-col), `bggUsername` (with `BGG` prefix). |
| 06 | `bgg` | Conexión con BoardGameGeek | **The key stateful panel — see below.** |
| 07 | `comunidades` | Comunidades | List of communities, each row: a "ver juntas" checkbox, a "Skin" radio (which community's theme to apply), and a "Salir" button (hidden for the base Turnocero community). |
| 08 | `ubicacion` | Dirección | Address autocomplete input + "Buscar", a coords readout, and an interactive map (placeholder in the mock — use the codebase's real map component). |
| 09 | `recordatorios` | Recordatorios de eventos | Select: 24h before / 2h before / none. |

### BGG connection panel (section 06) — state machine
The single most important interactive surface. Four states (driven in the real app by the
user's stored BGG credentials/session):

- **`none`** (no BGG username saved): prompt to fill "Usuario en BGG" above and save first.
- **`disconnected`** (username saved, no active session): a connect form — BGG password input
  with a VER/OCULTAR toggle + "Conectar" button.
- **`connected`**: a 2×2 status grid (Conectado como / Desde / Última reconciliación / Última
  verificación), a sync hint, and actions: **"Reconciliar todo"** (primary, shows
  "Reconciliando…" then a success toast) + **"Desconectar"** (ghost).
- **`invalid`** (session expired — e.g. BGG password changed): a red notice explaining the
  session caducó + the password form relabeled "Reconectar".

Always-present **warning** (`.bggWarn`, orange): explains the integration uses BGG's
unofficial internal endpoint and may break if BGG changes their site.

---

## Interactions & Behavior
- **Rail jump**: clicking a rail item smooth-scrolls to the section. ⚠️ Native
  `scrollTo({behavior:'smooth'})` is ignored inside some embeds, so the mock animates scroll
  manually via `requestAnimationFrame` over **420ms** with an ease-in-out cubic. Offset target
  by **-80px** for the sticky navbar. In the real app, native smooth-scroll + `scroll-margin-top`
  is usually fine — keep the rAF fallback only if you hit the same embed issue.
- **Scrollspy**: on scroll, the active rail item = the last section whose top is `≤ 120px`.
- **Theme toggle**: instant, persisted per device (localStorage in the real app).
- **Push button**: triggers the browser Notification permission flow; reflect
  granted/denied/unsupported.
- **Save**: the rail Save button persists the whole form (one request in the real app),
  shows "Guardando…" then a ✓ confirmation for ~2.5s.
- **BGG connect/disconnect/reconcile**: each calls its real endpoint; show inline
  busy/disabled states and success/error toasts.
- **Promo dismiss / CTA**: ✕ hides the promo; "Activá ahora →" scroll-jumps to section 06.
- **Transitions**: interactive elements use `--t` = `0.2s ease`. Section entrance is a 10px
  upward slide over `0.45s` (`opacity:1` at rest — never gate visibility on the animation, so
  content shows even if the animation timeline is paused). Respect
  `prefers-reduced-motion: reduce` (disable the entrance).

## State Management
Reuse what `UserProfile.jsx` already has. The shape the mock models:
- **Form**: `displayName, nombre, apellido, telegram, celular, bggUsername, direccionTexto,
  lat, lng`, plus `avatarColor` and the avatar photo.
- **Device prefs**: `theme` (dark/light), push permission state.
- **BGG**: connection state (`none | disconnected | connected | invalid`) + last
  reconcile/probe timestamps; transient password input + show/hide.
- **Communities** (from `useCommunity`): set of "view together" ids, the selected "skin"
  community id, leave actions.
- **UI**: active section (scrollspy), saving/saved flags, promo dismissed.

## Design Tokens
From `tc-design.css` (the app's real CSS variables). Key values used on this page:

**Backgrounds:** `--bg-dark #0a0d15` · `--bg-deep #050810` · `--bg-card #151c28` ·
`--bg-elevated #1d2532` · `--bg-paper #18202f`

**Accent (blue):** `--accent #1888ef` · `--accent-light #00aeff` · `--accent-dark #0076d1` ·
`--accent-glow rgba(24,136,239,0.18)` · `--border-accent rgba(24,136,239,0.4)`

**Text:** `--text-primary #ffffff` · `--text-secondary #a8b4cc` · `--text-muted #5a6178` ·
`--text-faint #353d52`

**Borders:** `--border #1e2a3d` · `--border-strong #2a3a55`

**Status / semantic:** `--red #f31d77` · `--green #00d984` · `--orange #f5a623`
(used for the BGG warning) · `--purple #b48cff` (BG Watch) · `--gold #ffd700`.
Each has `-10` (10% alpha) and `-25` (~25–30% alpha) tint variants, e.g.
`--purple-10 rgba(180,140,255,0.1)`, `--purple-25 rgba(180,140,255,0.3)`,
`--green-10/25`, `--red-10/25`, `--orange-10/25`, `--gold-10/25`.

**Avatar swatch palette:** `#1888ef, #f5a623, #b48cff, #00d984, #f31d77, #00aeff` (+ AUTO).

**Typography:**
- `--font-display: 'Poppins'` — names, section/card titles, stat numbers, buttons (600–800).
- `--font-body: 'Archivo'` — body copy, form inputs, hints.
- `--font-mono: 'JetBrains Mono'` — eyebrows, labels, section numbers, rail items, status
  pills (uppercase, letter-spacing 0.06–0.16em).
- Google Fonts imported in the HTML head: Poppins 500–800, Archivo 400–700, JetBrains Mono
  400–600.

**Radii:** inputs/buttons `10px` · cards/sections `16px` · rail nav `14px` ·
avatar tiles `22–24px` · pills `999px` · small badges `5–7px`.

**Spacing:** section card padding `22px 24px`; content column gap `18px`; layout gap `30px`;
form field gap `16px`; two-col grid gap `14px`.

**Shadows:** primary button `0 4px 14px --accent-glow` · save button `0 6px 18px --accent-glow`
· avatar tile `0 10px 26px rgba(0,0,0,0.4)`.

**Transition:** `--t: 0.2s ease`.

**Focus state (inputs):** `border-color: --accent` + `box-shadow: 0 0 0 3px --accent-glow`.

## Assets
- **No raster assets.** All icons are inline SVG (see `tc-shared.jsx` for the shared `Icon`
  set; the moon/sun/bell icons are defined locally in `cuenta-app.jsx`).
- **Fonts**: Poppins, Archivo, JetBrains Mono via Google Fonts.
- The **map** is a CSS placeholder in the mock — use the real map component already in the
  TurnoCero codebase.
- Avatar = user initial on a color, or an uploaded photo (existing `Avatar`/`Meeple`
  components).

## Files in this bundle
- `Mi Perfil Reimagined.html` — entry point; open in a browser to view the prototype.
- `cuenta-app.jsx` — the React component tree (identity header, rail, all 9 sections, BGG
  state machine, tweaks). **Primary reference.**
- `cuenta-styles.css` — all page-specific styles (class names referenced throughout this doc).
- `tc-design.css` — shared design tokens + primitives (the source of truth for the variables).
- `tc-shared.jsx` — shared `Icon` set, `Switcher` chrome, small utilities.
- `tweaks-panel.jsx` — prototype-only control panel (not part of the production design).

### Original source files (in the main TurnoCero client, for reference)
- `client/src/pages/users/UserProfile.jsx` — the real private-profile page (data + handlers).
- `client/src/pages/users/UserProfile.module.css`
- `client/src/pages/users/MiBgWatchCard.jsx`, `CommunityPrefs.jsx` — existing sub-components.

## Tweaks panel (prototype only — ignore for production)
The floating "Tweaks" panel lets a reviewer flip states to see every variation:
- **Conexión BGG**: Sin usuario / Sin conectar / Conectado / Caducó.
- **Tiene foto de avatar**: toggles photo vs. colored initial.
- **Push**: Disponible / Bloqueado / No soporta.
- **Tema**: Oscuro / Claro.
These exist purely to demo states; they are not features to build.
