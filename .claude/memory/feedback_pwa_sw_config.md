---
name: feedback-pwa-sw-config
description: "PWA service worker must skipWaiting + clientsClaim + cleanupOutdatedCaches so deploys don't leave users on a stale cache (white screen after cache clear)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: pwa-sw-stale-cache-fix
---

The PWA SW in `client/vite.config.js` (vite-plugin-pwa → workbox) MUST configure:

```js
workbox: {
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/api\//],
  runtimeCaching: [{ urlPattern: /^\/api\//, handler: "NetworkOnly" }],
}
```

## Why each flag

- **`skipWaiting: true`** — the new SW activates immediately on install instead of waiting for every open tab to close. Without it, a user with the site open while you deploy keeps the OLD SW active until they restart the browser. The old SW still serves the cached `index.html` that points to JS chunks that no longer exist on the server → white screen.
- **`clientsClaim: true`** — the new SW takes control of already-loaded pages on activation, instead of only controlling pages loaded AFTER it activated.
- **`cleanupOutdatedCaches: true`** — drops precaches from earlier SW versions so we don't keep serving deleted chunks from old precache buckets.
- **`navigateFallbackDenylist: [/^\/api\//]`** — without this the SW serves the SPA shell HTML for `/api/*` failures, which breaks the client's JSON-parsing code paths.

## Symptoms when missing

User reports white screen on mobile after a deploy + cache clear. Desktop works fine because they don't have the SW registered there. The fix above is preventive — once a user is stuck, they have to force-clear (incognito tab, or iOS Settings → Safari → Advanced → Website Data → delete the domain, or Android Chrome → Site settings → Clear & reset). After that one-time unstuck, future deploys roll over automatically.

If you ever touch the PWA config, do NOT remove these flags.

## Restaurar el deep-link al refrescar la PWA (`usePwaRouteRestore`, 2026-06-16)

Síntoma: en la PWA instalada (Android), al refrescar/reabrir, la app **arranca en el root** y pierde la ruta actual (el SO recarga el `start_url: "/"`). Verificado que NO es un redirect del SPA: los guards (`PrivateRoute`/`AdminRoute`/`SectionGate`) esperan la carga (`return null` mientras loading) y `usePageTransition` arranca con la `useLocation()` real → la URL se pierde al boot, no hay bounce interno.

Fix: hook `client/src/hooks/usePwaRouteRestore.js`, montado en `AppShell` (dentro del `BrowserRouter`):

1. Persiste la ruta actual en `localStorage[STORAGE_KEYS.LAST_ROUTE]` en cada navegación (no las pantallas de auth).
2. En el arranque, **solo** si está en standalone (`matchMedia("(display-mode: standalone)")` || `navigator.standalone`) Y cayó en `"/"` Y hay ruta profunda guardada → `navigate(saved, { replace: true })`.

Captura la ruta guardada con `useState(() => localStorage.getItem(...))` ANTES de que el efecto de persistencia la pise. No-op en browser normal y cuando la URL se preserva sola. Tests en `usePwaRouteRestore.test.jsx`. No reproducible en el dev server (no es standalone).

## Guard global de overflow horizontal en mobile

`index.css`: `@media (--below-desktop) .appContent { overflow-x: clip }` → ninguna sección scrollea horizontal en el celular. `clip` (no `hidden`) NO crea contexto de scroll → no rompe `position:sticky` ni los `position:fixed` (drawer/FABs). Scopeado a mobile para no recortar tooltips inline en desktop. Causa típica del overflow: contenido más ancho que el viewport (palabras/URLs largas → además `overflow-wrap`+`min-width:0` en los grids).
