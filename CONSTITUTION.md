# Project Constitution — Turnocero

This file is the foundation of rules that always apply when working on this codebase.
`CLAUDE.md` explains *how the app is built*; this file states *what must always hold true*,
regardless of which feature is being touched. When a rule here conflicts with expedience
("just this once"), the rule wins — raise it with the user instead of quietly bypassing it.

Deeper rationale and history for most of these live in `.claude/memory/feedback_*.md`
(referenced inline below). If a rule here and its memory file ever disagree, this file wins —
update the memory file to match, don't silently follow the stale one.

## 1. Process

- **Tests ship with every change**, client and server, in the same commit — new component, route,
  hook, util, or method. Bug fixes get a regression test that fails before the fix and passes
  after. No exceptions for "small" additions. (`feedback_tests_required.md`)
- **Every new top-level section or cross-cutting feature is plumbed through `SiteConfig`**:
  `SECTION_KEYS`, `requireSection` middleware, `<SectionGate>`, and a toggle in `/panel-admin`.
  (`feedback_panel_admin_toggles.md`)
- **Admin-only UI must respect "view as user"** — use `isActuallyAdmin` only for structural admin
  pages; everything else reads the effective `user.isAdmin` so the preview is faithful.
  (`feedback_admin_view_as_user.md`)
- Commit messages are in **English**, regardless of the UI language.
- Plans go in the repo's `plans/` folder, never `~/.claude/plans/`. (`feedback_plans_location.md`)
- Never work inside `.claude/worktrees/` — use feature branches in the main working copy.
  (`feedback_no_worktrees.md`)

## 2. Internationalization

- **All user-facing strings go through i18n keys present in both `es` and `en`** — a hardcoded
  literal in either language is a bug, not a style nit. Client: `react-i18next`
  (`t('ns:section.key')`). Server: `i18next` (`req.t('errors:key')`). (`feedback_i18n_keys.md`)
- Never hardcode `"es-AR"` or a raw `Intl` call — use `client/src/utils/locale.js`
  (`getLocale`, `formatNumber`, `formatDate`, `formatTime`).
- Routing slugs stay Spanish always (see CLAUDE.md → "Frontend routing") — only *display* text is
  translated.
- Run `/i18n-audit` before shipping any feature that adds or changes user-facing strings.

## 3. Theming & responsive layout

- **Every feature must work in both dark and light theme** using the CSS variable tokens in
  `client/src/index.css` — never a hardcoded color. (`feedback_theme_support.md`) Forced-dark
  "tool" screens (`/utilidades/*`) are the deliberate exception — keep them ignoring the active
  theme.
- **Use the canonical breakpoint tokens**, never a raw px, for any shared layout transition:
  `--desktop`/`--below-desktop` (960px, the sidebar⟷drawer split), `--tablet` (880px), `--phone`
  (600px), `--compact` (480px). Run `npm run lint:breakpoints` before committing CSS changes.
  (`feedback_canonical_breakpoints.md`)
- Gaps between stacked widgets/panels/cards/feeds/lists use `--gap-widgets`, not an ad-hoc px
  value. (`feedback_widget_panel_gap.md`)
- No icon libraries are installed (`lucide-react`, `react-icons`, `@heroicons` — none of them).
  Use inline SVG (see the Sidebar `ICONS` pattern) or emoji. (`feedback_inline_svg_icons.md`)

## 4. Shared components — reuse, don't reinvent

- `<Avatar user={...} size="..."/>` for every user avatar. Never render
  `username[0].toUpperCase()` by hand. (`feedback_deleted_user.md`, CLAUDE.md → "User avatars")
- `<BackButton>` for every "volver" control — don't create a new `.backBtn`/`.back`/`.backLink`.
  (`feedback_back_button_shared.md`)
- `<Modal>` (portal-based, focus-trapped) for every full-screen overlay — never an inline
  `position: fixed` overlay, and watch for ancestors with `overflow: clip` /
  `will-change: transform` that would clip a non-portaled backdrop. (`feedback_shared_modal.md`,
  `feedback_modal_portal_required.md`)
- `<EmptyState>` for every empty view — no ad-hoc `.empty` + emoji.
  (`feedback_empty_state_component.md`)
- Errors from `PUT`/`POST`/`DELETE` calls surface via `addToast({ type: 'error' })`, not a local
  `actionError` state variable. (`feedback_errors_as_toasts.md`)
- Any input whose value feeds a fetch uses `useDebouncedValue` (300ms default, 500ms for
  expensive calls) instead of a hand-rolled `setTimeout`/`useRef`. (`feedback_debounce_inputs.md`)
- Primary amber CTA buttons (`btn|cta|fab|submit`) follow the shared shadow/hover spec — don't
  invent a new shadow value. (`feedback_primary_cta_pattern.md`)
- Before building a new hook/util, check the shared catalogs (`feedback_shared_form_components.md`,
  `feedback_shared_helpers_catalog.md`) — it likely already exists.

## 5. Server architecture

- Business logic lives in `server/services/`; routers are thin HTTP plumbing.
  (`feedback_service_layer.md`)
- Routes use `asyncHandler(fn)` + `throw httpError(status, msg)` + the central error middleware.
  Every error response is `{ message: '<string>' }`. (`feedback_async_handler_pattern.md`)
