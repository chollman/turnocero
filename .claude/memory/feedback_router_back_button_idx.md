---
name: feedback-router-back-button-idx
description: 'Para botones "Volver" que necesitan distinguir entrada directa (link compartido, nueva tab) vs navegación in-app, usar `window.history.state?.idx` de React Router v6, no `location.key`.'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8af2fb3a-7dce-4e40-8efb-12f4c79a4da3
---

En páginas con botón "Volver" que deben caer a un fallback razonable cuando el user llegó por un link directo (no hay historial al que volver), usar el `idx` que React Router v6 trackea en `window.history.state`:

```js
const canGoBack = (window.history.state?.idx ?? 0) > 0;
const goBack = () => (canGoBack ? navigate(-1) : navigate("/fallback"));
```

- `idx > 0` → hubo navegación in-app previa (click o redirect dentro del SPA). `navigate(-1)` saca al user al lugar correcto.
- `idx === 0` (o sin state) → entrada directa (tab nueva, link compartido, deep-link de notif push). `navigate(-1)` saldría del sitio o haría algo raro; mejor caer a una página índice (ej. `/usuarios`, `/eventos`).

**Why:** `location.key !== 'default'` no sirve — sobrevive a reloads y da falsos positivos. Y `window.history.length` cuenta también el historial pre-SPA (otros sitios visitados en esa tab), así que tampoco distingue navegación in-app. `idx` es interno de React Router v6 y se incrementa solo cuando el router navega.

**How to apply:** úsalo en cualquier página detalle con botón "Volver" que se pueda alcanzar tanto por link compartido como por navegación in-app — perfiles públicos, detalles de evento/torneo/compartida, etc. Cambiar también el label del botón en el caso fallback ("← Volver a jugadores" vs "← Volver") para que el destino quede claro.

Visto en [UserProfilePublic.jsx](client/src/pages/users/UserProfilePublic.jsx) — commit `ae6ff21`.
