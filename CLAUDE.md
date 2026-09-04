# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Constitution

**[CONSTITUTION.md](CONSTITUTION.md)** holds the non-negotiable rules for this repo — testing,
i18n, theming, shared components, server architecture, data correctness, and security boundaries.
Read it before making any change; it applies regardless of which feature you're touching, and it
wins over convenience or a "just this once" shortcut. This file (`CLAUDE.md`) covers *how the app
is built*; `CONSTITUTION.md` covers *what must always hold true*.

## Claude Memory Setup (per machine)

Claude's persistent memory for this project lives in `.claude/memory/` inside this repo and is versioned with git.

On each new machine, after cloning, run this **once** to link it to where Claude Code expects to find it.

The slug in the target path is derived from the absolute path of the repo with `/` replaced by `-` and leading `-` removed. Check the exact slug with:

```bash
ls ~/.claude/projects/   # macOS/Linux
ls $env:USERPROFILE\.claude\projects\   # Windows
```

**macOS / Linux** (adjust repo path to where you cloned it):

```bash
REPO="$HOME/Projects/ClaudioHollman/turnocero"
SLUG=$(echo "$REPO" | sed 's|^/||; s|/|-|g')
ln -s "$REPO/.claude/memory" "$HOME/.claude/projects/$SLUG/memory"
```

**Windows** (PowerShell — adjust repo path):

```powershell
New-Item -ItemType SymbolicLink `
  -Path "C:\Users\<username>\.claude\projects\c--Users-<username>-Projects-ClaudioHollman-turnocero\memory" `
  -Target "C:\Users\<username>\Projects\ClaudioHollman\turnocero\.claude\memory"
```

After that, Claude will read and write memories directly from the repo folder.

## Project Overview

**Turnocero** is a full-stack web app for the Argentine board-game community. Core feature: organize _mesas_ (game sessions) — create, join, chat, and manage them. Additional features: _Compartidas_ (social posts about sessions), _Noticias_ (admin news/announcements), _Torneos_ (admin-managed tournaments — league, single-elimination, and multi-table groups), _Eventos_ (paid events with admin-confirmed registrations), _Comunidades_ (soft multi-tenancy: content separated by community + per-community reskin), a friends system, direct messages between friends, _Utilidades_ (small tabletop tools), and public browsing without login. The UI defaults to **Argentine Spanish** (`es-AR`); **English (`en`) is available** via a toggle in `/perfil`, and all user-facing strings go through **i18n keys** present in both languages (see "Internationalization (i18n)" below and `.claude/memory/feedback_i18n_keys.md`). The app is deployed as a **PWA** (vite-plugin-pwa; assets in `client/public/`).

## Development Commands

```bash
# First-time setup
npm run install:all   # Installs both server and client deps

# Run both servers in one terminal (concurrently, color-prefixed)
npm run dev

# Or in separate terminals
npm run dev:server    # Express backend on port 4000 (nodemon)
npm run dev:client    # Vite frontend on port 3000
```

Tests run via **Vitest** in both workspaces (same runner client and server). ESLint runs as a pre-commit hook via the `/react-review` skill; the flat config lives in `client/eslint.config.js` (extending `eslint.shared.cjs` at the repo root).

```bash
# Server tests
npm test --prefix server                  # one-off
npm run test:watch --prefix server        # watch mode
npm run test:coverage --prefix server     # writes coverage/index.html

# Client tests
npm test --prefix client
npm run test:watch --prefix client
npm run test:coverage --prefix client
```

See "Testing" section below for the full layout (helpers, mocks, MSW handlers).

## Frontend routing

All client-side routes **must use Spanish slugs**. Examples: `/mesas`, `/mesas/crear`, `/mesas/:id/editar`, `/compartidas`, `/noticias`, `/torneos`, `/torneos/crear`, `/torneos/:id/editar`, `/eventos`, `/eventos/:id`, `/eventos/:id/inscripciones`, `/comunidades`, `/comunidades/:slug`, `/comunidades/:slug/gestion`, `/perfil`, `/usuarios/:id`, `/notificaciones`, `/mi`, `/mensajes`, `/utilidades`, `/utilidades/dado`, `/utilidades/temporizador`, `/utilidades/selector-de-dedos`, `/base-de-datos`, `/panel-admin`, `/verificar-email`, `/recuperar-contrasenia`, `/restablecer-contrasenia`. The only English exceptions are `/login` and `/register`. Note: `/usuarios` (the old global members list) now redirects to `/comunidades`; member lists live per-community at `/comunidades/:slug`.

## Git conventions

Always write commit messages in **English**.

## Architecture

### Monorepo structure

- `client/` — React 18 + Vite frontend
- `server/` — Express + Mongoose + Socket.IO backend

The Vite dev server proxies `/api/*` to `http://localhost:4000/api`, so all frontend API calls use relative `/api/...` paths. The Socket.IO client connects directly to `http://localhost:4000` (or `VITE_API_URL`).

### Auth flow

1. `POST /api/auth/register` creates an **unverified** user, emails a 6-digit code via Resend, and returns `{ email, message }` — **no JWT is issued yet**. Login is blocked until the email is verified.
2. `POST /api/auth/verify-email { email, code }` validates the code (5-attempt cap, 15-min TTL) and returns `{ user, token }`. Tokens are long-lived JWTs (180 days, `SESSION_MAX_AGE_MS` in `routes/auth.js`) so mobile/PWA sessions don't need frequent re-login; explicit logout, account ban, or an invalid/tampered token still force a new login.
3. `POST /api/auth/login` returns `{ user, token }` or **403 with `code: 'email_not_verified'`** if the email hasn't been verified yet (frontend redirects to `/verificar-email?email=...`).
4. `POST /api/auth/resend-verification` and `POST /api/auth/forgot-password` are rate-limited to **3 attempts / 15 min** (stricter `emailLimiter`) and always respond 200 generically to avoid leaking account existence. `POST /api/auth/reset-password { token, password }` confirms the reset and stamps `User.passwordChangedAt`, which invalidates every JWT issued before that instant (compared against the token's `iat`, floored to the second — see `server/utils/tokenFreshness.js#isTokenStale`, checked in `protect`/`optionalAuth`/`sectionGate`'s `ensureUserMaybe` and the Socket.IO handshake). `POST /api/auth/logout-all` (protected) does the same stamp without touching the password — it's the "cerrar sesión en todos los dispositivos" action in `/perfil` (Seguridad section), for a lost/stolen device or shared computer; it also logs out the calling device itself, since its own token predates the call. There's still no per-token revocation list, so an individual device can't be signed out in isolation from the others, and a banned/unbanned toggle doesn't touch `passwordChangedAt`.
5. `AuthContext` (internally backed by `authSlice`/`queries/auth.js` — see "Global state architecture" below) stores the JWT in `localStorage`, sets it as the Axios default `Authorization` header, and re-validates via `GET /api/auth/me` on app load.
6. Routes are gated by a combination of `<PublicRoute>` (auth pages), `<PrivateRoute>`, `<AdminRoute>`, and `<SectionGate section="...">` (driven by `SiteConfig` — see below).

**OAuth (Google / Facebook)** — token-based, no Passport/sessions; reuses the same JWT model:

