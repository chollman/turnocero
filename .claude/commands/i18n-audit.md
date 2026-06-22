Scan user-facing text for **hardcoded string literals** and convert them to i18n keys present in **both** `es` and `en` — across the JSX/JS in `client/src/` and the **server messages that reach the user** (the `message` strings in `httpError(...)` / `res.json({ message })` the client renders via `getErrorMessage`).

## Background

Turnocero is bilingual: Argentine Spanish (default) + English, via the `/perfil`
toggle. Every user-facing string must go through an i18n key that exists in both
languages — a hardcoded literal (in **either** language) in a user-facing
position is a bug, and a key missing its `en` (or `es`) translation is a bug too.

This **replaces** the old `/spanish-audit` (which forced hardcoded Spanish). The
convention lives in `.claude/memory/feedback_i18n_keys.md` — read it first.

- **Client:** `react-i18next`. `const { t } = useTranslation();` → `t('ns:section.key')`.
  Resources in `client/src/i18n/resources/{es,en}/<ns>.json`. Plurals via
  `_one`/`_other` + `count`; interpolation via `{{var}}`.
- **Server:** `i18next`. `req.t('errors:key')` in routes; `getFixedT(user.language)`
  for emails. Resources in `server/i18n/resources/{es,en}/<ns>.json`.
- **Formatting:** never hardcode `"es-AR"` — use `client/src/utils/locale.js`.

**In scope (must be an i18n key, es + en):**

- Visible JSX text, `placeholder` / `aria-label` / `title` attributes users read.
- Error/success strings passed to state: `setError('...')`, toast/notification copy.
- **Server messages rendered by the UI**: the `message` in `throw httpError(4xx, '...')`,
  `res.json({ message: '...' })`, and any body field the client shows (e.g. `bannedReason`).
- Hardcoded `toLocaleDateString("es-AR")` / `Intl.*("es-AR")` formatting → route through `locale.js`.

**Out of scope (leave as English literal):**

- `className`, `type`, `id`, `name`, `key`, `href`, `src`, technical `alt`.
- Console logs and comments (incl. `logger.*` on the server).
- API route strings (`'/api/tables'`), variable/function names, imports.
- Developer-only guards (`throw new Error('useX must be used within Provider')`),
  machine-readable `code` discriminators (`code: 'email_not_verified'` — the
  `message` beside it is in scope, the `code` is not), status-only responses.
- Language **endonyms** (the switcher's own "Español"/"English" labels) stay literal.

## Steps

### 1. Find candidate files

Run `git diff --name-only HEAD` (fall back to `HEAD~1 HEAD` if clean), filter for
`client/src/**/*.{jsx,js}` and `server/{routes,services,middleware}/**/*.js` plus
notification/email builders under `server/utils/**`. If invoked without recent
changes, scan all of those plus the i18n resource dirs.

### 2. Flag in each file

a) **Hardcoded user-facing literals** (Spanish OR English) in JSX text,
   `placeholder`/`aria-label`/`title`, `setError(...)`, toast/notif copy.
b) **Server messages** the client renders: `httpError(4xx, '...')`,
   `res.json({ message: '...' })` (translate the `message`, keep the `code`).
c) **Hardcoded `"es-AR"`** in `toLocale*` / `Intl.*` → should use `locale.js`.
d) **Missing translations:** an `es` key with no `en` sibling (or vice-versa).

### 3. Convert each to a key

- Pick a semantic English key under the right namespace (`ns:section.key`); add
  the value to **both** `client/src/i18n/resources/{es,en}/<ns>.json` (or the
  server equivalent). Register new namespaces in `config.js` + `index.js`.
- Replace the literal with `t('ns:key')` (client) / `req.t('ns:key')` or
  `getFixedT(lang)('key')` (server). Use `count` + `_one`/`_other` for plurals,
  `{{var}}` for interpolation.
- Keep the **es** value identical to the previous literal so the rendered Spanish
  (and existing test assertions) don't change.

### 4. Verify

- `client/src/i18n/parity.test.js` and `server/tests/unit/i18n/i18n.test.js`
  must pass (es/en key parity). Run the affected component/route tests.
- When a **server** message that a test asserts on changes, update the assertion
  in the same pass. (Server suite needs Mongo; where its binary download is
  blocked, validate i18n via a standalone node script.)
- Add `es + en + a test` for every new/migrated string (tests-required rule).

### 5. Report

- ✅ `file` — all strings already keyed, es/en in parity.
- 🔧 `file` — keyed N strings under `ns:…`; added es+en; updated M test assertions.

Group the report by side (client vs server) and call out any test assertions or
new namespaces you added.
