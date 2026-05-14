Audit all routes and pages in the app to verify that authentication and admin guards are correctly applied — no private page is accessible without login, no admin page is accessible without isAdmin.

## Background

Turnocero has three categories of access:
- **Public** — accessible without login (Dashboard, Compartidas feed, Noticias, UserProfilePublic, CompartidaPost OG)
- **Private** — requires authenticated user (most pages)
- **Admin** — requires `user.isAdmin === true` (DatabaseViewer, admin API routes)

On the frontend, `App.jsx` uses `<PrivateRoute>` and `<PublicRoute>` wrappers. On the backend, `server/middleware/auth.js` exports `protect`, `requireAdmin`, and `optionalAuth`.

A missing guard means a logged-out user can access personal data, or a regular user can access admin functions.

## Steps

### 1. Read the routing configuration

Read `client/src/App.jsx` in full. Extract every route (`<Route path="..." element={...} />`):
- Which wrapper it uses: `<PrivateRoute>`, `<PublicRoute>`, or none (bare `<Route>`)
- The component it renders

Build a table:

| Path | Component | Guard |
|---|---|---|
| `/` | Dashboard | none (public) |
| `/mesas/crear` | CreateTable | PrivateRoute |
| `/base-de-datos` | DatabaseViewer | PrivateRoute |
| etc. | | |

### 2. Classify each route's expected access level

Using the page name and CLAUDE.md as reference, determine what the correct guard should be:

**Should be public (no guard):**
- `/`, `/compartidas`, `/compartidas/:id`, `/noticias`, `/noticias/:id`, `/usuarios/:id`, `/login`, `/register`

**Should be private (PrivateRoute):**
- `/mesas/crear`, `/mesas/:id/editar`, `/mesas/:id`, `/mi`, `/perfil`, `/mensajes`, `/mensajes/:userId`, `/mensajes-admin`, `/notificaciones`, `/usuarios`

**Should be admin-only:**
- `/base-de-datos`
- Check if `DatabaseViewer` or `AdminChat` does an additional `isAdmin` check inside the component

### 3. Check for mismatches

For each route, compare actual guard vs. expected:
- **Missing PrivateRoute** on a private page → unauthenticated users can access it
- **PrivateRoute on a public page** → SEO/sharing broken, guest users blocked
- **Admin page with only PrivateRoute** → any logged-in user can access it; needs an in-component `isAdmin` check or a dedicated AdminRoute

### 4. Audit the backend

Read all files in `server/routes/`. For each router, check:

**a)** Does each route that modifies user data use `protect` middleware?  
**b)** Do all admin-only routes use `requireAdmin` middleware?  
**c)** Does any route use `optionalAuth` when it should use `protect` (e.g., writing data)?

Build a second table of backend gaps.

### 5. Audit in-component admin checks

Read `client/src/pages/admin/DatabaseViewer.jsx` and `client/src/pages/messages/AdminChat.jsx`. Verify they check `user?.isAdmin` and redirect or show an error if not admin — this is the defense-in-depth layer beyond the route guard.

### 6. Fix every gap found

**Frontend — missing PrivateRoute:**
In `App.jsx`, wrap the route element with `<PrivateRoute>`.

**Frontend — admin page needs extra check:**
Add a `useEffect` at the top of the component:
```js
useEffect(() => {
  if (user && !user.isAdmin) navigate('/');
}, [user, navigate]);
```

**Backend — missing `protect`:**
Add `protect` to the route middleware chain before the handler.

**Backend — missing `requireAdmin`:**
Add `requireAdmin` after `protect` in the middleware chain.

### 7. Report

**Frontend routes:**
- ✅ `/path` — correct guard
- 🔧 `/path` — fixed: [what was wrong]

**Backend routes:**
- ✅ `METHOD /api/path` — correct middleware
- 🔧 `METHOD /api/path` — fixed: [what was added]
