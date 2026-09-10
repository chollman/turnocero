---
name: feedback-bgg-write-quirks
description: "Gotchas no-obvios de las APIs no-documentadas de BGG (login/api/v1 + geekplay.php) - status codes cambiantes, Cloudflare, id=game-id, delete finalize=1+B1=Yes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: afe57894-e1b2-41c8-806f-6594c10e9c69
  modified: 2026-09-10T19:22:41.088Z
---

Dos quirks de la API de BGG que no son obvios y cuestan horas re-descubrir:

**1. `/xmlapi2/plays?id=X` filtra por GAME ID (thing), no por play ID.**

Para verificar que una partida se guardo o borro, no podes hacer `?username=X&id=PLAYID` - siempre devuelve vacio (PLAYID no es un thingId). Hay que narrowear por game + fecha y buscar el playId en los resultados parseados:

```
?username=X&id=GAMEID&mindate=YYYY-MM-DD&maxdate=YYYY-MM-DD
```

Ver `verifyPlayOnBgg(bggUsername, playId, { gameId, playdate })` en [server/routes/bgg.js](server/routes/bgg.js). En DELETE, mira `BggPlay` ANTES de borrar para obtener gameId+date.

**2. `geekplay.php` con `action=delete` requiere `finalize=1` + `B1=Yes`.**

Sin esos campos, BGG responde 200 con un HTML de "are you sure?" (la pagina de confirmacion del UI). El delete nunca se ejecuta y el caller cree que funciono (HTTP 2xx).

```js
form.set("ajax", "1");
form.set("action", "delete");
form.set("playid", String(playId));
form.set("finalize", "1");
form.set("B1", "Yes");
```

**Why:** `geekplay.php` no esta documentado y emula el flow del web UI. POST/PUT son one-shot, pero DELETE es two-step en el UI y `finalize=1` salta el primer paso. Sin esto, no hay error visible - solo silencio.

**How to apply:** toda mutacion en BGG necesita verificacion post-write contra el XML publico; no confies en el 2xx de geekplay. Relacionado: [[feedback-bgg-cache-pattern]], [[feedback-bgg-sync-engine]], [[feedback-bgg-username-case]].

**3. Los endpoints web de BGG (`/search/boardgame`, `/geeksearch.php`) están detrás de Cloudflare desde Node.**

El xmlapi2 NO está gateado y funciona normal desde el server. Pero los endpoints "web" que devuelven JSON (los que usa la propia autocomplete de bgg.com) sí — Cloudflare detecta el TLS fingerprint de Node y responde con un challenge HTML ("Just a moment…", 5KB de HTML en lugar del JSON esperado). curl pasa porque tiene otro JA3 fingerprint, pero Node fetch (con cualquier User-Agent, incluso uno de Chrome real) cae al challenge.

**Síntoma**: pediste JSON, recibís `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...`. `JSON.parse` tira y se cae al fallback.

**Implicancia**: la única forma de obtener el ranking nativo de BGG por relevancia (el orden de "loop": The LOOP, LOOP, Loop, Loop, LOOP: ...) requiere uno de:
- Spawnear `curl` desde Node (`child_process.execFile`) — agrega dep externa.
- Librería de impersonación TLS (`cycletls`, `curl-impersonate` bindings) — dep nativa.
- Implementar heurística propia sobre xmlapi2 — lo que hicimos en `scoreSearchMatch` de [server/routes/bgg.js](server/routes/bgg.js): bucket por tipo de match (exact > prefix-with-separator > word-boundary > substring) sobre `stripLeadingArticle(name)`, tiebreak por nombre corto y año desc.

**How to apply:** si vas a integrar otro endpoint web de BGG (autocomplete, geeksearch, geekitem, advsearch.php), asumí que va a estar Cloudflare-gated y planeá la heurística client-side de entrada. No vale la pena el intento + fallback — es solo código muerto.

**4. `login/api/v1` cambió su status code para credenciales inválidas: era 401/403, ahora es 400 con JSON `{errors:{message:"Invalid username or password"}}`.** Descubierto 2026-09-10 investigando un reporte de "no puedo vincular mi cuenta BGG" — confirmado con curl + Node fetch en vivo contra el endpoint real. `server/utils/bggAuth.js#loginToBgg` solo reconocía 401/403, así que una password mal tipeada caía al branch genérico `!res.ok` → 502 "no se pudo contactar BGG" en vez de "credenciales inválidas" (mensaje confuso pero no bloqueante).

**Bug relacionado, más grave:** el código viejo trataba CUALQUIER 403 como "credenciales inválidas" sin mirar el body. Pero un challenge de Cloudflare (bot-detection) también devuelve 403 — con una página HTML "Un momento…", nada que ver con la password. Eso significa que un usuario con password 100% correcta podía ver "tu contraseña es incorrecta" si BGG bloqueaba el POST por anti-bot antes de que llegara a su propio handler. Hay un thread de marzo 2026 en el foro de BGG ("POST requests to geekplay.php blocked by Cloudflare – any recent changes?") confirmando que BGG endureció la protección Cloudflare sobre sus endpoints POST no-documentados en 2026.

**Fix aplicado:** `loginToBgg` ahora solo mapea a "Credenciales BGG inválidas" (401) cuando el body es JSON parseable con `errors.message` (o status 401 puro). Un 400/403 con body no-JSON (challenge page) cae a 502 "BGG login respondió X" — no le echa la culpa a la password del usuario. Tests en `server/tests/unit/utils/bggAuth.test.js`.

**Pendiente / no resuelto:** `server/services/bgg/bggMutations.js#submitToGeekplay` (el flujo de escritura, no el de connect) tiene el mismo patrón ciego `status===401||403 → "Sesión BGG inválida, reconectá"` sin inspeccionar el body — mismo riesgo de mislabeling si Cloudflare intercepta un POST de escritura. No se tocó porque tiene tests que asumen el comportamiento viejo con body vacío y requiere confirmar primero el shape real de la respuesta de sesión-expirada vs challenge page. Flageado como tarea aparte.

**How to apply:** si `bgg-connect` vuelve a fallar, lo primero es un curl/node fetch en vivo contra `login/api/v1` con credenciales dummy para ver el status+body actual — la API no está documentada y BGG la cambia sin aviso. Si el fallo es específicamente "dice contraseña incorrecta pero es correcta", sospechar Cloudflare-block del lado servidor (IP de datacenter) antes que un bug de credenciales — revisar logs de producción por el body real (HTML vs JSON) de la respuesta.
