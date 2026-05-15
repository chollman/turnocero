---
name: Turnocero current feature set
description: All major features currently in the app, including those not yet documented in CLAUDE.md
type: project
originSessionId: 41f12a4a-0d0f-4cdd-9366-b0de11a11bf2
---
The app has grown significantly beyond what CLAUDE.md documents. Current feature set as of 2026-05-13:

**Why:** Several major features were added in recent commits (news, compartidas, friends, public browsing) that aren't reflected in CLAUDE.md.  
**How to apply:** Use this as the authoritative feature list when reasoning about scope, suggesting related changes, or avoiding duplication.

## Features present in the codebase

### Noticias (News)
- Route: `/noticias`, `/noticias/:id`
- Server: `GET|POST|PUT|DELETE /api/noticias` — public read, admin-only write
- Pages: `Noticias.jsx`, `NoticiaDetail.jsx`
- Supports: title, body, image (Cloudinary), optional link + linkLabel, author, OG metadata

### Compartidas (Social Posts)
- Route: `/compartidas`, `/compartidas/:id`
- Server: `GET|POST|PUT|DELETE /api/compartidas` and nested endpoints for likes, images, comments
- Privacy model: `public` | `friends` | `private`
- Can optionally link to a Table the author participated in
- Supports: likes (toggle), images (max 3, Cloudinary), comments (CRUD), "Compartida del día" (most-liked in last 24h)
- Public compartidas are visible without auth; friends/private respect the friends graph
- OG endpoint: `GET /api/compartidas/:id/og` for crawlers

### Friends System
- Server: `POST|DELETE /api/friends/:id/request`, `POST /api/friends/:id/accept|reject`, `DELETE /api/friends/:id`
- User model has `friends[]` and `friendRequests[]` arrays
- Socket.IO events: `friend:request`, `friend:accepted`
- Used by Compartidas privacy filter and notification system

### Public Browsing (no login required)
- Dashboard `/`, TableDetail `/tables/:id`, Compartidas `/compartidas`, Noticias `/noticias`, UsersList `/users`, UserProfilePublic `/users/:id` are accessible without auth
- GuestNavbar shown to unauthenticated users on non-auth pages
- LoginPromptModal for prompting guests to log in on gated actions

### Navigation & Layout
- `Sidebar` — desktop left sidebar (authenticated users)
- `BottomNav` — mobile bottom navigation bar (authenticated users)
- `GuestNavbar` — top nav for unauthenticated users
- `BoardGameBackground` — decorative canvas/CSS background behind all content
- `SplashScreen` — shown during initial auth loading

### MeFeed
- Route: `/me` — personal activity feed for authenticated users
- Page: `MeFeed.jsx`

### Separate notifications server route
- `server/routes/notifications.js` exists alongside the client-side `NotificationContext`
