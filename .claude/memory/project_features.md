---
name: project-features
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
- Can optionally link to a Table (`linkedTable`) OR an Evento (`linkedEvento`) the author participated in — both fields validated server-side (must be author or have an active reg). Frontend list de candidatos: `/api/tables/mine` + `/api/eventos/mine`.
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

### Torneos (Tournaments — v1 added 2026-05-16; v2 same day adding Grupos + admin_only mode)
- Routes: `/torneos`, `/torneos/:id`, `/torneos/crear` (admin), `/torneos/:id/editar` (admin)
- Models:
  - `Torneo`: lifecycle `draft` → `registration` → `in_progress` → `finished`; new fields `inscriptionMode` ('open' | 'admin_only'), and groups-specific `tableSize`/`gamesPerGroup`/`qualifiersPerGroup`/`currentPhase`.
  - `TorneoMatch` (liga + single_elim only).
  - `TorneoGroup` and `TorneoGame` (groups format only): a group has players + advancedPlayers + status; a game has a `results: [{ player, score, position }]` array.
- **Three formats**:
  - **Liga** (round-robin, head-to-head, 3/1/0).
  - **Eliminación simple** (single-elim bracket, NCAA seeding, byes pre-advanced).
  - **Grupos** (multi-phase, multi-player tables, scored by native game points; top-C per group advance; admin can override advancedPlayers list before next-phase generation).
- Inscription modes:
  - `open`: users self-register, admin accepts/rejects (registration list, accept/reject actions).
  - `admin_only`: register button hidden; admin uses `AddParticipantModal` (search-and-pick from /api/users). State machine allows `draft → in_progress` directly.
- Fixture generation: `server/utils/tournamentGeneration.js` exports `generateLeagueFixture`, `generateSingleElimBracket`, `computeStandings`, `generateGroupsPhase` (snake seeding), `computeGroupStandings` (sum of PV, stable tiebreak by seed), `validateNextPhase` (suggests override-tableSize when cut is uneven).
- Groups lifecycle: admin starts → phase 1 generated (`POST /status` to `in_progress` calls `generateGroupsPhase`) → admin loads scores per game (`POST /games/:gameId/result`) → when all P games of a group done, group auto-completes + top-C assigned to `advancedPlayers` (admin can edit via `PATCH /groups/:groupId/advanced`) → admin generates next phase (`POST /next-phase`, preview at `/next-phase/preview`) → repeats until 1 final table → admin finalizes.
- 5 notification types: `tournament_accepted`, `tournament_rejected`, `tournament_advanced` (reused for both single-elim bracket advances and groups phase promotions), `tournament_eliminated`, and `tournament_pending` (only as toast confirmation when a user clicks "Inscribirme"). `Notification` schema has `torneoId`, `torneoTitle`, `round` fields.
- 4 socket events: `torneo:registration-accepted|rejected`, `torneo:advanced`, `torneo:eliminated` (all → `user:<id>`).
- RegisterButton shows an animated success row for 3s after registering, plus toast.
- TorneoCard shows "Inscripción cerrada" (instead of "Inscripción abierta") when `inscriptionMode === 'admin_only'`.
- Pages: `Torneos.jsx`, `TorneoDetail.jsx` (banner + admin panel + tabs by format), `CreateTorneo.jsx`, `EditTorneo.jsx`. Components in `pages/torneos/components/`: Bracket, LeagueStandings, LeagueRoundsList, RecordResultModal, SeedReorderModal, AdminPanel, RegistrationsList, ParticipantsList, RegisterButton, TorneoCard, ImageDropzone, AddParticipantModal, GroupsView, GroupStandings, GameScoreModal, PhaseTransitionModal.
- Cloudinary banner: `turnocero/torneos/` (max 1200 px wide).
- Drafts hidden from non-admins.
- All admin UI respects `isActuallyAdmin && !viewAsUser` — see [[feedback-admin-view-as-user]].

### Admin user moderation (added 2026-05-16)
- In `/usuarios` (Comunidad), admins see Ban/Unban + Delete buttons on each non-admin, non-self user card
- Banned users have a red "Baneado" badge; tooltip shows `bannedReason` if set
- Ban: `PATCH /api/admin/users/:id/ban` body `{ banned: bool, reason? }`, blocks login with 403 `{ code: 'banned', message }` and expels active sessions via the same check in `protect` middleware
- Delete: `DELETE /api/admin/users/:id` — hard delete + `$pull` cleanup of array refs (`players`, `pendingRequests`, `followers`, `reactions`, `friends`, `friendRequests`). Frees username/email for re-registration. Scalar refs (`host`, `author`, `sender`, `rater`, `uploader`, comment `author`, etc.) are left orphaned and surface as "Usuario eliminado" — see [[feedback-deleted-user]].
- Both endpoints reject self-target and admin-target with 400
- Frontend uses reusable `ConfirmActionModal` (`client/src/components/shared/`) for confirmation, with optional textarea for ban reason
- Banned-session expulsion uses 403 + `code: 'banned'` in the global axios interceptor in `AuthContext.jsx`; ban message is stashed in `sessionStorage.bannedMessage` and surfaced on the Login page
