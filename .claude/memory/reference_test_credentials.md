---
name: reference-test-credentials
description: Test user credentials for logging into the Turnocero preview/dev environment to verify authenticated pages
metadata:
  node_type: memory
  type: reference
  originSessionId: b4176895-872a-4701-8775-6200559db029
---

Test user for verifying authenticated pages in the preview/dev server:

- Email: `claudiohollman+5@gmail.com`
- Password: `YourStrongPassword1!`

Use these when a change is observable only behind `<PrivateRoute>` (e.g. `/eventos`, `/mesas`, `/torneos`, `/perfil`, `/notificaciones`) and the preview tools need to render the page. Login endpoint: `POST /api/auth/login`.

**Preview-auth gotcha (2026-06-09):** the preview env injects a cached test JWT via a hook, but it sets `localStorage["turnocero_token"]`. **AuthContext boots from `localStorage["token"]`** (`STORAGE_KEYS.TOKEN` in [utils/storageKeys.js](client/src/utils/storageKeys.js)), NOT `turnocero_token`. So to render a `<PrivateRoute>` page through a full reload you must `localStorage.setItem("token", <jwt>)` — setting only `turnocero_token` lets manual `fetch` calls auth (you pass the header yourself) but AuthContext stays logged-out and redirects to `/login`. Set both keys to be safe.

**Screenshot gotcha:** `preview_screenshot` often times out on pages with the animated `BoardGameBackground` canvas (the renderer never settles). Prefer `preview_inspect` / computed-style reads via `preview_eval` to verify styles — more reliable anyway.
