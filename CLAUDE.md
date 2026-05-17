# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Turnocero** is a full-stack web app for the Argentine board-game community. Core feature: organize *mesas* (game sessions) — create, join, chat, and manage them. Additional features: *Compartidas* (social posts about sessions), *Noticias* (admin news/announcements), *Torneos* (admin-managed tournaments — league and single-elimination), a friends system, direct messages between friends, and public browsing without login. The UI and all user-facing content are in **Argentine Spanish**. The app is deployed as a **PWA** (vite-plugin-pwa; assets in `client/public/`).

## Development Commands

Run both servers in separate terminals:

```bash
# From repo root
npm run dev:server    # Express backend on port 4000 (nodemon)
npm run dev:client    # Vite frontend on port 3000

# First-time setup
npm run install:all   # Installs both server and client deps
```

No test commands are configured. ESLint runs as a pre-commit hook via the `/react-review` skill.

## Frontend routing

All client-side routes **must use Spanish slugs**. Examples: `/mesas`, `/mesas/crear`, `/mesas/:id/editar`, `/compartidas`, `/noticias`, `/torneos`, `/torneos/crear`, `/torneos/:id/editar`, `/perfil`, `/usuarios`, `/notificaciones`, `/mi`, `/mensajes`, `/base-de-datos`. The only exceptions are `/login` and `/register`.

## Git conventions

Always write commit messages in **English**.

## Architecture

### Monorepo structure
- `client/` — React 18 + Vite frontend
- `server/` — Express + Mongoose + Socket.IO backend

The Vite dev server proxies `/api/*` to `http://localhost:4000/api`, so all frontend API calls use relative `/api/...` paths. The Socket.IO client connects directly to `http://localhost:4000` (or `VITE_API_URL`).

### Auth flow
1. `POST /api/auth/register` or `/login` → JWT (24-hour) + user object returned
2. `AuthContext` stores the token in `localStorage` and sets it as the Axios default `Authorization` header
3. On app load, `GET /api/auth/me` re-validates the token
4. `App.jsx` uses `<PrivateRoute>` for auth-only pages and `<PublicRoute>` for login/register; most pages are accessible without login

### App shell and layout
`App.jsx` renders a two-column shell for authenticated users:
- `<Sidebar />` — left nav (desktop), authenticated only
- `<Navbar />` — top bar (mobile), authenticated only
- `<BottomNav />` — bottom nav (mobile), authenticated only
- `<GuestNavbar />` — top bar shown to unauthenticated visitors (not on login/register pages)
- `<SplashScreen />` — shown during initial auth load
- `<BoardGameBackground />` — decorative canvas background rendered behind all content

### Table lifecycle
- Created with `status: 'open'`, `host = currentUser`, `players = []`, `privacy = 'public'`
- Mongoose pre-save hook auto-sets `status = 'full'` when `players.length >= maxPlayers` and reverts to `'open'` if a player leaves
- `privacy: 'private'` tables use a join-request flow: `POST /:id/join` adds to `pendingRequests`; host accepts/rejects via `POST /:id/requests/:userId/accept|reject`
- Host can edit (PUT) or cancel (DELETE → `status = 'cancelled'`); cancelled tables are excluded from all list queries

### Compartidas
Social posts that users create to share moments from their sessions. Stored in the `Compartida` model:
- `privacy`: `'public'` | `'friends'` | `'private'` — visibility governed by `User.friends[]`
- `linkedTable`: optional ref to a Table the author participated in
- Supports likes (toggle), images (max 3, Cloudinary, `turnocero/compartidas/:id/`), and comments (`CompartidaComment` model)
- Feed returns a `featured` post (most-liked in last 24 h) alongside paginated results
- Public compartidas are browsable without login; `GET /api/compartidas/:id/og` serves OG metadata for crawlers

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

### Friends system
Stored on the `User` model: `friends: [ObjectId]` and `friendRequests: [{ from, sentAt }]`. Managed via `/api/friends/:id/request|accept|reject` and `DELETE /api/friends/:id`. The friends list gates `'friends'`-privacy Compartidas and DM access.

### Direct Messages (DM)
Friends-only real-time chat. `DirectMessage` model: `from`, `to`, `content` (max 1000 chars), `readByRecipient`.

- `GET /api/dm` returns a conversation list (latest message + unread count per contact, via aggregation)
- `GET /api/dm/:userId` returns paginated history (40/page, max 100); 403 if not friends
- `POST /api/dm/:userId` sends a message; emits `dm:message` to recipient's socket with an `isNewConversation` flag
- `PATCH /api/dm/:userId/read` marks all messages from that user as read

**ChatContext** manages the desktop DM experience (up to 3 floating chat windows). It registers a listener with `NotificationContext.addDmListener` to receive incoming messages, increments per-conversation unread counts, and exposes `openChat`, `closeChat`, `minimizeChat`, `sendMessage`, and `dmUnreadTotal`. On mobile (< 960 px), clicking a conversation navigates to `/mensajes/:userId` (the `DirectChat` page) instead of opening a floating window.

### Admin Chat
Shared real-time chat room visible only to admins. `AdminMessage` model: `from`, `content` (max 2000 chars). On socket connect, admins auto-join `admin:room`. The `admin:message` event is broadcast to that room. `NotificationContext` tracks an `adminChatUnread` counter (via `setAdminChatActive`). Routes: `GET /api/admin-chat` (last 100 messages), `POST /api/admin-chat`.

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