- `client/src/api/endpoints.js` (`API.x.Y`) is the single source of truth for HTTP paths — no
  inline path strings in components. (`feedback_api_endpoints_pattern.md`)
- Any router with a `:id` param registers `router.param('id', validateObjectId)` at the top, so a
  malformed id 400s instead of Mongoose throwing a 500 CastError.
  (`feedback_validate_objectid_param.md`)
- `PUT` endpoints only modify fields **present** in `req.body`. Never
  `field = body.field || undefined` — that clobbers fields the caller didn't send.
  (`feedback_put_partial_update.md`)
- Expensive authed endpoints are rate-limited **per-user** (`server/middleware/userRateLimit.js`),
  not per-IP (NAT breaks IP-based limits). (`feedback_user_rate_limit.md`)
- Cron jobs that mutate data wrap their body in `withLease(name, fn)`
  (`utils/cronLease.js`) so N server instances don't double-run the same tick. "Once per X" jobs
  use a `xxxSentAt` flag with a wide window, not a narrow one that can be missed if the cron lags.
  (`feedback_cron_lease.md`, `feedback_cron_idempotency_flag.md`)
- Every Socket.IO emit for a persisted notification goes through
  `server/utils/emitNotification.js` (`emitNotificationReq`), which injects `notifId`/`count`/
  `timestamp`. The client **sets** `count` from the payload — never `count: n.count + 1` in a
  listener. Await `emitNotificationReq` before `res.json(...)`.
  (`feedback_notifications_architecture.md`, `feedback_notif_markread_count_reset.md`)
- Register every `socket.on(...)` inside `io.on('connection')` **before** any `await` — handlers
  registered after an async auth lookup silently miss events fired during `connect`.
  (`feedback_socket_handler_race.md`)

## 6. Data correctness

- Derived counts from an array (pending/confirmed/etc.) are computed with `useMemo`, never kept
  as parallel state — avoids double-counting against optimistic updates or socket listeners.
  (`feedback_derived_counts.md`)
- If the server also emits a socket event back to the actor of an action, the socket is the single
  source of truth for any resulting count — don't also apply an optimistic increment for it.
  (`feedback_optimistic_vs_socket.md`)
- Any Mongo aggregation that picks "the latest" (`$sort` + `$first`, or top-N) sorts by
  `{ createdAt: -1, _id: -1 }` — timestamp ties on burst inserts make ordering flaky without the
  `_id` tiebreaker. (`feedback_mongo_latest_tiebreak.md`)
- `useEffect` fetches that call `axios.get` + `setState` use `AbortController` +
  `signal: ac.signal`, checking `axios.isCancel(err)` in the catch — prevents stale-data races
  when navigating quickly between details. (`feedback_abort_controller_pattern.md`)

## 7. Client state architecture (Redux Toolkit + TanStack Query)

`client/` is migrating off Context API to Redux Toolkit (client state) + TanStack Query
(server state), tracked phase-by-phase in `plans/redux-toolkit-react-query-migration.md`. These
rules apply to every slice/query written from here on, migration or not:

- **Classify before you store.** Client/UI state — never fetched from an API: theme, language,
  which UI panel is open, a form-in-progress, a view toggle — goes in a Redux Toolkit slice.
  Server state — anything backed by a `GET`/`POST`/`PUT`/`PATCH`/`DELETE` to `/api/*` that can go
  stale and needs cache/invalidation — goes in a TanStack Query `useQuery`/`useMutation`. Don't
  mechanically port a Context 1:1; reclassify each piece of its state on its own merits (a Context
  can be entirely server state and need zero Redux).
- **No RTK Query.** TanStack Query is the one data-fetching/caching library for this project —
  don't add RTK Query endpoints alongside it. Two caches for the same server data is the failure
  mode this rule exists to prevent.
- **Coexistence during migration, never a same-change swap.** A Context provider is only deleted
  once its Redux/TanStack Query replacement is merged *and* manually verified in the browser —
  never in the same change that introduces the replacement.
- **A migration phase closes on "equal or better," not on green tests.** Tests passing is
  necessary but not sufficient — confirm manually (both themes, both languages, desktop+mobile,
  clean console, sockets with two sessions where relevant) that the migrated behavior matches or
  improves on what it replaced before calling a phase done.
- `configureStore`'s `devTools` option is set explicitly via `import.meta.env.DEV` — Vite doesn't
  define `process.env.NODE_ENV` the way Redux Toolkit's default check expects, so the implicit
  default silently disables devtools in dev.

(`project_rtk_react_query_migration.md`)

## 8. Security boundaries

- Never render or log `User.bggCredentials`, raw OAuth provider ids, or any secret-bearing field
  — these are stripped from `toJSON` for a reason; don't re-expose them in a new populate/select.
- Community color/skin tokens are sanitized server-side (hex/rgb allowlist) before storage — never
  accept raw CSS from an admin-editable field.
- Keep the `403`/`code` contract on auth errors (`email_not_verified`, `banned`) — frontend
  branches on `code`, not on the message string.

---

When a new convention gets established through user feedback, add it here (short, imperative,
one bullet) and file the full rationale in `.claude/memory/` as usual.
