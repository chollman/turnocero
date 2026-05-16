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

### Admin user moderation (added 2026-05-16)
- In `/usuarios` (Comunidad), admins see Ban/Unban + Delete buttons on each non-admin, non-self user card
- Banned users have a red "Baneado" badge; tooltip shows `bannedReason` if set
- Ban: `PATCH /api/admin/users/:id/ban` body `{ banned: bool, reason? }`, blocks login with 403 `{ code: 'banned', message }` and expels active sessions via the same check in `protect` middleware
- Delete: `DELETE /api/admin/users/:id` — hard delete + `$pull` cleanup of array refs (`players`, `pendingRequests`, `followers`, `reactions`, `friends`, `friendRequests`). Frees username/email for re-registration. Scalar refs (`host`, `author`, `sender`, `rater`, `uploader`, comment `author`, etc.) are left orphaned and surface as "Usuario eliminado" — see [[feedback_deleted_user]].
- Both endpoints reject self-target and admin-target with 400
- Frontend uses reusable `ConfirmActionModal` (`client/src/components/shared/`) for confirmation, with optional textarea for ban reason
- Banned-session expulsion uses 403 + `code: 'banned'` in the global axios interceptor in `AuthContext.jsx`; ban message is stashed in `sessionStorage.bannedMessage` and surfaced on the Login page
