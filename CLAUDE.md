# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Turnocero** is a full-stack web app for organizing board game sessions (mesas). Users register, create tables with game/date/player-count details, and join others' tables. The UI and content are in Argentine Spanish.

## Development Commands

Run both servers in separate terminals:

```bash
# From repo root
npm run dev:server    # Express backend on port 4000 (nodemon)
npm run dev:client    # Vite frontend on port 3000

# First-time setup
npm run install:all   # Installs both server and client deps
```

From within each subdirectory:

```bash
# client/
npm run build     # Production Vite build
npm run preview   # Preview production build

# server/
npm start         # Production start (no nodemon)
```

No test or lint commands are configured.

## Git conventions

Always write commit messages in **English**.

## Architecture

### Monorepo structure
- `client/` — React 18 + Vite frontend
- `server/` — Express + Mongoose backend

The Vite dev server proxies `/api/*` to `http://localhost:4000/api`, so all frontend API calls use relative `/api/...` paths.

### Auth flow
1. `POST /api/auth/register` or `/login` → JWT (7-day) + user object returned
2. `AuthContext` ([client/src/context/AuthContext.jsx](client/src/context/AuthContext.jsx)) stores the token in `localStorage` and sets it as the Axios default `Authorization` header
3. On app load, `GET /api/auth/me` re-validates the token
4. `App.jsx` wraps protected pages in `<PrivateRoute>` and public pages in `<PublicRoute>`

### Table lifecycle
- Created with `status: 'open'`, `host = currentUser`, `players = []`
- Mongoose pre-save hook auto-sets `status = 'full'` when `players.length >= maxPlayers`
- Host can cancel (DELETE, sets `status = 'cancelled'`); join/leave are POST actions on `:id/join` and `:id/leave`
- Dashboard fetches `GET /api/tables` (all open) or `GET /api/tables/mine` (where user is host or player)

### Key API endpoints
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/tables            — all non-cancelled tables
GET    /api/tables/mine       — user's tables
POST   /api/tables            — create (protected)
POST   /api/tables/:id/join   — join (protected)
POST   /api/tables/:id/leave  — leave (protected)
DELETE /api/tables/:id        — cancel, host only (protected)
```

### Frontend component hierarchy
```
App (AuthProvider + Router)
├── Login / Register        ← PublicRoute
└── PrivateRoute
    ├── Navbar              ← username, "Nueva Mesa" button, logout
    ├── Dashboard           ← tab switch (All / Mine) + search; maps over TableCard
    │   └── TableCard       ← shows status, players, join/leave/cancel per role
    └── CreateTable         ← form with quick-pick popular games
```

### Styling
CSS Modules per component; global CSS variables in [client/src/index.css](client/src/index.css) define the dark amber/gold board-game theme (`--bg-dark`, `--amber`, `--green`, `--red`, etc.).

## Environment Setup

Copy `server/.env.example` to `server/.env` and fill in:

```
MONGODB_URI=mongodb://localhost:27017/turnocero
JWT_SECRET=<any_secret>
PORT=4000
```

MongoDB must be running locally (or provide an Atlas URI). The server defaults to port `5000` in code but `.env.example` uses `4000` — set `PORT=4000` to match the Vite proxy.
