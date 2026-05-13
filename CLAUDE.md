# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Turnocero** is a full-stack web app for the Argentine board-game community. Core feature: organize *mesas* (game sessions) — create, join, chat, and manage them. Additional features: *Compartidas* (social posts about sessions), *Noticias* (admin news/announcements), a friends system, and public browsing without login. The UI and all user-facing content are in **Argentine Spanish**.

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

All client-side routes **must use Spanish slugs**. Examples: `/mesas`, `/mesas/crear`, `/mesas/:id/editar`, `/compartidas`, `/noticias`, `/perfil`, `/usuarios`, `/notificaciones`, `/mi`, `/base-de-datos`. The only exceptions are `/login` and `/register`.

## Git conventions

Always write commit messages in **English**.

## Architecture

### Monorepo structure
- `client/` — React 18 + Vite frontend
- `server/` — Express + Mongoose + Socket.IO backend

The Vite dev server proxies `/api/*` to `http://localhost:4000/api`, so all frontend API calls use relative `/api/...` paths. The Socket.IO client connects directly to `http://localhost:4000` (or `VITE_API_URL`).

### Auth flow
1. `POST /api/auth/register` or `/login` → JWT (7-day) + user object returned
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

### Friends system
Stored on the `User` model: `friends: [ObjectId]` and `friendRequests: [{ from, sentAt }]`. Managed via `/api/friends/:id/request|accept|reject` and `DELETE /api/friends/:id`. The friends list gates `'friends'`-privacy Compartidas.

### Socket.IO rooms and events
Each authenticated socket auto-joins `user:<userId>`. When entering a table detail page, the client emits `join:table <tableId>` to join `table:<tableId>`.

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

### NotificationContext
Owns the Socket.IO connection for the authenticated user. On mount, loads persisted notifications from `GET /api/notifications` (MongoDB, last 60) and mirrors any updates back via `PATCH /api/notifications/read` and `DELETE /api/notifications`. Also drives in-app toasts (max 4 visible). `setActiveTable(tableId)` suppresses notifications for the currently open table and auto-marks them read. `unreadCount` drives the nav badge.

### Key API endpoints
```
POST   /api/auth/register|login
GET    /api/auth/me

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

POST   /api/friends/:id/request
DELETE /api/friends/:id/request                 — cancel sent request
POST   /api/friends/:id/accept
POST   /api/friends/:id/reject
DELETE /api/friends/:id                         — unfriend

GET    /api/notifications                       — own, newest first, limit 60
PATCH  /api/notifications/read                  — mark read by tableId or fromUserId or all
DELETE /api/notifications                       — clear all

GET    /api/users
GET    /api/users/:id

GET    /api/admin/*                             — isAdmin only
```

### Frontend pages
```
App (AuthProvider + NotificationProvider + Router)
├── components/layout/          ← shell (GuestNavbar, Sidebar, Navbar, BottomNav,
│                                  BoardGameBackground, SplashScreen, ToastContainer)
├── components/shared/          ← GameTile, LoginPromptModal
│
├── pages/auth/                 ← Login, Register + PasswordInput, AuthLogo
│
├── pages/dashboard/            ← Dashboard / + TableCard
├── pages/tables/               ← TableDetail /tables/:id, CreateTable /create, EditTable /tables/:id/edit
├── pages/compartidas/          ← Compartidas /compartidas, CompartidaPost /compartidas/:id
│                                  + CompartidaCard, CompartidaSkeleton, CompartidasSidebar, CreateCompartidaForm
├── pages/noticias/             ← Noticias /noticias, NoticiaDetail /noticias/:id
├── pages/me/                   ← MeFeed /me + FeedCard
├── pages/users/                ← UsersList /users, UserProfile /perfil, UserProfilePublic /users/:id
├── pages/notifications/        ← Notifications /notifications
└── pages/admin/                ← DatabaseViewer /database (isAdmin only)
```

### Styling
CSS Modules per component. Global CSS variables in `client/src/index.css` define the dark amber/gold board-game theme: `--bg-dark`, `--amber`, `--green`, `--red`, `--text-primary`, etc. Always use these variables; never hardcode colors.

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
```

The client needs `client/.env` (or `client/.env.local`) for:
```
VITE_API_URL=http://localhost:4000
```

## Known limitations / decisions

- **No BGG integration**: A BoardGameGeek API integration was built and fully reverted (PRs #13–#21, reverted in #22) due to unresolvable CORS issues with the BGG API. Do not reintegrate without a concrete CORS solution.
- Chat history is capped at the last 200 messages per table (server-side).
- The `Rating` model and routes exist but the UI for ratings is not yet fully implemented.
