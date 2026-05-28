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
