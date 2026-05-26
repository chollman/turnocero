---
name: feedback-user-rate-limit
description: "Authed expensive endpoints use `server/middleware/userRateLimit.js` factory (keyed by `req.user._id`, not IP — NAT breaks per-IP); skipped under NODE_ENV=test"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 92c9193d-d562-4786-a099-944475d22163
---

# Rate limiting per-user (tech-debt P4.5)

**Desde:** 2026-05-22 — `server/middleware/userRateLimit.js` es la factory canónica para limitar endpoints authed por user, no por IP.

## Por qué per-user (no per-IP)

Express-rate-limit default usa IP. Para endpoints públicos eso está bien. Pero los endpoints caros que protegemos son TODOS authed:

- `POST /api/bgg/sync` — full re-fetch de plays contra BGG
- `POST/PUT/DELETE /api/bgg/partidas` — writes a `geekplay.php` (endpoint no público de BGG, baneo silencioso si abusamos)
- `POST /api/eventos/:id/inscribirse` — upload a Cloudinary
- `POST /api/eventos/:id/ludoteca` — batch resolveGame a BGG

Si dos users tras el mismo NAT (oficina, cafe, mobile carrier-grade NAT) comparten cuota, el segundo se come el 429 que disparó el primero. Per-user los aísla.

## Uso

```js
const userRateLimit = require("../middleware/userRateLimit");

const myLimiter = userRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: "Demasiados pedidos, esperá unos minutos.",
});

router.post("/expensive", protect, myLimiter, async (req, res) => { ... });
```

- **`windowMs` y `max` requeridos** — el factory tira si faltan (defensiva contra config typos).
- **Key:** `req.user?._id?.toString()` → fallback `ip:<req.ip>` si no hay user (defensiva si se monta antes de `protect`).
- **Skip en `NODE_ENV=test`** automático — la suite puede spamear sin pegarse 429.

## Límites actuales (commit final del audit)

| Endpoint                        | Window | Max | Justificación               |
| ------------------------------- | ------ | --- | --------------------------- |
| `POST /bgg/sync`                | 5 min  | 3   | Full re-fetch BGG, muy caro |
| `POST/PUT/DELETE /bgg/partidas` | 5 min  | 30  | Mutations a geekplay.php    |
| `POST /eventos/:id/inscribirse` | 15 min | 5   | Cloudinary upload           |
| `POST /eventos/:id/ludoteca`    | 5 min  | 30  | Batch BGG resolves          |

Si agregás un endpoint nuevo que sea caro (Cloudinary upload, batch a BGG, full-scan Mongo aggregation, etc.), poné el limiter en el momento — el factory es 2 líneas de boilerplate.
