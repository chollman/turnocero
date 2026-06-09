---
name: feedback-public-page-protected-calls
description: Any fire-and-forget protected (auth-required) API call that runs on a PUBLIC page bounces anonymous visitors to /login via the global 401 interceptor — guard such calls on auth state
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22a3c986-4cfb-44c7-abbe-b2b17361ff30
---

The global axios response interceptor in [AuthContext.jsx](client/src/context/AuthContext.jsx) redirects to `/login` on **any** 401 from a non-`/api/auth/` route (`isUnauth = status === 401 && !isAuthRoute` → `navigate("/login")`). A per-call `.catch(() => {})` does NOT prevent this — the interceptor runs first.

Consequence: any fire-and-forget call that hits a `protect` endpoint while running on a **public** page will bounce a genuine anonymous visitor to login, even though the page itself is public.

**Bug fixed (2026-06-09):** entering a **public compartida deeplink** (`/compartidas/:id`) logged out kicked the visitor to `/login`. Root cause: `CompartidaPost` calls `setActiveCompartida(id)` on mount → `NotificationContext.markReadCompartida` → `axios.patch('/api/notifications/read', …)` which is `protect` → 401 → interceptor redirect. The same applied to **every public detail page** (`setActiveTable`/`setActiveEvento`/`setActiveTorneo` on `/mesas/:id`, `/eventos/:id`, `/torneos/:id`). Fix: in `NotificationContext` an `authedRef` (ref mirroring `!!user`) guards the server sync in every mutating helper (`markRead*`, `clearAll`, `dismiss`, `markAllRead`) — local state still updates, only the axios call is skipped when there's no session.

**Why it hid in testing:** auth is dual (Bearer token in localStorage + httpOnly cookie, SSO). Clearing localStorage is NOT enough to be anonymous — the cookie still authenticates. To truly test the guest flow in the preview, `POST /api/auth/logout` to clear the cookie, then confirm `GET /api/auth/me` returns 401.

**How to apply:** before adding any axios call to a `protect` endpoint that can fire on a public route (mount effects, background sync, optimistic updates), gate it on auth state or it WILL bounce guests. Routes that are public for reads: compartidas/mesas/eventos/torneos/noticias detail + lists (all `optionalAuth` server-side). Note `AppShell` renders `<AppRoutes>` even during auth `loading` (splash is just an overlay), so route mount effects fire before `user` resolves — guarding during that unknown-auth window is intentional (it's what protects guests); the rare authed fresh-full-load auto-mark-read is the accepted tradeoff. See [[feedback_notifications_architecture]].
