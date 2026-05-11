# Safari Auth Fix — Cross-Site Cookie Blocking

## Problem

The app is deployed across two different origins:

- **Frontend**: `https://chollman.github.io` (GitHub Pages)
- **API**: `https://turnocero-api.onrender.com` (Render)

Auth was implemented using an `httpOnly` cookie set on login/register. The frontend used `axios.defaults.withCredentials = true` so the browser would send that cookie on every API call.

This worked on Chrome and Firefox but failed silently on Safari: authenticated requests returned `401 Not authorized, no token`.

## Root Cause: Safari ITP

Safari's **Intelligent Tracking Prevention (ITP)** blocks third-party (cross-site) cookies. Even though the cookie was correctly configured with `SameSite=None; Secure` — which is the standard mechanism for allowing cross-site credentialed requests — Safari refuses to send it when the API domain (`onrender.com`) is classified as a tracker. A domain gets classified as a tracker when the user only ever reaches it via JavaScript fetch calls from another origin, never by navigating to it directly.

Chrome and Firefox honor `SameSite=None; Secure` for credentialed cross-origin requests. Safari does not.

## Fix Applied

The server's `protect` middleware already accepted both cookies and `Authorization: Bearer <token>` headers. The fix makes the client persist the JWT in `localStorage` and send it as a Bearer token on every request.

**Server** (`server/routes/auth.js`): login and register responses now include `token` in the JSON body alongside `user`. The cookie is still set for backwards compatibility with other browsers.

**Client** (`client/src/context/AuthContext.jsx`):
- On mount: reads token from `localStorage`, sets `Authorization` header, then validates via `GET /api/auth/me`.
- After login/register: stores `data.token` in `localStorage` and sets the header.
- On logout: removes the token from `localStorage` and clears the header.

This is additive — cookies still work for Chrome/Firefox, and the Bearer token path handles Safari.

## Long-Term Fix

The correct solution is to eliminate the cross-site boundary by hosting both the frontend and API under the same apex domain. For example:

| Service  | Domain                   |
|----------|--------------------------|
| Frontend | `turnocero.com`          |
| API      | `api.turnocero.com`      |

With a shared apex domain, configure the cookie as:

```js
{
  httpOnly: true,
  secure: true,
  sameSite: 'lax',         // 'none' no longer needed
  domain: '.turnocero.com', // shared across subdomains
}
```

`SameSite=lax` cookies are first-party from Safari's perspective, so ITP does not apply. The `localStorage`/Bearer workaround can then be removed.

This requires:
1. Registering a custom domain
2. Pointing it to GitHub Pages (frontend) and Render (API), or migrating to a host that serves both under the same domain
3. Updating `CORS_ORIGIN` env var and the Vite proxy config
