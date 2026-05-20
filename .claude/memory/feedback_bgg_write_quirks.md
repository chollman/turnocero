---
name: bgg-write-quirks
description: "Gotchas no-obvios al escribir partidas en BGG via geekplay.php - el id en /xmlapi2/plays es game-id, y delete requiere finalize=1+B1=Yes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: afe57894-e1b2-41c8-806f-6594c10e9c69
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

**How to apply:** toda mutacion en BGG necesita verificacion post-write contra el XML publico; no confies en el 2xx de geekplay. Relacionado: [[bgg-cache-pattern]], [[bgg-sync-engine]], [[bgg-username-case]].
