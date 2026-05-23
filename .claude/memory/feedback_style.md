---
name: code-style-and-workflow-preferences
description: Observed conventions and preferences from working sessions on Turnocero
metadata:
  type: feedback
---

## Commit messages must be in English
**Why:** Claudio explicitly set this as a convention in CLAUDE.md.
**How to apply:** Always write git commit messages in English regardless of what feature or text was changed.

---

## UI text and labels must be in Argentine Spanish
**Why:** The app targets Argentine board game players; Spanish is the product language.
**How to apply:** Any new user-facing string, button, label, placeholder, or error message should be in Spanish (vos/ustedes register, Argentine idiom).

---

## CSS Modules per component; use existing CSS variables
**Why:** The project uses CSS Modules consistently. Global variables (`--bg-dark`, `--amber`, `--green`, `--red`, etc.) are defined in `client/src/index.css`.
**How to apply:** Never add inline styles or global CSS for new components. Always use a `.module.css` file and reference the design tokens. See [[padding-system]] for the page padding variables.

---

## Tests are required for every new component and method
**Why:** Claudio explicitly stated (2026-05-18) that from now on every new component or method — client AND server — must ship with its corresponding tests. The test infrastructure was built up in May 2026 and the project is now at 81%+ client line coverage.
**How to apply:** See [[feedback-tests-required]] for the full convention. Lint still runs via the `/react-review` skill.

---

## New pages should use full available width
**Why:** Claudio explicitly stated this preference (2026-05-17) after the BG Watch landing was initially built with `max-width: 960px; margin: 0 auto`. He wanted it removed so the page stretches to fill `appContent`.
**How to apply:** When creating any new page's `.page` (or root wrapper) CSS, do NOT add `max-width` or `margin: 0 auto` to constrain the page container. The page should fill the available width (within `appContent`), with only the standard `--page-padding` / `--page-padding-left` / `--page-padding-mobile` for horizontal padding. Internal elements (hero text, paragraphs) may still have their own `max-width` for readability — only the outer container is unconstrained. See [[padding-system]] for the padding tokens.
