---
name: project_oauth_login
description: "Login/registro con OAuth de Google y Facebook — arquitectura token-based, vinculación por email, partial index"
metadata:
  node_type: memory
  type: project
  originSessionId: 49ae60ec-30e0-4278-baf7-f1a4cc913b52
---

OAuth de Google + Facebook agregado en `feature/oauth-login` (2026-06-01). **Token-based, sin Passport ni sesiones** — reutiliza el JWT existente (`{ id }`, 24h).

**Backend:**

- Rutas `POST /api/auth/oauth/google { accessToken }` y `/facebook { accessToken }` en [server/routes/auth.js](server/routes/auth.js). **Google usa access token** (flujo implícito, no ID token — para poder renderizar botón propio acorde al theme): se valida con `google-auth-library` `OAuth2Client.getTokenInfo` exigiendo `aud === GOOGLE_CLIENT_ID` (anti token-substitution) + `email_verified`, y se enriquece nombre/foto vía `userinfo` (best-effort). Facebook valida el access token vía Graph API (`/debug_token` chequea `app_id`+`is_valid`, luego `/me`); sin email otorgado → 400.
- Lógica find-or-create en [server/services/oauthService.js](server/services/oauthService.js): match por `googleId`/`facebookId` → match por email (**vincula** + `emailVerified=true`) → crea cuenta nueva verificada y **sin password** con username auto-generado (`generateUniqueUsername`).
- Modelo `User`: `googleId`/`facebookId` con **partial index** unique filtrado por `$type:string` (NO sparse — un `default:null` colisiona porque null cuenta como valor). `password` requerido condicional `!this.googleId && !this.facebookId`. `authProviders[]`; los ids crudos se borran en `toJSON`.

**Frontend:**

- `oauthLogin(provider, payload)` en [AuthContext.jsx](client/src/context/AuthContext.jsx) espeja `login()`.
- `<GoogleOAuthProvider>` envuelve la app en [App.jsx](client/src/App.jsx). Componente compartido [OAuthButtons.jsx](client/src/pages/auth/OAuthButtons.jsx) (Login + Register): **dos botones propios con estilo themed `.oauthBtn`** (Google con `useGoogleLogin` flujo implícito → access token; Facebook con hook [useFacebookSdk.js](client/src/hooks/useFacebookSdk.js) que carga el FB JS SDK por script). Se eligió botón custom (no el `<GoogleLogin>` oficial) para que matcheen la identidad del sitio. **COOP**: el documento se sirve con `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Vite `server.headers` + `client/vercel.json`) o los popups quedan bloqueados al hacer `postMessage`.

**Decisiones (confirmadas por el usuario):** email existente → vincular automático; ambos proveedores; username auto-generado editable luego en `/perfil`.

**Env:** server `GOOGLE_CLIENT_ID`, `FB_APP_ID`, `FB_APP_SECRET`; client `VITE_GOOGLE_CLIENT_ID`, `VITE_FB_APP_ID`. Facebook requiere App Review de Meta para el permiso `email` en prod.

**Gotcha de tests (server):** el repo evita `vi.mock` (no intercepta CJS `require()` en vitest 4); mockeé `google-auth-library` parchando `require.cache` ANTES de requerir la app — ver [tests/integration/oauthAuth.test.js](server/tests/integration/oauthAuth.test.js) y el patrón en `tests/setup.js`. Login/Register tests stubean `OAuthButtons` (`vi.mock("./OAuthButtons")`) para no arrastrar GoogleOAuthProvider/ThemeProvider. Relacionado: [[feedback_service_layer]], [[feedback_inline_svg_icons]], [[feedback_tests_required]].
