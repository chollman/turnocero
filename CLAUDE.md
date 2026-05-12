# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Turnocero** is a full-stack web app for organizing board game sessions (mesas). Users register, create tables with game/date/player-count details, and join others' tables. The UI and all user-facing content are in **Argentine Spanish**.

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
4. `App.jsx` wraps protected pages in `<PrivateRoute>` and public pages in `<PublicRoute>`

### Table lifecycle
- Created with `status: 'open'`, `host = currentUser`, `players = []`, `privacy = 'public'`
- Mongoose pre-save hook auto-sets `status = 'full'` when `players.length >= maxPlayers` and reverts to `'open'` if a player leaves
- `privacy: 'private'` tables use a join-request flow: `POST /:id/join` adds to `pendingRequests`; host accepts/rejects via `POST /:id/requests/:userId/accept|reject`
- Host can edit (PUT) or cancel (DELETE → `status = 'cancelled'`); cancelled tables are excluded from all list queries

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

### NotificationContext
Manages the persistent notification list (stored in `localStorage`) and in-app toasts. `setActiveTable(tableId)` suppresses notifications for the currently open table and auto-marks them read. `unreadCount` drives the Navbar badge.

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

GET    /api/users
GET    /api/users/:id

GET    /api/admin/*                             — isAdmin only
```

### Frontend pages and hierarchy
```
App (AuthProvider + NotificationProvider + Router)
├── Login / Register            ← PublicRoute
└── PrivateRoute
    ├── Navbar                  ← unread notification badge, "Nueva Mesa", logout
    ├── Dashboard               ← tabs All/Mine, search, server-side pagination → TableCard
    ├── TableDetail             ← chat (Socket.IO), pending requests panel (host),
    │                              comments, emoji reactions, image gallery,
    │                              follow/unfollow, action buttons (join/leave/cancel/edit)
    ├── CreateTable             ← form with quick-pick popular games
    ├── EditTable               ← host-only edit (date, maxPlayers, location, description, privacy)
    ├── Notifications           ← notification list with markRead / clearAll
    ├── UserProfile             ← own profile: avatar (Cloudinary), nombre, apellido,
    │                              direccion (lat/lng), telegram, celular, displayName
    ├── UserProfilePublic       ← public view of any user
    ├── UsersList               ← community screen
    └── DatabaseViewer          ← isAdmin only; raw collection viewer
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