- `POST /api/auth/oauth/google { accessToken }` — the client gets an **access token** via `@react-oauth/google`'s `useGoogleLogin` (implicit flow, scope `openid email profile`) wired to a **custom themed button** (not the official `<GoogleLogin>` widget, so it matches the site). The server validates it with `google-auth-library` (`OAuth2Client.getTokenInfo`), requires `aud === GOOGLE_CLIENT_ID` (anti token-substitution) + `email_verified === true`, then enriches name/picture via Google `userinfo` (best-effort).
- `POST /api/auth/oauth/facebook { accessToken }` — the client gets an **access token** via the FB JS SDK (`useFacebookSdk` hook); the server validates it against Graph API (`/debug_token` confirms `app_id` + `is_valid`, then `/me` for the profile). Requires the `email` permission.
- Both delegate to `server/services/oauthService.js#findOrCreateOAuthUser`: (1) match by `googleId`/`facebookId`, (2) else match by email → **link the provider** to the existing account and set `emailVerified`, (3) else create a new account, already verified and **password-less**, with an auto-generated unique username (`generateUniqueUsername`, editable later in `/perfil`). Then they issue the same `{ user, token }` + cookie as `/login` (incl. the `code: 'banned'` 403 check).
- `User.googleId` / `User.facebookId` are unique **partial** indexes (filtered by `$type: string`, NOT sparse — a `default: null` would collide). `User.password` is conditionally required (`!this.googleId && !this.facebookId`). OAuth-only users can set a password later via the forgot-password flow. `User.authProviders[]` tracks linked providers; raw provider ids are stripped from `toJSON`.
- Env: server needs `GOOGLE_CLIENT_ID`, `FB_APP_ID`, `FB_APP_SECRET`; client needs `VITE_GOOGLE_CLIENT_ID`, `VITE_FB_APP_ID`. App is wrapped in `<GoogleOAuthProvider>` in `App.jsx`. The shared `OAuthButtons` component (used by both Login and Register) renders two custom-styled buttons (`.oauthBtn`, themed) under the form. The frontend document is served with `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Vite dev `server.headers` + `client/vercel.json`) so the Google/Facebook popups can `postMessage` back.

### App shell and layout

`App.jsx` renders a two-column shell for authenticated users:

- `<Sidebar />` — left nav (desktop), authenticated only
- `<Navbar />` — top bar (mobile), authenticated only
- `<BottomNav />` — bottom nav (mobile), authenticated only
- `<GuestNavbar />` — top bar shown to unauthenticated visitors (not on login/register pages)
- `<SplashScreen />` — shown during initial auth load
- `<BoardGameBackground />` — decorative canvas background rendered behind all content

### Global state architecture

Client state and server state are deliberately split across two libraries — this was a full incremental migration (8 phases, tracked in [plans/redux-toolkit-react-query-migration.md](plans/redux-toolkit-react-query-migration.md), done as directed practice for Redux Toolkit; see `.claude/memory/project_rtk_react_query_migration.md` for the phase-by-phase history):

- **Redux Toolkit** (`client/src/store/`) owns *client* state only — UI preferences and small session flags with no server-side source of truth: `theme` ([slices/themeSlice.js](client/src/store/slices/themeSlice.js)), `language` ([slices/languageSlice.js](client/src/store/slices/languageSlice.js)), and `auth` — `{ token, viewAsUser }` ([slices/authSlice.js](client/src/store/slices/authSlice.js)). Each slice that persists to `localStorage` does it via a `createListenerMiddleware` effect (not inside the reducer) — see any of the three files for the pattern. `store.js` wires `preloadedState` for slices whose initial value depends on `localStorage` read at store-creation time (currently only `auth`, via its exported `getInitialAuthState()`). `useAppDispatch`/`useAppSelector` ([store/hooks.js](client/src/store/hooks.js)) are the typed re-exports; components never import `react-redux` directly.
- **TanStack Query** (`client/src/queries/*.js`, one file per domain) owns *server* state — anything that ultimately comes from an API call. Reads are `useQuery`/`useInfiniteQuery` hooks; writes are **plain async functions** (no `useMutation`) that the calling component `await`s directly, then either `queryClient.setQueryData(...)` (seed the cache from the mutation's own response — the default, avoids a redundant refetch) or `queryClient.invalidateQueries(...)` (when the response doesn't carry enough to reconstruct the cached shape, e.g. paginated lists). Query keys are exported per domain as `xKeys` objects (`xKeys.all` / `.list(params)` / `.detail(id)` / ...) so cache invalidation always goes through the owning domain's file, never a hand-rolled array literal at the call site.
- **Context providers survive** for the handful of contexts with real orchestration logic beyond plain state (`AuthContext`, `SiteConfigContext`, `CommunityContext`, `ChatContext`, `NotificationContext`) — each was restructured internally to read from Redux/Query instead of `useState`, but **the Provider/`useX()` shape was deliberately kept unchanged** to avoid rewriting dozens of consumer files for no functional gain (`AuthContext` alone has 65). `ThemeContext`/`LanguageContext` are the only two Contexts actually deleted (Fase 1) — those had no orchestration logic beyond the state itself, so `useTheme()`/`useLanguage()` became thin hooks reading Redux directly, no Context needed at all.
- **RTK Query was explicitly rejected** in favor of using TanStack Query and Redux Toolkit separately — RTK Query would blur the client-state/server-state split this migration exists to establish.

### Table lifecycle

- Created with `status: 'open'`, `host = currentUser`, `players = []`, `privacy = 'public'`
- Mongoose pre-save hook auto-sets `status = 'full'` when `players.length >= maxPlayers` and reverts to `'open'` if a player leaves
- `privacy: 'private'` tables use a join-request flow: `POST /:id/join` adds to `pendingRequests`; host accepts/rejects via `POST /:id/requests/:userId/accept|reject`
- Host can edit (PUT) or cancel (DELETE → `status = 'cancelled'`); cancelled tables are excluded from all list queries
- `location` is a subdocument `{ texto, lat, lng }` (migrated from `String` in 2026-05). A `pre('init')` hook normalizes legacy string values lazily on hydrate. Tables created via the new flow always get coords via Places Autocomplete or the geocoding fallback.

### Distance to tables

When the authenticated user has `direccion.lat/lng`, `GET /api/tables` decorates each item with `distanceKm` (great-circle, computed via Haversine in `server/utils/geo.js#haversineKm`). The optional `?maxDistanceKm=N` query filters to tables within N km of the user (bounding-box pre-filter in Mongo + Haversine refine in memory; no GeoJSON migration required). Tables without coords show `distanceKm: null` and are excluded when the radius filter is active. UI: green badge in TableCard via `client/src/utils/distance.js#formatDistanceKm` ("Aquí mismo" / "850 m" / "12,3 km" / "250 km"); radius slider (1–100km, `useDebouncedValue` 300ms) in the dashboard.

### Compartidas

Social posts that users create to share moments from their sessions. Stored in the `Compartida` model:

- `privacy`: `'public'` | `'friends'` | `'private'` — visibility governed by `User.friends[]`
- `linkedTable`: optional ref to a Table the author participated in
- Supports likes (toggle), images (max 3, Cloudinary, `turnocero/compartidas/:id/`), and comments (`CompartidaComment` model)
- Feed returns a `featured` post (most-liked in last 24 h) alongside paginated results
- Public compartidas are browsable without login; `GET /api/compartidas/:id/og` serves OG metadata for crawlers

### Instagram cross-post (Compartidas)

Opt-in per-user feature: a public juntada with at least one photo can also be published to the
author's own Instagram Feed and/or Stories. Gated behind the `instagramCrosspost` SiteConfig
section (default **OFF** — turning it on for regular users requires Meta App Review, see below).

- **Connection is per-user, not login OAuth.** `User.instagramCredentials` stores an
  AES-256-GCM-encrypted Facebook **Page Access Token** (never the user's own token — Graph API
  publish calls use the Page's token) plus `igUserId`/`igUsername`/`pageId`/`pageName` and an
  `invalid` flag (same shape/purpose as `bggCredentials`). `POST /api/auth/instagram-connect`
  (body `{ accessToken }`, a Facebook user access token obtained client-side via `useFacebookSdk`
  with an extended scope — see `UserProfile.jsx`'s "Conexión con Instagram" section) validates the
  token, exchanges it for a long-lived one, and walks the user's Facebook Pages
  (`server/services/instagramService.js#findInstagramPage`) to find the first one with a linked
  Instagram Business/Creator account — Instagram cross-posting **only works with Business/Creator
  accounts**, never personal ones. `DELETE /api/auth/instagram-connection` clears it.
  `server/utils/encryption.js#encrypt/decrypt` takes an optional env-var-name argument (default
  `BGG_CREDS_KEY`) so this reuses the same AES module under its own `INSTAGRAM_CREDS_KEY`.
- **The toggle lives in `JuntadaFields.jsx`** (shared by the Compartidas composer and BG Watch's
  "Compartí esta partida" section) as two checkboxes, Feed/Historias — visible only when the
  section is enabled, the author's Instagram connection is valid, the post is `privacy: "public"`,
  and it has ≥1 photo (Instagram is inherently public; Stories don't support a caption/carousel).
- **Publishing is fully async, never blocks the create request.** `createJuntada.js`'s existing
  2-step (create → upload images) flow gets an optional 3rd step: once images are uploaded,
  `POST /api/compartidas/:id/instagram-post` just flips `Compartida.instagram.feed/story.status`
  to `"pending"` and returns immediately (202). A cron job
  (`server/jobs/instagramPublish.js`, registered in `scheduler.js` every 2 min, `withLease`-guarded
  like the other jobs) picks up pending targets, does the actual Graph API dance (create media
  container(s) — a carousel for 2-3 Feed photos — → poll `status_code` until `FINISHED` → publish),
  and updates the status to `posted` (with `mediaId`/`permalink` for Feed) or `failed` (with
  `error`). An OAuthException marks `instagramCredentials.invalid = true` so `/perfil` prompts a
  reconnect instead of retrying forever.
- **Notifications**: `instagram_post_success`/`instagram_post_failed` (types on `Notification`,
  gated to the `instagramCrosspost` section same as everything else here) are emitted per-target —
  Feed and Historias of the *same* Compartida are independent notifications
  (`Notification.instagramTarget` is part of the upsert key, alongside `compartidaId`).
  `CompartidaCard.jsx` renders a small author-only status row below the photos ("Publicando…" /
  a "Ver en Instagram" link when a permalink exists / "No se pudo publicar" + a **Reintentar**
  button that just re-POSTs `/instagram-post`, re-queueing the same target for the next cron tick).
- **Env vars**: reuses the existing `FB_APP_ID`/`FB_APP_SECRET` (the same Facebook app as OAuth
  login) — it just needs the "Instagram Graph API" product + `instagram_basic`,
  `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` permissions added to that
  app. New: `INSTAGRAM_CREDS_KEY` (64-char hex, same generation command as `BGG_CREDS_KEY`).
- **Meta App Review**: publishing for accounts other than the app's own Admin/Developer/Testers
  requires Meta's review of the permissions above — a manual, external process. Until that's done,
  keep `instagramCrosspost` off in `/panel-admin` for everyone but the developer's own testing.

### Noticias

Admin-only announcements. `Noticia` model: title, body, image (Cloudinary, `turnocero/noticias/`), optional link + linkLabel. Read publicly; write requires `isAdmin`.

### Torneos

Admin-managed tournaments. Three formats supported:

- **Liga**: head-to-head round-robin (3/1/0 scoring).
- **Eliminación simple**: single-elimination bracket with byes.
- **Grupos**: multi-phase tournament with multi-player tables (most realistic for board-game tournaments). Players are split into groups of `tableSize`, each group plays `gamesPerGroup` games, top `qualifiersPerGroup` advance to the next phase. Repeats until a single final table.

Models:

- `Torneo`: `title`, `description`, `game` (free-text), `format`, `status` (`draft` → `registration` → `in_progress` → `finished`), `inscriptionMode` (`open` | `admin_only`), `image`, `maxParticipants`, `createdBy`, `participants` (ordered by seed), `pendingRegistrations`, `rejectedRegistrations`, `winner`, `runnerUp`. **Groups-specific:** `tableSize`, `gamesPerGroup`, `qualifiersPerGroup`, `currentPhase`.
- `TorneoMatch` (liga + single_elim only): `torneo`, `round`, `matchIndex`, `playerA`, `playerB`, `nextMatch` (single_elim, with `isUpperSlot`), `winner`, `isDraw` (league only), `status` (`pending` | `completed` | `bye`), `playedAt`.
- `TorneoGroup` (groups only): `torneo`, `phase`, `tableNumber`, `players`, `advancedPlayers` (top-C, editable by admin before next-phase generation), `status` (`pending` | `in_progress` | `completed`), `completedAt`.
- `TorneoGame` (groups only): `torneo`, `group`, `gameNumber`, `results: [{ player, score, position }]`, `status`, `playedAt`. Position is auto-derived from score within a game (1st = highest score; ties share position).

Inscription modes:

- `open`: users self-register; admin accepts/rejects. State machine: `draft → registration → in_progress → finished`.
- `admin_only`: admin adds users directly via `POST /api/torneos/:id/participants/:userId` (search-and-pick UI). Registration state is optional; admin may go `draft → in_progress` directly. The register button is hidden from regular users.

Lifecycle for **groups**: admin creates as `draft` → adds participants (or opens registration first) → starts (`in_progress`), which calls `generateGroupsPhase()` and creates `TorneoGroup` + `TorneoGame` docs for phase 1 → admin loads scores per game; after all P games of a group are loaded, the group auto-completes and the system suggests top-C as `advancedPlayers` (admin can edit) → when all groups of the phase are complete + have advancedPlayers, admin clicks "Siguiente fase" → `POST /api/torneos/:id/next-phase` (preview at `/next-phase/preview`) validates layout (with override-table-size suggestions for uneven cuts) and generates phase N+1 → loop until 1 final table → admin finalizes.

Lifecycle for **league/single_elim** (unchanged): same as above but uses `TorneoMatch` and `generateLeagueFixture()` / `generateSingleElimBracket()` (NCAA seeding with byes pre-advanced).

Standings:

- League: 3/1/0 head-to-head sum (`computeStandings`).
- Groups: sum of PV (native game score) per player across all games of the group (`computeGroupStandings`). Tiebreak: seed order (stable).

Notifications: 5 non-aggregating types — `tournament_accepted`, `tournament_rejected`, `tournament_advanced`, `tournament_eliminated`, `tournament_pending` (only as toast, after the user clicks "Inscribirme"). `Notification` schema has `torneoId`, `torneoTitle`, `round` fields. `tournament_advanced` is reused both for single-elim bracket wins and for groups-format phase promotions.

Drafts are visible only to admins (filtered server-side; 404 in detail for non-admins). Users see only `registration` / `in_progress` / `finished`. When `inscriptionMode === 'admin_only'`, `registration` status renders as "Inscripción cerrada" in the card.

### Eventos

Admin-managed paid (or free) one-off events with manual registration confirmation. `Evento` model: `title`, `description`, `conditions`, `fee` (number, 0 = free), `transferDetails`, `eventDate`, `location`, `maxParticipants`, `image` (Cloudinary, `turnocero/eventos/`), `status` (`draft` | `open` | `closed` | `cancelled`), `author`, and an embedded `registrations` array.

Each registration: `{ user, status: 'pending' | 'confirmed' | 'rejected', submittedAt, reviewedAt, reviewedBy, adminNotes, comprobante: { url, publicId, resourceType ('image' | 'raw' for PDF), uploadedAt } }`. The `comprobante` is a payment receipt the user uploads when they self-register; admins review and confirm/reject via `PATCH /api/eventos/:id/inscripciones/:userId/confirmar|rechazar`. Comprobantes accept images and PDFs (PDFs are stored as Cloudinary `resource_type: 'raw'`).

### Comunidades

Soft multi-tenancy + per-community reskin. The site stays branded "TurnoCero" but its content is separated by community: a user joins one or more communities, picks a subset to "view together", and picks one community's skin. Content (Mesas, Compartidas, Eventos, Torneos, Noticias, MathTrade) is scoped to a community; a user sees only the content of the communities they're viewing.

**Models / data:**

- `Community` ([server/models/Community.js](server/models/Community.js)): `name`, `slug` (immutable, derived from name — feeds the `data-community` CSS selector + URLs), `description`, `isBase` (exactly one base community "TurnoCero" with `isBase: true` — undeletable, holds all historical content, everyone belongs to it), `joinPolicy` (`open` | `approval` | `code`), `inviteCode` (`select: false`, only `hasCode` exposed), `pendingMembers[]` (approval queue), `skin` (see below), `sections` (Map String→Bool, per-community section override mirroring `SiteConfig.sections`), `createdBy`. Statics: `getBase()`/`ensureBase()` (cached singleton, lazy-upsert; reset between tests via `__resetBaseCache()`), `generateSlug` (NFD + strip diacritics), `sanitizeSkinTokens` (hex/rgb allowlist). `toJSON` uses `toObject({ flattenMaps: true })` so the Map fields (`sections`, `skin.*`) serialize as plain objects, NOT `{}`.
- Membership lives on `User`: `communityMemberships: [{ community, role: 'member' | 'subadmin', joinedAt }]` (indexed) + `communityPrefs: { viewing: [Community], skin: Community }`. Every user (password + OAuth signup) gets base membership + base skin via `communityService.ensureBaseMembership`.
- The `community` field is added to content models by the **`communityScoped` Mongoose plugin** ([server/models/plugins/communityScoped.js](server/models/plugins/communityScoped.js)); the registry of scoped models is [server/config/scopedModels.js](server/config/scopedModels.js) (Table, Compartida, Evento, Torneo, Noticia, MathTrade). `community` is `required: false` at the model level (a `required: true` would tax every direct `Model.create`); the create routes + `communityService.resolveCreateCommunity` are the guardrail. New scoped models: add the plugin + register in `scopedModels.js`.

**Read-scoping:** reads inject `community: { $in: viewingCommunities }` as an orthogonal `$and` clause (never folded into privacy filters), with a never-empty invariant (base is the floor). A `<CommunitySelect>` "Publicar en" selector on content-create forms chooses the target community (hidden when the user has ≤1 membership).

**Reskin:** `Community.skin` carries `accents` (brand colors — theme-independent), `neutralsDark`/`neutralsLight` (theme-split via `:root[data-theme="..."][data-community="..."]`), `logoLight`/`logoDark`, `brandName`, `tagline`. Color tokens are sanitized server-side (hex/rgb allowlist, no raw CSS). The client `CommunityContext` injects a `<style id="community-skin">` from the skin community in a `useLayoutEffect`, sets `data-community` on `<html>`, and persists `{slug, css}` to `localStorage` (key `turnocero_skin`); an inline script in `index.html` reapplies it pre-hydration to avoid FOUC. Skin editing is admin-only (`CommunitiesAdmin` in `/panel-admin`). Opacity variants use `color-mix(in srgb, var(--accent) N%, transparent)`.

**Roles & moderation:** per-membership `subadmin` role moderates a community's memberships (accept/reject join requests, expel members) + content (`communityService.canModerate` = author OR global admin OR subadmin of the doc's community). Only global admins create communities and edit skins / assign subadmins. Subadmin tools live at `/comunidades/:slug/gestion` (`ComunidadGestion`).

**Section gating** is two-layered: the global `SiteConfig.isSectionEnabled(key)` AND the per-community-**skin** override (client hook `useSectionEnabled`). Distinct from this is the per-**target**-community gate used by the member list (see below).

**Member lists ("Mis Comunidades"):** `/comunidades` (`Comunidades`) is the directory of all communities (join open ones directly / request approval ones / enter code), ordered **mine-first** (member → pending → rest). Each card a user is a member of shows a "Ver miembros" link to `/comunidades/:slug` (`ComunidadDetail`), which renders that community's member list by reusing `UsersList` with a `communityId` prop (embedded mode → fetches `GET /api/users?community=<id>`, hides the global hero/BG-Watch banner). This member view is gated by the **`comunidad`** section (singular — global toggle AND the target community's `sections.comunidad` toggle) and restricted to members; admins bypass. Note the two section keys: **`comunidades`** (plural) gates the directory; **`comunidad`** (singular) gates the per-community member list. Turning `comunidad` off only hides "Ver miembros" + blocks `/comunidades/:slug` — the community stays listed and joinable. Public profiles `/usuarios/:id` are shared infra (linked from notifications/DMs) and are NOT gated by `comunidad`; `GET /api/users` (without `?community`) is likewise ungated (DMs, tournament participant search, BG Watch depend on it).

**Migration / deploy:** existing content predating Comunidades was assigned to the base community by `server/scripts/seed-base-community.js` (idempotent). **Run this once on first deploy of the feature** (and it self-heals: `getBase()` lazily upserts the base community so `$in:[base]` is never empty).

**Subdominios single-tenant (opt-in):** una comunidad con `subdomainEnabled: true` (campo en `Community`, toggle admin en `PUT /api/comunidades/:slug`) es accesible en `<slug>.turnocero.com`. Al entrar por ahí el sitio se acota a esa comunidad — **como si las demás no existieran** (anónimos/no-miembros ven una vidriera pública read-only; los miembros publican ahí). La base NUNCA es tenant.

- **Mecanismo:** el cliente detecta el subdominio ([client/src/utils/tenant.js](client/src/utils/tenant.js) `detectTenant()`: parsea `window.location.hostname` vs `VITE_TENANT_DOMAIN`; reservados `www`/`app`/`api`; override dev `?tenant=<slug>` y `<slug>.localhost`) y manda el slug en el header `X-Community-Slug` (default de axios seteado en `main.jsx`). El server lo resuelve en el middleware **global** `resolveTenant` ([server/middleware/resolveCommunities.js](server/middleware/resolveCommunities.js), montado en `app.js` antes de las rutas) → `req.tenant` vía `Community.resolveTenant(slug)` (cacheado, solo `subdomainEnabled`, base excluida). Si hay `req.tenant`, `resolveCommunities` cortocircuita a `viewingCommunities=[tenant]` + `skinCommunity=tenant` (vale para anónimos, no-miembros y miembros). La creación de contenido se fuerza al tenant vía `resolveCreateCommunity(user, requested, tenant)` (un no-miembro recibe 403). El directorio `GET /api/comunidades` se acota al tenant.
- **Cliente:** `CommunityContext` levanta el tenant con `GET /api/comunidades/:slug` (solo entra en modo si `data.subdomainEnabled`), fuerza skin/marca/sections desde esa comunidad (aunque el visitante no sea miembro) y expone `isTenant`/`tenant`. En modo tenant se ocultan `CommunitySwitcher`, el item "Mis Comunidades" del `Sidebar` y el `CommunitySelect` ("Publicar en").
- **Infra:** wildcard DNS `*.turnocero.com` → Vercel + dominio wildcard en el proyecto; backend único (`api.turnocero.com`) con env `CORS_ORIGIN_SUFFIX=.turnocero.com` (matcheo de sufijo https en [server/config/cors.js](server/config/cors.js), Express + Socket.IO); cliente con `VITE_TENANT_DOMAIN`. **Limitación conocida:** el login no se comparte entre subdominios (token en `localStorage`, por-origin) — fix futuro: cookie `Domain=.turnocero.com` + SSO vía `/api/auth/me`.

### Utilidades

Small standalone tabletop tools, intentionally **forced-dark** regardless of the active theme (they ignore `data-theme`): `/utilidades/dado` (dice roller), `/utilidades/temporizador` (timer), `/utilidades/selector-de-dedos` (touch-finger random picker). The hub `/utilidades` lists them via `UtilCard`. Keep this dark-mood convention for any new immersive tool screens.

### Panel Admin and SiteConfig (section toggles)

`SiteConfig` is a single MongoDB document (`_id: 'singleton'`) that controls which top-level sections are enabled site-wide. Section keys: `mesas`, `compartidas`, `noticias`, `torneos`, `eventos`, `comunidad`, `miFeed`, `amigos`, `dms`, `bgwatch`, `utilidades`, `colabora`, `calendario`, `mathtrade`, `comunidades`, `push`, `instagramCrosspost`. The **`push`** key is a master switch for Web Push delivery (default `true`); turning it off stops outbound pushes and hides the push opt-in UI, but does NOT affect in-app notifications. The **`instagramCrosspost`** key is a master switch (no dedicated nav route, same shape as `push`) for the Compartidas → Instagram cross-post feature (see "Instagram cross-post (Compartidas)" above); default `false` pending Meta App Review. Note the two community keys: **`comunidades`** (plural) gates the Comunidades directory; **`comunidad`** (singular) gates the per-community member list (see Comunidades above). Defaults preserve historical hardcoded admin-only-ness for `mesas`, `torneos`, `miFeed`, `mathtrade`, and `instagramCrosspost` (default `enabled: false`); all others default `true`. Admins flip toggles in `/panel-admin`; server enforces via `requireSection` middleware, client gates via `<SectionGate section="...">` (see [`App.jsx`](client/src/App.jsx)). When you add a new top-level feature, plumb it through `SECTION_KEYS`, the route guard, and the panel — see `feedback_panel_admin_toggles.md`.

`SiteConfigContext` loads the config once on app boot and exposes `isSectionEnabled(key)`. Routes wrapped in `<SectionGate>` redirect/hide for disabled sections; admins always see disabled sections (with a banner) unless they enable "view as user".

### Admin "view as user" mode

`AuthContext` exposes both `isActuallyAdmin` (real DB flag) and the effective `user.isAdmin` (which an admin can suppress via the `AdminViewToggle`). Use `isActuallyAdmin` only for structural admin pages that must stay reachable even when previewing (`/panel-admin`, `/base-de-datos`, `/mensajes-admin`); for everything else (UI, conditionals, server-fetched data filters), respect the effective `user.isAdmin` so the preview is faithful. See `feedback_admin_view_as_user.md`.

### Email verification & password reset

Registration creates the user in an unverified state and emails a 6-digit code (in dev, the code is also logged to the server console — see commit 92013cf). Routes: `POST /api/auth/verify-email` (with code), `POST /api/auth/resend-verification` (rate-limited via `emailLimiter`), `POST /api/auth/forgot-password` (emails reset link), `POST /api/auth/reset-password` (with token). Frontend pages: `/verificar-email`, `/recuperar-contrasenia`, `/restablecer-contrasenia` (all `PublicRoute`).

### Friends system

Stored on the `User` model: `friends: [ObjectId]` and `friendRequests: [{ from, sentAt }]`. Managed via `/api/friends/:id/request|accept|reject` and `DELETE /api/friends/:id`. The friends list gates `'friends'`-privacy Compartidas and DM access.

### Web Push notifications (PWA)

OS-level push delivered when a notification is persisted, so it arrives even with the PWA closed/backgrounded. **Supplements** the Socket.IO in-app system, doesn't replace it.

- **Single integration point:** [`emitNotification.js`](server/utils/emitNotification.js) fires the push (fire-and-forget, best-effort) right after `saveNotification` returns a non-null doc — so it covers both request routes and the cron. It only pushes when `isSectionEnabled('push')` AND the type is in the curated allowlist [`config/pushableTypes.js`](server/config/pushableTypes.js) (high-value/personal types + BG Watch; likes/photos/generic comments are in-app only). Respects section gating automatically (no push when the notif didn't persist).
- **Copy reuse (single source of truth):** the push payload is the Notification fields serialized by [`serializeNotifForPush.js`](server/utils/serializeNotifForPush.js) (whitelist, <4KB; excludes `playSnapshot`/`community`). The **service worker** ([client/src/sw.js](client/src/sw.js)) reuses `getNotifMeta`/`notifLink` from [notifDomains.js](client/src/utils/notifDomains.js) (via the pure, testable [client/src/sw/pushNotification.js](client/src/sw/pushNotification.js)) to build title/body/url — so push text never diverges from the in-app bandeja.
- **Service worker:** vite-plugin-pwa runs in **`injectManifest`** mode (was `generateSW`) so we can add `push`/`notificationclick` handlers. [client/src/sw.js](client/src/sw.js) hand-reproduces the old workbox behavior (precache + `cleanupOutdatedCaches` + `skipWaiting` + `clients.claim` + `/api` NetworkOnly + navigation fallback with `/api` denylist) — **keep all of these or stale cache → white screen** (see `feedback_pwa_sw_config`). The `push` handler suppresses the OS notification if any client window is focused (the in-app toast already covers that device).
- **Multi-device:** never suppress server-side by socket presence — always send to all of a user's subscriptions; each device's SW decides locally. Dead subscriptions (404/410) are pruned by [`services/pushService.js`](server/services/pushService.js).
- **Subscriptions:** [`PushSubscription`](server/models/PushSubscription.js) model (one per device, upsert by `endpoint`). Client [`usePushNotifications`](client/src/hooks/usePushNotifications.js) handles permission (from a user gesture) + `pushManager.subscribe` with the VAPID key (`urlBase64ToUint8Array` in [pushKey.js](client/src/utils/pushKey.js)). Opt-in lives in `/perfil` ("Notificaciones push" section) + a proactive [`PushPrompt`](client/src/components/shared/PushPrompt.jsx) banner (2nd session+, 14-day re-prompt). On explicit logout the device unsubscribes ([pushDevice.js](client/src/utils/pushDevice.js)).
- **iOS caveat:** Web Push needs iOS 16.4+ **and the PWA installed standalone** (no push in a Safari tab); the UI detects this (`requiresStandalone`) and guides "Agregar a inicio".
- **Env / deploy:** generate VAPID keys once (`npx web-push generate-vapid-keys`). Server: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Client: `VITE_VAPID_PUBLIC_KEY` (the public key, embedded at build). Without keys, push is a no-op — nothing breaks.

### Direct Messages (DM)

Friends-only real-time chat. `DirectMessage` model: `from`, `to`, `content` (max 1000 chars), `readByRecipient`.

- `GET /api/dm` returns a conversation list (latest message + unread count per contact, via aggregation)
- `GET /api/dm/:userId` returns paginated history (40/page, max 100); 403 if not friends
- `POST /api/dm/:userId` sends a message; emits `dm:message` to recipient's socket with an `isNewConversation` flag
- `PATCH /api/dm/:userId/read` marks all messages from that user as read

**ChatContext** manages the desktop DM experience (up to 3 floating chat windows). It registers a listener with `NotificationContext.addDmListener` to receive incoming messages and exposes `openChat`, `closeChat`, `minimizeChat`, `sendMessage`, and `dmUnreadTotal`. **`dmUnreadTotal` is derived from `NotificationContext`** (single source of truth — the `dm` notification's `count`), NOT from a parallel per-conversation counter. ChatContext re-exports it so consumers (Navbar, ChatLauncher) stay the same. On mobile (< 960 px), clicking a conversation navigates to `/mensajes/:userId` (the `DirectChat` page) instead of opening a floating window.

### Admin Chat

Shared real-time chat room visible only to admins. `AdminMessage` model: `from`, `content` (max 2000 chars). The `admin:message` event is emitted **per-admin** (to each admin's `user:<id>` room) instead of broadcast to `admin:room` — this ensures every admin's socket receives exactly one event with its own `notifId`+`count`, preventing double-count when an admin happens to be in both rooms. `NotificationContext` tracks an `adminChatUnread` counter (via `setAdminChatActive`). Routes: `GET /api/admin-chat` (last 100 messages), `POST /api/admin-chat`.

### Socket.IO rooms and events

Each authenticated socket auto-joins `user:<userId>`. Admins also auto-join `admin:room`. When entering a table detail page, the client emits `join:table <tableId>` to join `table:<tableId>`.

Server-emitted events:
| Event | Room | Trigger |
|---|---|---|
| `chat:message` | `table:<id>` | new chat message |
| `chat:notification` | `user:<id>` | chat message (to non-sender participants) |
| `join:request` | `user:<hostId>` | someone requests to join a private table |
| `join:accepted` | `user:<userId>` | host accepts a join request |
| `table:comment` | `user:<id>` | new comment (to participants) |
| `table:image` | `user:<id>` | new image uploaded (to participants) |
| `table:spot-opened` | `user:<id>` | player leaves → followers notified |
| `friend:request` | `user:<targetId>` | friend request sent |
| `friend:accepted` | `user:<fromId>` | friend request accepted |
| `dm:message` | `user:<recipientId>` | direct message sent (includes `isNewConversation`) |
| `admin:message` | `admin:room` | admin chat message sent |
| `torneo:registration-accepted` | `user:<id>` | admin accepts a tournament registration |
| `torneo:registration-rejected` | `user:<id>` | admin rejects a tournament registration |
| `torneo:advanced` | `user:<id>` | single-elim match winner advances (not on final) |
| `torneo:eliminated` | `user:<id>` | single-elim match loser is out |
| `evento:notification` | `user:<id>` | event notification (confirmed/rejected/cancelled/updated/reminder) — payload has `type` discriminator |
| `community:join-request` | `user:<id>` | someone requests to join an approval-policy community (to subadmins + admins) |
| `community:join-resolved` | `user:<id>` | a subadmin/admin accepts or rejects a community join request |

### NotificationContext

Owns the Socket.IO connection for the authenticated user. On mount, loads persisted notifications from `GET /api/notifications` (MongoDB, last 60) and mirrors any updates back via `PATCH /api/notifications/read` and `DELETE /api/notifications`. Also drives in-app toasts (max 4 visible). `setActiveTable(tableId)` / `setActiveEvento(eventoId)` / `setActiveTorneo` / `setActiveCompartida` suppress notifications for the currently open resource and auto-mark them read. `unreadCount` drives the nav badge, `dmUnreadTotal` drives the chat icon. DM messages are routed through `addDmListener` (consumed by `ChatContext`) AND tracked as a persistent `dm` notification.

**Notification contract — server-pushed absolute count (post-2026-05-22 refactor):**

Every Socket.IO event emitted for a persisted notification MUST go through `server/utils/emitNotification.js#emitNotificationReq(req, recipientId, type, fields, socketEvent, extra?)`. The helper does `saveNotification` then emits with these extra fields auto-injected into the payload:

- `notifId` — the Notification doc's `_id` (string)
- `count` — the absolute post-upsert count (server is the source of truth)
- `timestamp` — the doc's `updatedAt`

The client (`NotificationContext.jsx`) uses these to:

- Dedupe via `mergeNotifs` by `notifId` (no more timestamp-based races).
- **Set** (not increment) the local `count` from `payload.count`. **Never do `count: n.count + 1` in a listener** — it re-introduces the double-count drift bug.
- Reset `count: 0` on `markRead*` so the next event starts from a clean slate (server $inc resets when notif is marked read too).

For routes that need to emit-and-respond, **always await** `emitNotificationReq(...)` before `res.json(...)` — fire-and-forget breaks test ordering AND can drop emits if the request finishes first.

For the cron job (`server/jobs/eventoReminders.js`), the scheduler passes `io` into `runOnce({ io })` and the job uses `emitNotification({ io, ... })` directly (no `req`).

**Notification types** (`server/models/Notification.js#NOTIFICATION_TYPES`): 34 types total spanning mesas, amigos, mensajes, compartidas, torneos, eventos, and comunidades. Comunidades types: `community_join_request` (to subadmins/admins), `community_join_accepted`, `community_join_rejected`, and `community_content_removed` (when a subadmin moderates your content) — emitted via `routes/comunidades.js` through `emitNotificationReq`. Eventos types (`evento_confirmed`, `evento_rejected` con flag `permanentlyRejected`, `evento_cancelled`, `evento_updated` con `changedFields`, `evento_reminder` cron 24h) son los más recientes — disparados desde `routes/eventos.js` helpers `notifyOne` + `notifyActiveRegistrations` y desde `jobs/eventoReminders.js`. Cron jobs se booteanan en `server.js` (NO en `app.js` para que no corran en tests).

### Key API endpoints

```
POST   /api/auth/register|login                 — rate-limited (authLimiter)
POST   /api/auth/verify-email                   — confirm with 6-digit code
POST   /api/auth/resend-verification             — rate-limited (emailLimiter)
POST   /api/auth/forgot-password                — emails reset link (rate-limited)
POST   /api/auth/reset-password                 — confirm with token
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/profile                        — update displayName, nombre, apellido, direccion, telegram, celular, bggUsername
PUT    /api/auth/avatar                         — multipart: 'avatar' file; server stores as 400×400 WebP
DELETE /api/auth/avatar                         — clears stored avatar
POST   /api/auth/bgg-connect                    — validate BGG password and store encrypted
DELETE /api/auth/bgg-connection                 — remove stored BGG credentials
POST   /api/auth/instagram-connect              — validate FB token, resolve IG Business page, store encrypted
DELETE /api/auth/instagram-connection           — remove stored Instagram credentials

GET    /api/bgg/search?q=                       — game name search (top 15, sorted by year)
GET    /api/bgg/game/:id                        — game details (cached 30 min; incl. playingTime/min/maxPlayTime = box time)
GET    /api/bgg/coleccion/:bggUsername          — full collection with ratings + numPlays
GET    /api/bgg/partidas/:bggUsername           — plays (?page, ?mindate, ?maxdate, ?id)
POST   /api/bgg/partidas                        — log a play (auth + bggConnected)
PUT    /api/bgg/partidas/:playId                — edit a play (auth + bggConnected)
DELETE /api/bgg/partidas/:playId                — delete a play (auth + bggConnected)
GET    /api/bgg/jugado/:bggUsername/:gameId     — { played, numPlays, known } ("Nuevo" autodetect; local)
GET    /api/bgg/ultima-juntada/:bggUsername     — last play's roster + location (play-form prefill)
GET    /api/bgg/mis-juegos|mis-ubicaciones|mis-jugadores/:bggUsername — paginated play-form pickers

GET    /api/tables                              — paginated (?page, ?limit, ?search)
GET    /api/tables/mine
POST   /api/tables
GET    /api/tables/:id
PUT    /api/tables/:id                          — host only
DELETE /api/tables/:id                          — cancel, host only
POST   /api/tables/:id/join                     — direct join (public) or pending request (private)
DELETE /api/tables/:id/request                  — cancel own pending request
POST   /api/tables/:id/requests/:userId/accept  — host only
POST   /api/tables/:id/requests/:userId/reject  — host only
POST   /api/tables/:id/leave
POST   /api/tables/:id/follow                   — toggle follow (non-members only)
POST   /api/tables/:id/react                    — toggle/replace emoji reaction
GET    /api/tables/:id/messages                 — participants only (last 200)
POST   /api/tables/:id/messages
GET    /api/tables/:id/comments
POST   /api/tables/:id/comments
PUT    /api/tables/:id/comments/:commentId      — own comment only
DELETE /api/tables/:id/comments/:commentId
POST   /api/tables/:id/images                   — Cloudinary upload
DELETE /api/tables/:id/images/:imageId
GET    /api/tables/:id/ratings
POST   /api/tables/:id/ratings

GET    /api/compartidas                         — paginated feed + featured; optionalAuth
POST   /api/compartidas                         — auth required
GET    /api/compartidas/:id                     — optionalAuth; respects privacy
GET    /api/compartidas/:id/og                  — public OG metadata (no auth)
PUT    /api/compartidas/:id                     — author only
DELETE /api/compartidas/:id                     — author or admin
POST   /api/compartidas/:id/like                — toggle like
POST   /api/compartidas/:id/images              — author only, max 3
DELETE /api/compartidas/:id/images/:imgId
POST   /api/compartidas/:id/instagram-post      — author only; queues Feed/Historias for the cron (202, doesn't block)
GET    /api/compartidas/:id/comments            — optionalAuth
POST   /api/compartidas/:id/comments
PUT    /api/compartidas/:id/comments/:cid       — own comment only
DELETE /api/compartidas/:id/comments/:cid       — comment author, post author, or admin

GET    /api/noticias                            — public, paginated
POST   /api/noticias                            — admin only
GET    /api/noticias/:id                        — public
PUT    /api/noticias/:id                        — admin only
DELETE /api/noticias/:id                        — admin only

GET    /api/torneos                             — optionalAuth, paginated (?status, ?game)
POST   /api/torneos                             — admin only; creates in 'draft'
GET    /api/torneos/:id                         — optionalAuth (drafts hidden from non-admins)
PUT    /api/torneos/:id                         — admin only
DELETE /api/torneos/:id                         — admin only (only draft or no matches)
POST   /api/torneos/:id/register                — auth; creates pending registration
DELETE /api/torneos/:id/register                — auth; cancel own pending
POST   /api/torneos/:id/registrations/:userId/accept  — admin only
POST   /api/torneos/:id/registrations/:userId/reject  — admin only
POST   /api/torneos/:id/participants/:userId    — admin only (admin_only mode: direct add)
DELETE /api/torneos/:id/participants/:userId    — admin only (draft/registration)
PATCH  /api/torneos/:id/seeds                   — admin only (reorder before in_progress)
PATCH  /api/torneos/:id/status                  — admin only (validated transitions; generates fixture/groups on registration→in_progress)
GET    /api/torneos/:id/matches                 — optionalAuth (liga + single_elim)
POST   /api/torneos/:id/matches/:matchId/result — admin only (body: { winnerId } or { draw: true })
DELETE /api/torneos/:id/matches/:matchId/result — admin only (cascades clear in single_elim)
GET    /api/torneos/:id/standings               — optionalAuth (computed for league)
GET    /api/torneos/:id/groups                  — optionalAuth (groups format; ?phase, default = currentPhase)
POST   /api/torneos/:id/games/:gameId/result    — admin only (body: { results: [{ playerId, score }] })
DELETE /api/torneos/:id/games/:gameId/result    — admin only
PATCH  /api/torneos/:id/groups/:groupId/advanced  — admin only (edit advancedPlayers list)
POST   /api/torneos/:id/next-phase              — admin only (body: { tableSize? } override)
GET    /api/torneos/:id/next-phase/preview      — admin only (validates layout + suggestions)

GET    /api/eventos                             — optionalAuth, paginated
POST   /api/eventos                             — admin only (multipart: image)
GET    /api/eventos/:id                         — optionalAuth (drafts hidden from non-admins)
PUT    /api/eventos/:id                         — admin only
DELETE /api/eventos/:id                         — admin only
POST   /api/eventos/:id/inscribirse             — auth; uploads comprobante (image|PDF)
DELETE /api/eventos/:id/inscribirse             — auth; cancel own pending registration
GET    /api/eventos/:id/inscripciones           — admin only
PATCH  /api/eventos/:id/inscripciones/:userId/confirmar  — admin only
PATCH  /api/eventos/:id/inscripciones/:userId/rechazar   — admin only

GET    /api/site-config                         — public (section enable/disable flags)
PATCH  /api/site-config                         — admin only

GET    /api/comunidades                         — optionalAuth; directory (memberCount + viewerStatus)
GET    /api/comunidades/mias                    — auth; own memberships + prefs (viewing, skin)
PUT    /api/comunidades/preferencias            — auth; set viewing[] + skin (⊆ memberships)
POST   /api/comunidades                         — admin only; create (slug auto-derived)
GET    /api/comunidades/:slug                   — optionalAuth; detail (publicView)
PUT    /api/comunidades/:slug                   — admin only; edit (partial; slug immutable; sections)
DELETE /api/comunidades/:slug                   — admin only (403 base, 409 if has content)
PUT    /api/comunidades/:slug/skin              — admin only; edit skin tokens (sanitized) + brand
POST   /api/comunidades/:slug/logo              — admin only; multipart logo (variant light|dark)
POST   /api/comunidades/:slug/reasignar-a-base  — admin only; move content to base (before delete)
POST   /api/comunidades/:slug/join              — auth; open=join, approval=pending, code=validate
DELETE /api/comunidades/:slug/leave             — auth; leave (403 base)
GET    /api/comunidades/:slug/solicitudes       — subadmin/admin; pending join requests
POST   /api/comunidades/:slug/solicitudes/:userId/aceptar|rechazar  — subadmin/admin
GET    /api/comunidades/:slug/miembros          — subadmin/admin; lean member list (gestión)
DELETE /api/comunidades/:slug/miembros/:userId  — subadmin/admin; expel
PUT    /api/comunidades/:slug/subadmins/:userId — admin only; assign/revoke subadmin

POST   /api/friends/:id/request
DELETE /api/friends/:id/request                 — cancel sent request
POST   /api/friends/:id/accept
POST   /api/friends/:id/reject
DELETE /api/friends/:id                         — unfriend

GET    /api/notifications                       — own, newest first, limit 60
PATCH  /api/notifications/read                  — mark read by tableId or fromUserId or all
DELETE /api/notifications                       — clear all

GET    /api/dm                                  — conversation list (latest msg + unread per contact)
GET    /api/dm/:userId                          — paginated message history; friends only
POST   /api/dm/:userId                          — send message; friends only
PATCH  /api/dm/:userId/read                     — mark messages from that user as read

POST   /api/push/subscribe                      — auth; upsert this device's Web Push subscription
POST   /api/push/unsubscribe                    — auth; remove this device's subscription (by endpoint)

GET    /api/admin-chat                          — last 100 messages; admin only
POST   /api/admin-chat                          — send message; admin only

GET    /api/users                               — optionalAuth; shared infra (DMs, torneos, BG Watch). With ?community=<id>: that community's members, gated by `comunidad` section + membership (admin bypass)
GET    /api/users/:id                           — public profile (NOT gated by `comunidad`; linked from notifs/DMs)

GET    /api/admin/*                             — isAdmin only
```

### Frontend pages

```
App (ThemeProvider + AuthProvider + SiteConfigProvider + CommunityProvider + NotificationProvider + ChatProvider + Router)
├── components/layout/          ← shell (GuestNavbar/GuestSidebar/GuestBottomNav, Sidebar, Navbar,
│                                  BottomNav, BoardGameBackground, SplashScreen,
│                                  ToastContainer, PageTransition)
├── components/shared/          ← GameTile, LoginPromptModal, SectionGate, CommunitySelect ("Publicar en")
├── components/admin/           ← AdminViewToggle, ViewAsUserBanner
├── components/chat/            ← ChatWindowManager, ChatLauncher, ChatWindow
│
├── pages/auth/                 ← Login, Register, VerifyEmail, ForgotPassword, ResetPassword
│                                  + PasswordInput, AuthLogo
│
├── pages/dashboard/            ← Dashboard /mesas + TableCard
├── pages/tables/               ← TableDetail /mesas/:id, CreateTable /mesas/crear, EditTable /mesas/:id/editar
├── pages/compartidas/          ← Compartidas / + /compartidas (default landing), CompartidaPost /compartidas/:id
│                                  + CompartidaCard, CompartidaSkeleton, CompartidasSidebar, CreateCompartidaForm
├── pages/noticias/             ← Noticias /noticias, NoticiaDetail /noticias/:id
├── pages/torneos/              ← Torneos /torneos, TorneoDetail /torneos/:id,
│                                  CreateTorneo /torneos/crear, EditTorneo /torneos/:id/editar
│                                  + Bracket, LeagueStandings, LeagueRoundsList,
│                                    RecordResultModal, SeedReorderModal, AdminPanel,
│                                    RegistrationsList, ParticipantsList, RegisterButton,
│                                    AddParticipantModal, GroupsView, GroupStandings,
│                                    GameScoreModal, PhaseTransitionModal
├── pages/eventos/              ← Eventos /eventos, EventoDetail /eventos/:id,
│                                  EventoInscripciones /eventos/:id/inscripciones (admin)
│                                  + EventoCard, EventoSkeleton
├── pages/me/                   ← MeFeed /mi + FeedCard  (own tables feed)
├── pages/comunidades/          ← Comunidades /comunidades ("Mis Comunidades" directory),
│                                  ComunidadDetail /comunidades/:slug (member list),
│                                  ComunidadGestion /comunidades/:slug/gestion (subadmin)
├── pages/users/                ← UserProfile /perfil, UserProfilePublic /usuarios/:id,
│                                  UsersList (member-list browser; rendered embedded by
│                                  ComunidadDetail with a communityId prop)
├── pages/messages/             ← Messages /mensajes, DirectChat /mensajes/:userId, AdminChat /mensajes-admin
├── pages/notifications/        ← Notifications /notificaciones
├── pages/bg-watch/             ← BgWatchProfile /bg-watch/:bggUsername,
│                                  BgWatchPerGameView /bg-watch/:user/juego/:gameId,
│                                  BgWatchLanding /bg-watch
│                                  + PartidasPanel, ColeccionPanel, PlayCard,
│                                    PlayDetailModal, CreatePlayModal, Pagination
│                                  (legacy /perfil-bgg/* redirige a /bg-watch/* vía LegacyBggRedirect en App.jsx)
├── pages/utilidades/           ← Utilidades /utilidades, Dado /utilidades/dado,
│                                  Temporizador /utilidades/temporizador,
│                                  FingerSelector /utilidades/selector-de-dedos
│                                  + UtilCard. Forced-dark — ignore active theme.
└── pages/admin/                ← DatabaseViewer /base-de-datos, PanelAdmin /panel-admin
                                   (both isActuallyAdmin only; PanelAdmin embeds CommunitiesAdmin —
                                   create/edit communities, skin pickers, per-community section toggles)
```

### Image uploads

All image uploads go through Multer (memory storage, no disk) before Cloudinary. Constraints: 5 MB max per file; accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Cloudinary folders by resource type:

- Tables: `turnocero/tables/<tableId>/` (transformed to max 1200 px wide)
- Compartidas: `turnocero/compartidas/<compartidaId>/`
- Noticias: `turnocero/noticias/`
- Torneos: `turnocero/torneos/` (banner per tournament; max 1200 px wide)
- Eventos: `turnocero/eventos/` (banner) and `turnocero/eventos/<eventoId>/comprobantes/` for payment receipts (also accepts PDF — stored as `resource_type: 'raw'`)
- Comunidades: `turnocero/communities/<communityId>/` (per-community light/dark logos; max 400 px wide)
- User avatars: `turnocero/users/<userId>/avatar.webp` with `public_id: 'avatar'` + `overwrite: true` + `format: 'webp'` + 400×400 `c_fill, g_face`, `quality: 'auto'`. The fixed publicId means every upload atomically replaces the previous asset — no explicit `destroy` is needed in `PUT /api/auth/avatar` and orphans are impossible. `DELETE /api/auth/avatar` still calls `cloudinary.uploader.destroy()` explicitly.

### User avatars and identity rendering

`User.avatar` is a `{ url, publicId }` subdocument (was a `String` until 2026-05). A `pre('init')` hook in [server/models/User.js](server/models/User.js) normalizes legacy string values into the new shape on hydrate, so old documents migrate lazily on next save — no migration script.

All user avatar slots in the UI go through `<Avatar user={...} size="xs|sm|md|lg|xl" />` in [client/src/components/shared/Avatar.jsx](client/src/components/shared/Avatar.jsx). It handles three states:

- Has avatar URL → renders `<img loading="lazy">`.
- No avatar → initials over a deterministic brand color hashed from `_id` (palette: `--amber`, `--red`, `--green`, `--orange`, `--purple`). The same user always gets the same color.
- Deleted user (per `getUserDisplay`) → `<GhostIcon>` on a muted background.

**Do not render `username[0].toUpperCase()` in new code** — use `<Avatar>`. The shared component already replaces ad-hoc initials in chat, comments, tables, compartidas, eventos, user lists, etc.

`getUserDisplay` in [client/src/utils/userDisplay.js](client/src/utils/userDisplay.js) normalizes any user shape (including legacy string avatars) into `{ name, isDeleted, _id, username, displayName, avatar: { url, publicId } }`. Always go through it instead of touching `user.username` / `user.avatar` directly.

When adding a new server route that returns a populated user reference, **include `avatar` in the `.populate(...)` select** so the client can render it. Most existing populates already use `'username displayName avatar'`.

Upload UI: [client/src/components/shared/AvatarCropModal.jsx](client/src/components/shared/AvatarCropModal.jsx) wraps `react-easy-crop` (1:1 aspect, round shape, pan/zoom), outputs a 600×600 JPEG @ 0.9 client-side, then the server transform (see Image uploads) reduces it to 400×400 WebP.

### Internationalization (i18n)

The app is bilingual: **Argentine Spanish (`es`, default) + English (`en`)**, chosen via the toggle in `/perfil`. **All user-facing strings go through i18n keys present in both languages** — hardcoded literals (in either language) are a bug. Full convention: `.claude/memory/feedback_i18n_keys.md`; audit with `/i18n-audit` (this supersedes `/spanish-audit`).

- **Client:** `react-i18next` + `i18next`. `const { t } = useTranslation();` → `t('ns:section.key')`. Resources in `client/src/i18n/resources/{es,en}/<ns>.json` (one file per domain namespace; `common` is the default). Keys are semantic English; plurals via `_one`/`_other` + `count`; interpolation via `{{var}}`. `LanguageContext` ([client/src/context/LanguageContext.jsx](client/src/context/LanguageContext.jsx)) mirrors `ThemeContext` — persists to `localStorage` (`STORAGE_KEYS.LANGUAGE`), sets `<html lang>`, sets the axios `Accept-Language` header, and calls `i18n.changeLanguage`. An inline script in `index.html` restores `<html lang>` pre-hydration.
- **Server:** `i18next` + `i18next-http-middleware` ([server/i18n/](server/i18n/)), mounted in `app.js` before the routes. It reads `Accept-Language` and attaches `req.t` / `req.language` (fallback `es`). Routes use `throw httpError(4xx, req.t('errors:key'))`; emails/cron use `getFixedT(user.language, ns)` to localize by the **recipient's** stored `User.language` (enum `['es','en']`, default `'es'`, set via `PUT /api/auth/profile`).
- **Formatting:** never hardcode `"es-AR"` — use [client/src/utils/locale.js](client/src/utils/locale.js) (`getLocale`, `formatNumber`, `formatDate`, `formatTime`), which read the active language.
- **URLs stay Spanish** — routing slugs are NOT translated, only display text (see "Frontend routing").
- **Tests:** the test setups load the real `es` resources so existing Spanish assertions stay green when a string becomes a key; `es↔en` key-parity is enforced (`client/src/i18n/parity.test.js`, `server/tests/unit/i18n/i18n.test.js`). Every new/migrated string ships es + en + a test.
- **Rollout:** **complete (2026-06-23).** Every user-facing client string is keyed (es + en) across 24 incremental PRs; 23 content namespaces (`common`, `auth`, `notifs`, `time`, `dates`, `enums`, `quotes`, `layout`, `toasts`, `shared`, `error`, `comunidades`, `mathtrade`, `noticias`, `dashboard`, `torneos`, `usuarios`, `eventos`, `compartidas`, `tables`, `admin`, `bgwatch`, `chat`), es↔en parity enforced in CI. New features add their own namespace; run `/i18n-audit` before shipping. Two regression notes (byte-identical es / the `common:*`-reuse trap, and the PWA precache cap raised to 3 MiB — check the real build exit code) live in `.claude/memory/feedback_i18n_keys.md`.

### Server error format

All error responses return `{ message: '<string>' }`. Status codes: `400` validation/bad request, `401` unauthenticated, `403` forbidden, `404` not found, `500` server error.

Two rate limiters in `routes/auth.js`:

- `authLimiter` (10/15min per IP): `/register`, `/login`, `/verify-email`, `/reset-password`.
- `emailLimiter` (3/15min per IP, stricter — these trigger outbound email): `/resend-verification`, `/forgot-password`. Both always respond `200` with a generic message to avoid leaking which emails are registered.

The `403` for unverified login includes `code: 'email_not_verified'` plus `email` in the body; the `403` for banned accounts includes `code: 'banned'` plus `bannedReason` if set.

### OG / Vercel middleware

`client/middleware.js` intercepts compartida share links for social crawlers (WhatsApp, Twitter, Facebook, etc.) and injects OG meta tags from `GET /api/compartidas/:id/og`. `client/vercel.json` rewrites all other paths to `/index.html` for SPA routing.

### Notification persistence

`server/utils/saveNotification.js` upserts notifications rather than creating new ones. Types `chat`, `comment`, `image`, and `join_request` aggregate (increment count on existing); all others overwrite.

### Styling and theming

CSS Modules per component. Global CSS variables in `client/src/index.css` define two themes:

- **Dark** (default, applied when `<html data-theme="dark">` or no attribute): the Blizzard-style dark navy palette.
- **Light** (applied when `<html data-theme="light">`): overrides only the neutrals (`--bg-*`, `--text-*`, `--border`, `--overlay-*`, `--shadow-*`); brand accents (`--amber`, `--red`, `--green`, `--orange`, `--purple`) stay the same in both.

`ThemeContext` ([`client/src/context/ThemeContext.jsx`](client/src/context/ThemeContext.jsx)) owns the current theme, persists it to `localStorage` under `turnocero_theme`, and applies `data-theme` to `<html>`. It is the outermost provider in [`App.jsx`](client/src/App.jsx) (wraps `AuthProvider` so login/splash also respect the theme). An inline script in [`client/index.html`](client/index.html) reads the stored preference and applies `data-theme` before React hydrates, to avoid a FOUC.

The toggle UI lives in the "Apariencia" section at the top of `/perfil`. Available tokens (use these instead of literal colors):

- Backgrounds: `--bg-dark`, `--bg-card`, `--bg-elevated`, `--bg-hover`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Borders: `--border`, `--border-amber`
- Brand: `--amber` (+ `--amber-light`, `--amber-dark`, `--amber-glow`), `--red`, `--green`, `--orange`, `--purple`
- Opacity variants of brand colors: `--amber-10/15/20/25/30/35/40/50`, `--red-10/15/25/30`, `--green-10/15/25/30/35/40`, `--orange-10/15/25/30/45/80`, `--purple-10/15/30/40/70`. Add new ones to `index.css` rather than inlining `rgba()`.
- Theme-aware overlays: `--overlay-soft`, `--overlay-medium`, `--overlay-strong` (white on dark, dark on light).
- `--on-amber`: always white — use for text on amber/red/green/orange/purple buttons or badges, not literal `#fff`.

Shadows using `rgba(0,0,0,X)` are theme-agnostic and may stay as literals. `--shadow-sm`/`--shadow-md` are softer in light mode.

Forced-dark "tool" screens (`/utilidades/dado`, `/utilidades/temporizador`, `/utilidades/selector-de-dedos`) and the auth `.showcase*` blocks intentionally hardcode a dark mood and ignore the active theme — keep that convention for similar immersive surfaces. For runtime-read colors in JSX/SVG (e.g. Leaflet markers), read via `getComputedStyle(document.documentElement).getPropertyValue('--amber')` inside a `useEffect([theme])` so the color refreshes on toggle — see `buildMarkerIcon` in [UserProfile.jsx](client/src/pages/users/UserProfile.jsx).

#### Breakpoints (responsive)

Media-query breakpoints are a **single canonical scale** in [client/src/breakpoints.css](client/src/breakpoints.css), exposed as `@custom-media` tokens (CSS vars do NOT work inside `@media`). Resolved at build by `postcss-custom-media` + `@csstools/postcss-global-data` (see [client/postcss.config.js](client/postcss.config.js)), which injects the defs into every `*.module.css` — so any module can write `@media (--below-desktop) { … }` with no import.

| Token | Resolves to | Meaning |
|---|---|---|
| `--desktop` / `--below-desktop` | `min-width: 960px` / `max-width: 959px` | The structural quiebre: desktop sidebar ⟷ mobile drawer. **The dominant one** — anything that depends on "is there a sidebar" must move here, never at a nearby value. |
| `--tablet` | `max-width: 880px` | Wide content / forms reflow to one column. |
| `--phone` | `max-width: 600px` | Cards/grids collapse to a single column. |
| `--compact` | `max-width: 480px` | Small phones; stack/hide secondary controls. |

**Always use the token, never a raw px for these transitions.** A near-but-different literal (e.g. `940` vs `959`) is exactly what caused a widget to render twice in the 941–959px gap on Compartidas. One-off component widths (a single card/modal reflowing at its natural width) may stay literal but should snap to the nearest token. `npm run lint:breakpoints` ([scripts/check-breakpoints.mjs](client/scripts/check-breakpoints.mjs)) fails CI on a reserved value used as a literal or any width in the 941–958px drift gap — run it pre-commit.

## Environment Setup

Copy `server/.env.example` to `server/.env`:

```
MONGODB_URI=mongodb://localhost:27017/turnocero
JWT_SECRET=<any_secret>
PORT=4000
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CORS_ORIGIN=http://localhost:3000
# 32-byte hex (64 chars) — encrypts BGG passwords at rest.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BGG_CREDS_KEY=
# Resend — required for email verification, password reset, and any outbound mail.
# Without it, server/utils/email.js logs a warning and skips sending (codes still
# appear in the server console in non-production for manual testing).
RESEND_API_KEY=
EMAIL_FROM=onboarding@resend.dev
```

The client needs `client/.env` (or `client/.env.local`) for:

```
VITE_API_URL=http://localhost:4000
# OAuth login — mismos valores que GOOGLE_CLIENT_ID / FB_APP_ID del server.
VITE_GOOGLE_CLIENT_ID=
VITE_FB_APP_ID=
# Web Push — la VAPID PUBLIC key (igual a VAPID_PUBLIC_KEY del server). Es
# pública, se embebe en el build. Sin esto, el botón "Activar" no suscribe.
VITE_VAPID_PUBLIC_KEY=
```

### BG Watch (BGG integration)

User-facing name is **BG Watch**; pages live under [client/src/pages/bg-watch/](client/src/pages/bg-watch/) and the feature is gated by `SiteConfig.sections.bgwatch`. The `/perfil-bgg/*` paths still exist but redirect to `/bg-watch/*` via `LegacyBggRedirect` in [App.jsx](client/src/App.jsx).

The `/api/bgg` routes proxy the **BoardGameGeek XML API2** server-side (avoids the CORS issue that broke the earlier direct-from-browser attempt — see git history for PRs #13–#22). Per-user lookups use an in-memory L1 cache (30 min) that the client can bypass with `?refresh=1`. Game details, user collections and user plays go through persistent Mongo L2 layers so they survive restarts and are shared across all users.

**Persistent layers:**

- `BggGame` ([server/models/BggGame.js](server/models/BggGame.js)) — game details and thumbnails. No TTL (immutable). Helpers: `resolveGame(id)`, `resolveGamesBatch(ids)`.
- `BggCollection` ([server/models/BggCollection.js](server/models/BggCollection.js)) — one doc per `bggUsername` with the user's owned-games array. **6 h TTL** via `lastFetchedAt`. Helper: `resolveCollection(bggUsername, { forceRefresh })`.
- `BggPlay` ([server/models/BggPlay.js](server/models/BggPlay.js)) — one doc per `(bggUsername, playId)` storing every play. Populated by **explicit user action** (the "Sincronizar con BGG" button in `/perfil`), not automatically — see below.

**Cache layering — `memoria → Mongo → BGG`:**

- `GET /game/:id`, `/search` (thumbnail batch), `/partidas/:user` (thumbnail enrichment) all flow through `resolveGame*` helpers.
- `GET /coleccion/:user` flows through `resolveCollection`. `?refresh=1` skips both L1 and the Mongo TTL check.
- `GET /partidas/:user` checks `BggPlay.exists` for that user. If true → serves from Mongo (paginated + filtered as Mongo queries, no BGG call) and `?refresh=1` triggers an incremental delta sync. If false → falls back to the BGG XML + in-memory cache path (legacy behavior for users who never clicked "Sincronizar").

**Plays sync model (Phase 3):**

- `POST /api/bgg/sync` (auth required) wipes `BggPlay` for the authenticated user's `bggUsername` and refetches every page from BGG. Updates `User.bggSync.lastFullSyncAt` and `lastFullSyncCount`. Triggered by the "↻ Sincronizar con BGG" button.
- `POST/PUT/DELETE /api/bgg/partidas` keep `BggPlay` in sync after Turnocero-driven mutations (only when records exist for that user — see `upsertPlayFromMutation`).
- `?refresh=1` on `/partidas` runs a lightweight delta sync (`mindate=last-play-date - 1d`) to catch newly logged plays. It does NOT catch edits/deletes the user made directly on BGG's web UI — that's what the full-sync button is for.
- `clearUserCache(bggUsername)` (called from `auth/bgg-connect`) also wipes `BggCollection` AND every `BggPlay` for that user.

To add a new persistent entity follow the same pattern: model + `resolveXxx` helper. Immutable data has no TTL; mutable data uses `lastFetchedAt` + manual refresh + `clearUserCache` integration where appropriate.

`PartidasPanel` and `ColeccionPanel` expose an **"Actualizar"** button that fires a refetch with `?refresh=1` (server skips its in-memory cache and goes to BGG). After clicking, the button is disabled for **60 s** with a visible countdown ("Esperá Xs"), then re-enables. The cooldown is purely client-side, per-panel — navigating away and back resets it.

Read endpoints (no auth needed for any of these):

- `GET /api/bgg/search?q=<term>` — game name search (sorted by year desc, top 15)
- `GET /api/bgg/game/:id` — game details (name, image, year, min/max players)
- `GET /api/bgg/coleccion/:bggUsername` — full owned collection with ratings + numPlays
- `GET /api/bgg/partidas/:bggUsername?page&mindate&maxdate&id` — paginated plays (10/page client-side, re-paginated from BGG's 30/page). Enriched with full player data (name, username, score, win, new, rating, color), `comments`, `incomplete`, `nowinstats` flags, and game thumbnails (batch-fetched).

Write endpoints (auth required, BGG account must be connected):

- `POST /api/bgg/partidas` — create play
- `PUT /api/bgg/partidas/:playId` — edit play
- `DELETE /api/bgg/partidas/:playId` — delete play

**How writes work** (and the risk): The XML API is read-only. To enable writes, we POST to BGG's internal `geekplay.php` endpoint (the same one used by their web UI) using a session cookie obtained from `POST /login/api/v1`. This requires storing the user's BGG password. It's encrypted at rest with **AES-256-GCM** using the `BGG_CREDS_KEY` env var (a 32-byte hex). Session cookies are cached in memory for 15 min. If BGG returns 401, credentials are marked `invalid: true` and the user is prompted to reconnect.

**Caveat**: `geekplay.php` is not officially documented and could change without notice. If writes start failing, check the endpoint structure first.

User profile flow:

- `/perfil` has a "Conexión con BoardGameGeek" section to connect/disconnect the BGG account. Endpoints: `POST /api/auth/bgg-connect`, `DELETE /api/auth/bgg-connection`.
- `User.bggCredentials` (subdocument) is excluded from `toJSON`; only derived flags `bggConnected`, `bggInvalid`, `bggConnectedAt` are exposed to clients.
- Changing `bggUsername` automatically clears stored credentials.

**Carga/edición de partidas (`PlayForm`)** — full-page form at `/bg-watch/:user/partidas/nueva` (accepts `?juego=<id>` + `?volver=<ruta>`) and `/.../partidas/:playId/editar` ([PlayForm.jsx](client/src/pages/bg-watch/PlayForm.jsx) + `CreatePlay`/`EditPlay`). Plan (100% done): [plans/bg-watch-carga-partidas-mejoras.md](plans/bg-watch-carga-partidas-mejoras.md); see also the memory note `project_bg_watch_play_form`. Highlights: position derived from score (`playerPositions.js`, competition ranking + cyberpunk glitch on change); **win auto-assigned to the highest score** (`assignWinsByScore`); date via the shared `<DateTimePicker dateOnly allowPast maxDate={today}>`; **duration suggestion = BGG's box `playingTime`** (from `/game/:id`, lazily backfilled — NOT a real average); guest "Nuevo" autodetect only with positive knowledge (`known && !played`); local draft (`usePlayDraft`); "Usar última juntada" prefill; deep-links from collection/PlayCard. The "Cantidad" (BGG `quantity`) field was removed (still preserved on edit). Pickers (`MyGamesPicker`/`LocationPicker`/`PlayerPicker`) use `<EmptyState>`.

An optional 5th section **"Compartí esta partida"** (create-only) lets the user also publish a **juntada** Compartida from the same form and copies its deeplink to the clipboard for WhatsApp/Telegram (BGG plays can't hold photos — those live in Compartidas). It's a **clickable card that slides open** (grid-rows transition, no checkbox) revealing the reusable controlled [`JuntadaFields`](client/src/pages/compartidas/JuntadaFields.jsx) (privacy + games + title + body + photos) + `<CommunitySelect>`; the just-logged game is pre-seeded (removable). Instead of pre-filling the body, the juntada embeds a **play-results widget**: a `playResult` snapshot ([`buildPlayResult`](client/src/pages/bg-watch/buildPlayResult.js) from the same `scorecardRows` as the live preview) is stored on the Compartida, and [`CompartidaCard`](client/src/pages/compartidas/CompartidaCard.jsx) renders the BG Watch [`Scorecard`](client/src/pages/bg-watch/Scorecard.jsx) (new `publicView` mode — winner banner, no "(vos)") in the photo area via [`playResultToScorecard`](client/src/pages/bg-watch/playResultToScorecard.js). The snapshot counts as content (a scorecard-only juntada is valid). The 2-step create+images+cleanup flow is shared via [`createJuntada`](client/src/pages/compartidas/createJuntada.js). `CreatePlay.handleSubmit` orchestrates **play first, then juntada in an isolated try/catch** — a failed Compartida never rolls back the saved play. See memory `project_bg_watch_play_form` → "Sección 5".

## Testing

**Stack**: Vitest (both workspaces) + supertest + mongodb-memory-server (server integration) + @testing-library/react + jsdom + MSW (client component tests).

**Root scripts** (run both workspaces):

- `npm test` → server + client unit + integration tests
- `npm run test:coverage` → coverage reports in both `server/coverage/` and `client/coverage/`
- `npm run test:server` / `npm run test:client` to run just one side

**Current coverage** (2026-05-22): **518 server tests + 1377 client tests = 1895 total**. Server includes notification contract regressions (`notificationsContract.test.js`) verifying every notif emit carries `notifId`+`count`. Client includes double-count regressions in `NotificationContext.test.jsx` (replay same payload twice ≠ double; markRead resets count). Plan and rollout tracked in [plans/testing-infrastructure.md](plans/testing-infrastructure.md).

**Layout — server** (`server/`):

- `tests/setup.js` — connects `MongoMemoryServer`, sets `JWT_SECRET` + `BGG_CREDS_KEY` test env vars, clears all collections between tests.
- `tests/helpers/auth.js` — `createUser(overrides)`, `createAuthedUser(overrides)`, `tokenFor(user)`, `authHeader(token)`.
- `tests/helpers/factories.js` — `createTable`, `createCompartida`, `createNoticia`, `createTorneo`, `createEvento`.
- `tests/mocks/` — stubs for external boundaries (`cloudinary.js`, `email.js`). Apply per test with `vi.mock('../../config/cloudinary', () => require('../mocks/cloudinary'))`.
- `tests/unit/utils/*.test.js` — pure utility tests, no Mongo.
- `tests/integration/*.test.js` — supertest-driven API tests; require `app` from `../../app` (not `server.js`, which boots Mongo/socket).

**Layout — client** (`client/`):

- `src/test/setup.js` — `@testing-library/jest-dom`, jsdom polyfills (`URL.createObjectURL`, canvas, matchMedia, IntersectionObserver), MSW lifecycle.
- `src/test/server.js` — MSW server with sensible default handlers (`/api/auth/me` → 401, `/api/site-config`, `/api/notifications`); override per test via `server.use(...)`.
- `src/test/wrappers/AllProviders.jsx` — `<AllProviders>` (Helmet + Theme + MemoryRouter) for context-light components, `<RouterOnly>` for pure presentationals that just need `<Link>`.
- `src/test/factories/users.js` — `makeUser(overrides)` returns API-shape user object including `avatar: { url, publicId }`.
- Tests live next to source: `Avatar.jsx` ↔ `Avatar.test.jsx`. Pure JS utilities use `*.test.js`.

**App refactor for testability**: `server/app.js` builds and exports the Express app (routes, middleware) without Mongo or Socket.io; `server/server.js` imports it and adds the boot (DB + listen + sockets). Supertest works against `app` directly without listening on a port.

**Coverage**: HTML reports at `server/coverage/index.html` and `client/coverage/index.html`. No enforcement threshold currently; that's intentional during backfill.

**Convention** (active, post-backfill): **every new component, route, hook, util, or method ships with its corresponding tests in the same PR/commit** — both client and server. No exceptions, even for "small" additions. Concretely:

- New client component `Foo.jsx` → `Foo.test.jsx` next to it.
- New client util `bar.js` → `bar.test.js` in `client/src/utils/`.
- New server route → integration test in `server/tests/integration/`.
- New server utility/model method → unit test in `server/tests/unit/`.
- Bug fixes get a regression test that fails before the fix and passes after.
- Pure helpers extracted from components (color hashing, formatters, route matchers) belong in `client/src/utils/` and are tested there once instead of per call-site.
- When extending an existing component, extend its existing test file (don't create a parallel one).

## Known limitations / decisions

- Chat history is capped at the last 200 messages per table (server-side).
- The `Rating` model and routes exist but the UI for ratings is not yet fully implemented.

## Notes for Claude

- The `Glob` tool sometimes returns "No files found" for folders that actually exist and contain matching files (observed with `plans/`). When this happens — especially for a folder the user has explicitly mentioned — verify with `ls` via bash or with `Grep` before concluding the folder/files don't exist. `Read` and `Grep` work fine on these paths; the issue is only with `Glob` enumeration.
