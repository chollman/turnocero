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

## Don't reintegrate BGG API without solving CORS first
**Why:** Multiple PRs (#13–#21) were built and then fully reverted (#22) because the BoardGameGeek API blocked all proxy and client-side fetch approaches. Significant time was wasted.
**How to apply:** If Claudio asks about game search or BGG again, flag the unresolved CORS issue before writing any code.

---

## CSS Modules per component; use existing CSS variables
**Why:** The project uses CSS Modules consistently. Global variables (`--bg-dark`, `--amber`, `--green`, `--red`, etc.) are defined in `client/src/index.css`.
**How to apply:** Never add inline styles or global CSS for new components. Always use a `.module.css` file and reference the design tokens. See [[padding-system]] for the page padding variables.

---

## No test suite; lint via `/react-review` skill
**Why:** The project has no test suite. ESLint was added (PR #24) as a pre-commit hook via the `/react-review` skill, but there's no `npm test`.
**How to apply:** Don't suggest running tests. For code quality, use the `/react-review` skill which runs ESLint on changed React files.

---

## New pages should use full available width
**Why:** Claudio explicitly stated this preference (2026-05-17) after the BG Watch landing was initially built with `max-width: 960px; margin: 0 auto`. He wanted it removed so the page stretches to fill `appContent`.
**How to apply:** When creating any new page's `.page` (or root wrapper) CSS, do NOT add `max-width` or `margin: 0 auto` to constrain the page container. The page should fill the available width (within `appContent`), with only the standard `--page-padding` / `--page-padding-left` / `--page-padding-mobile` for horizontal padding. Internal elements (hero text, paragraphs) may still have their own `max-width` for readability — only the outer container is unconstrained. See [[padding-system]] for the padding tokens.
