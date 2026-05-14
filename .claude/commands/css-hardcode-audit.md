Scan all CSS module files in `client/src/` for hardcoded color values and replace them with the correct CSS variables from the design system.

## Background

All colors in Turnocero must come from CSS variables defined in `client/src/index.css`. Hardcoded hex, rgb, rgba, or hsl values bypass the theme and will break if the design ever changes.

**Canonical CSS variables (read `client/src/index.css` to get the current full list):**

Key variables include: `--bg-dark`, `--bg-card`, `--bg-hover`, `--amber`, `--amber-dim`, `--amber-glow`, `--green`, `--red`, `--text-primary`, `--text-muted`, `--text-dim`, `--border`, `--border-light`, `--shadow`, etc.

**In scope — must use variables:**
- `color:`, `background:`, `background-color:`
- `border-color:`, `border:` (the color part)
- `box-shadow:` (color parts)
- `outline-color:`
- CSS custom property definitions that duplicate existing vars

**Out of scope — hardcoded values are acceptable:**
- `border-radius`, `padding`, `margin`, `width`, `height`, `font-size`, `z-index`, `opacity` (unless it's a theme value)
- `transparent`, `inherit`, `currentColor`
- `0 0 0` in box-shadow offsets (not a color)
- Gradient stops that are intentionally unique one-off values
- `#000`, `#fff`, `white`, `black` used as pure overlays/masks with explicit opacity

## Steps

### 1. Read the design system

Read `client/src/index.css` in full. Extract all CSS custom property names and their values from the `:root` block. This is the authoritative list.

### 2. Find candidate files

- If invoked after changes: use `git diff --name-only HEAD` and filter for `client/src/**/*.module.css`
- If invoked standalone: scan all `client/src/**/*.module.css`

### 3. For each CSS file, find hardcoded color values

Look for patterns like:
- `#[0-9a-fA-F]{3,8}` (hex colors)
- `rgb(`, `rgba(`, `hsl(`, `hsla(`
- Named colors: `red`, `green`, `blue`, `white`, `black`, `gray`, `orange`, `yellow`, `purple` (only when used as a color value, not in a class name)

For each match, check if it's in scope (color property) and not in the exceptions list.

### 4. Map each hardcoded value to the correct variable

Compare the hardcoded value against the design system values extracted in step 1. Find the closest semantic match:
- Dark backgrounds → `var(--bg-dark)` or `var(--bg-card)` or `var(--bg-hover)`
- Gold/amber tones → `var(--amber)` or `var(--amber-dim)`
- Success/join states → `var(--green)`
- Error/cancel states → `var(--red)`
- Body text → `var(--text-primary)`
- Secondary text → `var(--text-muted)` or `var(--text-dim)`
- Borders → `var(--border)` or `var(--border-light)`

If there is no exact match and the value is genuinely unique, leave it as-is and note it in the report.

### 5. Apply fixes

Replace each hardcoded value with the corresponding variable. Do not change layout, spacing, or non-color properties.

### 6. Report

- ✅ `Component.module.css` — all values use CSS variables
- 🔧 `Component.module.css` — replaced N values: [brief list]
- ⚠️ `Component.module.css` — N values have no matching variable and were left as-is: [list them]
