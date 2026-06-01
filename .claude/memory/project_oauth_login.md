---
name: project_oauth_login
description: "Login/registro con OAuth de Google y Facebook — arquitectura token-based, vinculación por email, partial index"
metadata:
  node_type: memory
  type: project
  originSessionId: 49ae60ec-30e0-4278-baf7-f1a4cc913b52
---

OAuth de Google + Facebook (2026-06-01). **Token-based, sin Passport ni sesiones** — reutiliza el JWT existente (`{ id }`, 24h). **Mergeado a master** vía PRs #39 (OAuth), #40 (COOP), #41 (botones themed + meta PWA + future flags React Router), #42 (fix email_verified string).

**Backend:**

- Rutas `POST /api/auth/oauth/google { accessToken }` y `/facebook { accessToken }` en [server/routes/auth.js](server/routes/auth.js). **Google usa access token** (flujo implícito, no ID token — para poder renderizar botón propio acorde al theme): se valida con `google-auth-library` `OAuth2Client.getTokenInfo` exigiendo `aud === GOOGLE_CLIENT_ID` (anti token-substitution) + `email_verified`, y se enriquece nombre/foto vía `userinfo` (best-effort). Facebook valida el access token vía Graph API (`/debug_token` chequea `app_id`+`is_valid`, luego `/me`); sin email otorgado → 400.
- Lógica find-or-create en [server/services/oauthService.js](server/services/oauthService.js): match por `googleId`/`facebookId` → match por email (**vincula** + `emailVerified=true`) → crea cuenta nueva verificada y **sin password** con username auto-generado (`generateUniqueUsername`).
- Modelo `User`: `googleId`/`facebookId` con **partial index** unique filtrado por `$type:string` (NO sparse — un `default:null` colisiona porque null cuenta como valor). `password` requerido condicional `!this.googleId && !this.facebookId`. `authProviders[]`; los ids crudos se borran en `toJSON`.

**Frontend:**

- `oauthLogin(provider, payload)` en [AuthContext.jsx](client/src/context/AuthContext.jsx) espeja `login()`.
- `<GoogleOAuthProvider>` envuelve la app en [App.jsx](client/src/App.jsx). Componente compartido [OAuthButtons.jsx](client/src/pages/auth/OAuthButtons.jsx) (Login + Register): **dos botones propios con estilo themed `.oauthBtn`** (Google con `useGoogleLogin` flujo implícito → access token; Facebook con hook [useFacebookSdk.js](client/src/hooks/useFacebookSdk.js) que carga el FB JS SDK por script). Se eligió botón custom (no el `<GoogleLogin>` oficial) para que matcheen la identidad del sitio. **COOP**: el documento se sirve con `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Vite `server.headers` + `client/vercel.json`) o los popups quedan bloqueados al hacer `postMessage`.

**Decisiones (confirmadas por el usuario):** email existente → vincular automático; ambos proveedores; username auto-generado editable luego en `/perfil`.

**Env:** server `GOOGLE_CLIENT_ID`, `FB_APP_ID`, `FB_APP_SECRET`; client `VITE_GOOGLE_CLIENT_ID`, `VITE_FB_APP_ID`.

**Gotcha Google `email_verified` (fix #42):** el endpoint `tokeninfo` de Google devuelve `email_verified` como **string `"true"`** (no booleano) y `getTokenInfo` NO lo convierte. El chequeo estricto `!== true` rechazaba TODOS los logins ("Tu email de Google no está verificado"). Hay que aceptar `true` || `"true"`. El happy-path del test usa el string a propósito.

**Config Google Cloud:** OAuth Client ID tipo **Web application**; el origen exacto (`http://localhost:3000`, dominio prod) debe estar en **Authorized JavaScript origins** (no en redirect URIs). Sin client secret (flujo implícito). Propagación de orígenes nuevos: minutos hasta ~horas.

**Config Facebook (Meta) — estado e issues:**

- En el dev console hay que **agregar `email` al caso de uso** de Facebook Login o sale "Invalid Scopes: email". Ya hecho.
- En modo **Desarrollo** funciona para admin + testers sin review.
- **Para abrir al público** falta (pendiente): (1) **verificación individual** de Claudio (DNI personal) — NO la de negocio (esa pide docs de empresa + un email `@turnocero.app` en loop, que no tenemos; la individual lo evita); (2) **Advanced Access** de `email`+`public_profile` vía App Review; (3) **URL de Política de Privacidad** + **callback/instrucciones de eliminación de datos** (obligatorios — TurnoCero aún NO tiene estas páginas, hay que crearlas: rutas tipo `/privacidad` y data-deletion); (4) pasar la app a **Live**.
- Si el flujo pide un email `@turnocero.app`: se puede resolver con reenvío (Cloudflare Email Routing si el DNS está en Cloudflare, o ImprovMX) → forward a Gmail, **sin pisar los registros DNS de Resend** (Resend firma sobre un subdominio). Pero la verificación individual evita necesitarlo.

**Gotcha de tests (server):** el repo evita `vi.mock` (no intercepta CJS `require()` en vitest 4); mockeé `google-auth-library` parchando `require.cache` ANTES de requerir la app — ver [tests/integration/oauthAuth.test.js](server/tests/integration/oauthAuth.test.js) y el patrón en `tests/setup.js`. Login/Register tests stubean `OAuthButtons` (`vi.mock("./OAuthButtons")`) para no arrastrar GoogleOAuthProvider/ThemeProvider. Relacionado: [[feedback_service_layer]], [[feedback_inline_svg_icons]], [[feedback_tests_required]].
