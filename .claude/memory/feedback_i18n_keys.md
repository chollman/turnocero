---
name: feedback-i18n-keys
description: All user-facing text goes through i18n keys (es + en), never hardcoded literals — react-i18next (client) + i18next (server)
metadata:
  type: feedback
---

## Convention (since 2026-06-22): all user-facing text uses i18n keys, es + en

**Why:** Turnocero is now bilingual (Argentine Spanish default + English via the
`/perfil` toggle). The old rule "hardcode everything in Argentine Spanish" is
**superseded**. New code must route every user-facing string through an i18n key
present in **both** `es` and `en`. This replaces `/spanish-audit` with
`/i18n-audit`.

**Golden rule:** a string a user reads → an i18n key (es + en). A string only a
developer reads (logs, comments, code identifiers) → English literal, as before.

### Client — react-i18next

- Stack: `i18next` + `react-i18next`, initialized in [client/src/i18n/index.js](../../client/src/i18n/index.js); config (langs/namespaces) in [client/src/i18n/config.js](../../client/src/i18n/config.js).
- In components: `const { t } = useTranslation();` then `t('ns:section.key')`.
- Resources: `client/src/i18n/resources/{es,en}/<ns>.json`, one file per domain
  namespace (`common`, `auth`, … add more per section). Default ns = `common`.
- **Key naming:** `namespace:section.key`, keys are **semantic English**, never
  the Spanish text as the key.
- **Interpolation:** `t('k', { name })` with `{{name}}` in the JSON.
- **Plurals:** `_one`/`_other` suffixes keyed off a `count` var
  (e.g. `tablesCount_one`/`tablesCount_other`, called with `{ count }`).
- **Embedded markup:** `<Trans i18nKey="...">` (rare; prefer splitting into keys).
- **Endonyms** (the language switcher's own "Español"/"English" labels) stay
  literal — they are shown in their own language regardless of UI language.
- `LanguageContext` ([client/src/context/LanguageContext.jsx](../../client/src/context/LanguageContext.jsx))
  is the app-facing wrapper (mirrors ThemeContext): persists to `localStorage`
  (`STORAGE_KEYS.LANGUAGE`), sets `<html lang>`, sets axios `Accept-Language`,
  and calls `i18n.changeLanguage`.

### Server — i18next

- Stack: `i18next` + `i18next-http-middleware`, init in [server/i18n/index.js](../../server/i18n/index.js).
- Per request: the middleware (mounted in `app.js` before routes) reads
  `Accept-Language` and attaches `req.t` / `req.language`. Use
  `throw httpError(4xx, req.t('errors:key'))` and `res.json({ message: req.t('success:key') })`.
- `express-validator`: pass the **key** to `.withMessage('validation:key')` and
  resolve it once in the shared `checkValidation(req)` helper via `req.t(...)`.
- Request-less content (emails, cron/push): use `getFixedT(user.language, ns)` —
  localize by the **recipient's** stored `User.language`, not the request locale.
- Resources: `server/i18n/resources/{es,en}/<ns>.json` (`errors`, `validation`,
  `email`, `success`).

### Formatting (numbers / dates) — NOT text

- Never hardcode `"es-AR"`. Use [client/src/utils/locale.js](../../client/src/utils/locale.js):
  `getLocale()`, `formatNumber()`, `formatDate()`, `formatTime()` (they read the
  active language). Units like `km`/`m` are universal SI — no translation key,
  just the locale's decimal separator.

### URLs stay Spanish

Routing slugs (`/mesas`, `/torneos`, `/recuperar-contrasenia`, …) are **not**
translated — only display text is. See CLAUDE.md → "Frontend routing".

### Tests

- The test setups initialize the **real `es` resources** (client:
  `src/test/setup.js` imports `../i18n`; server: i18n inits at require time), so
  existing Spanish assertions stay green when a string becomes a key — the `es`
  value carries the same copy. Components assert without a provider via the
  global i18n singleton.
- For language-specific behavior, switch with `i18n.changeLanguage('en')` and
  reset in `afterEach`.
- **Key parity is enforced:** `client/src/i18n/parity.test.js` +
  `server/tests/unit/i18n/i18n.test.js` assert identical `es`/`en` key sets per
  namespace. Every new/migrated string ships **es + en + a test** in the same
  change (the tests-required rule still applies).

### Migration status (rollout)

Infra + pilots landed via a stacked PR chain (2026-06-22): client/server i18n
infra, `locale.js`, `common` + `auth` namespaces (password-recovery pages),
`User.language`, and the `/perfil` toggle. The **bulk migration is incremental**
— one section/namespace per change (mesas, torneos, eventos, notifs via
`notifDomains.js`, the rest of auth, server route/email strings). Use
`/i18n-audit` to find hardcoded strings and missing `en` keys. Plan:
[plans/app-i18n.md] (see the approved plan / session).

**Known sandbox gotcha:** server vitest can't run where the `mongodb-memory-server`
binary download is blocked (`fastdl.mongodb.org` → 403). Validate server i18n via
a standalone node script there; run the full server suite where Mongo is available.