### NotificationContext
Owns the Socket.IO connection for the authenticated user. On mount, loads persisted notifications from `GET /api/notifications` (MongoDB, last 60) and mirrors any updates back via `PATCH /api/notifications/read` and `DELETE /api/notifications`. Also drives in-app toasts (max 4 visible). `setActiveTable(tableId)` suppresses notifications for the currently open table and auto-marks them read. `unreadCount` drives the nav badge. DM messages are routed through `addDmListener` (consumed by `ChatContext`) rather than stored as persistent notifications.

### Key API endpoints
```
POST   /api/auth/register|login
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/profile                        — update displayName, nombre, apellido, direccion, telegram, celular, bggUsername
POST   /api/auth/bgg-connect                    — validate BGG password and store encrypted
DELETE /api/auth/bgg-connection                 — remove stored BGG credentials

GET    /api/bgg/search?q=                       — game name search (top 15, sorted by year)
GET    /api/bgg/game/:id                        — game details (cached 30 min)
GET    /api/bgg/coleccion/:bggUsername          — full collection with ratings + numPlays
GET    /api/bgg/partidas/:bggUsername           — plays (?page, ?mindate, ?maxdate, ?id)
POST   /api/bgg/partidas                        — log a play (auth + bggConnected)
PUT    /api/bgg/partidas/:playId                — edit a play (auth + bggConnected)
DELETE /api/bgg/partidas/:playId                — delete a play (auth + bggConnected)

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

GET    /api/admin-chat                          — last 100 messages; admin only
POST   /api/admin-chat                          — send message; admin only

GET    /api/users
GET    /api/users/:id

GET    /api/admin/*                             — isAdmin only
```

### Frontend pages
```
App (ThemeProvider + AuthProvider + NotificationProvider + ChatProvider + Router)
├── components/layout/          ← shell (GuestNavbar, Sidebar, Navbar, BottomNav,
│                                  BoardGameBackground, SplashScreen, ToastContainer)
├── components/shared/          ← GameTile, LoginPromptModal
│
├── pages/auth/                 ← Login, Register + PasswordInput, AuthLogo
│
├── pages/dashboard/            ← Dashboard / + TableCard
├── pages/tables/               ← TableDetail /mesas/:id, CreateTable /mesas/crear, EditTable /mesas/:id/editar
├── pages/compartidas/          ← Compartidas /compartidas, CompartidaPost /compartidas/:id
│                                  + CompartidaCard, CompartidaSkeleton, CompartidasSidebar, CreateCompartidaForm
├── pages/noticias/             ← Noticias /noticias, NoticiaDetail /noticias/:id
├── pages/torneos/              ← Torneos /torneos, TorneoDetail /torneos/:id,
│                                  CreateTorneo /torneos/crear, EditTorneo /torneos/:id/editar
│                                  + Bracket, LeagueStandings, LeagueRoundsList,
│                                    RecordResultModal, SeedReorderModal, AdminPanel,
│                                    RegistrationsList, ParticipantsList, RegisterButton,
│                                    AddParticipantModal, GroupsView, GroupStandings,
│                                    GameScoreModal, PhaseTransitionModal
├── pages/me/                   ← MeFeed /mi + FeedCard  (own tables feed)
├── pages/users/                ← UsersList /usuarios, UserProfile /perfil, UserProfilePublic /usuarios/:id
├── pages/messages/             ← Messages /mensajes, DirectChat /mensajes/:userId, AdminChat /mensajes-admin
├── pages/notifications/        ← Notifications /notificaciones
├── pages/bgg/                  ← BggProfile /perfil-bgg/:bggUsername,
│                                  PerGameView /perfil-bgg/:user/juego/:gameId
│                                  + PartidasPanel, ColeccionPanel, PlayCard,
│                                    PlayDetailModal, CreatePlayModal, Pagination
└── pages/admin/                ← DatabaseViewer /base-de-datos (isAdmin only)
```

### Image uploads
All image uploads go through Multer (memory storage, no disk) before Cloudinary. Constraints: 5 MB max per file; accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Cloudinary folders by resource type:
- Tables: `turnocero/tables/<tableId>/` (transformed to max 1200 px wide)
- Compartidas: `turnocero/compartidas/<compartidaId>/`
- Noticias: `turnocero/noticias/`
- Torneos: `turnocero/torneos/` (banner per tournament; max 1200 px wide)

### Server error format
All error responses return `{ message: '<string>' }`. Status codes: `400` validation/bad request, `401` unauthenticated, `403` forbidden, `404` not found, `500` server error. Auth routes (`/register`, `/login`) are rate-limited: 10 attempts per 15 minutes per IP.

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
```

The client needs `client/.env` (or `client/.env.local`) for:
```
VITE_API_URL=http://localhost:4000
```

### BGG integration

The `/api/bgg` routes proxy the **BoardGameGeek XML API2** server-side (avoids the CORS issue that broke the earlier direct-from-browser attempt — see git history for PRs #13–#22). All endpoints cache responses in-memory (5 min default, 30 min for game details).

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

## Known limitations / decisions

- Chat history is capped at the last 200 messages per table (server-side).
- The `Rating` model and routes exist but the UI for ratings is not yet fully implemented.

## Notes for Claude

- The `Glob` tool sometimes returns "No files found" for folders that actually exist and contain matching files (observed with `plans/`). When this happens — especially for a folder the user has explicitly mentioned — verify with `ls` via bash or with `Grep` before concluding the folder/files don't exist. `Read` and `Grep` work fine on these paths; the issue is only with `Glob` enumeration.
