# Plan: verificar sincronización real con BGG en mutaciones de partidas

## Context

**Síntoma reportado:** al agregar/editar/borrar una partida desde BG Watch (`/bg-watch/...`), la partida aparece correctamente en la UI de Turnocero pero **no llega a BGG**. Pasa siempre, con cualquier partida.

**Por qué pasa:** `submitToGeekplay` ([server/routes/bgg.js:1286](server/routes/bgg.js:1286)) considera "éxito" cualquier respuesta HTTP 2xx de `geekplay.php` y devuelve el payload tal cual. Si BGG responde 200 con HTML/error/payload incompleto:

- `payload.playid` / `payload.numplays` quedan `undefined`
- `payload` se devuelve igual al endpoint
- POST: si BGG devolvió algún número (incluso erróneo), se mirrorea a `BggPlay`; si no, no se mirrorea — pero el endpoint **igual responde `{ success: true }`** al cliente.
- PUT/DELETE: el espejo Mongo se actualiza/borra **sin importar lo que BGG haya hecho realmente** (usa el `playId` de la URL, no del payload). De ahí el síntoma: la UI muestra el cambio (lectura desde Mongo) aunque BGG nunca persistió.

`geekplay.php` es no documentado (CLAUDE.md lo advierte) — necesitamos verificar contra BGG después de cada escritura en lugar de confiar en el status code.

**Decisión del usuario:** bloquear el guardado local si BGG no confirma la persistencia. La UI debe mostrar un error claro.

## Approach

Después de cada mutación, **verificar contra BGG** que la operación realmente persistió, usando el endpoint XML público `/xmlapi2/plays?username=X&id=PLAYID` (ya usado en el GET del panel — [bgg.js:1189](server/routes/bgg.js:1189)). Solo entonces tocar Mongo. Si BGG no confirma, devolver 502 y dejar Mongo intacto.

Reutilizar:
- `fetchBgg(url)` para el GET de verificación
- `parsePlay(play)` ([bgg.js:323](server/routes/bgg.js:323)) y `parsePlaysXml(xml)` ([bgg.js:368](server/routes/bgg.js:368)) para mapear la respuesta de BGG al schema `BggPlay`
- `resolveGame(id)` para el thumbnail

**Bonus**: al mirrorear desde la respuesta canónica de BGG (no desde `req.body`), el doc local queda idéntico a lo que BGG realmente guardó — elimina drift entre `BggPlay` y BGG que hoy depende de `upsertPlayFromMutation` reconstruyendo el doc desde la entrada del usuario.

## Plan

### 1. Nuevo helper `verifyPlayOnBgg(bggUsername, playId)` en [server/routes/bgg.js](server/routes/bgg.js)

Pegado a `submitToGeekplay` (cerca de [bgg.js:1286](server/routes/bgg.js:1286)).

- Hace `fetchBgg(`${BGG_API}/plays?username=X&id=PLAYID`)`
- Devuelve `null` si la jugada no aparece, o el `parsePlay` enriquecido con `gameThumbnail` (via `resolveGame`) si aparece
- Maneja flakiness de BGG con **1 reintento a los 600ms** (el `/plays` puede tardar un instante en reflejar un POST recién hecho)
- Si el segundo intento también devuelve vacío → `null` (caller decide si es error o éxito según operación)

### 2. Refactor de los tres endpoints en [server/routes/bgg.js:1473-1603](server/routes/bgg.js:1473)

Patrón compartido: **BGG primero → verificar → recién después tocar Mongo**.

**`POST /api/bgg/partidas`** ([bgg.js:1473](server/routes/bgg.js:1473)):
1. `submitToGeekplay` (igual que hoy)
2. Extraer `newPlayId = payload.playid || payload.numplays`
3. Si **no hay `newPlayId`** → 502 `"BGG no devolvió un ID de partida. La partida no se guardó."`
4. `verifyPlayOnBgg(bggUsername, newPlayId)` — si devuelve `null` → 502 `"BGG no confirmó la partida después de guardarla."`
5. Si confirma: **upsertear `BggPlay` con el doc canónico** que vino de BGG (no desde `req.body`). Solo si `BggPlay.exists` para el usuario (preserva el modo no-mirrored para usuarios sin sync inicial).
6. `clearPartidasCache` + responder `{ success: true, playid, play }`

**`PUT /api/bgg/partidas/:playId`** ([bgg.js:1563](server/routes/bgg.js:1563)):
1. `submitToGeekplay` (igual)
2. `verifyPlayOnBgg(bggUsername, playId)` — si devuelve `null` → 502 `"BGG no confirmó la edición."`
3. Si confirma: upsertear `BggPlay` con el doc canónico
4. `clearPartidasCache` + responder `{ success: true, playid, play }`

**`DELETE /api/bgg/partidas/:playId`** ([bgg.js:1519](server/routes/bgg.js:1519)):
1. `submitToGeekplay` (igual)
2. `verifyPlayOnBgg(bggUsername, playId)` — esta vez esperamos `null` (el play se borró). Si **devuelve algo** → 502 `"BGG no confirmó el borrado."`
3. Si confirmado borrado: `BggPlay.deleteOne` (igual que hoy)
4. `clearPartidasCache` + responder `{ success: true }`

### 3. Borrar `upsertPlayFromMutation` ([bgg.js:749-799](server/routes/bgg.js:749))

Ya no se usa. La nueva versión canónica del doc viene siempre de la respuesta de BGG (`parsePlay` + thumbnail vía `resolveGame`). Reemplazar las llamadas por un helper inline pequeño `upsertPlayFromBgg(bggUsername, parsedPlay)` que solo agrega el `hash` (`computePlayHash`) y hace `BggPlay.updateOne` upsert.

### 4. UI: cliente ya muestra el error

Reviso pero no espero cambios:
- `CreatePlayModal.handleSubmit` ([client/src/pages/bg-watch/CreatePlayModal.jsx:300](client/src/pages/bg-watch/CreatePlayModal.jsx:300)) ya captura errores del `axios.post/put` y los muestra. Solo confirmar que el mensaje del 502 se renderiza.
- Borrado: revisar el flow en `PlayDetailModal` (o donde esté el botón delete) y asegurar que el error 502 se muestra como toast/inline.

Si la UX existente no muestra el error claramente, ajustar el mensaje pero **no** cambiar la lógica de optimismo: por defecto, no hay optimismo — el panel re-fetchea cuando `onCreated/onDeleted` se llama, y si el endpoint falló, no se llama. Verificar.

### 5. Tests (regla "tests required for every new component and method")

**Server — `server/tests/integration/bgg-partidas-write.test.js`** (nuevo archivo):

Mockear `submitToGeekplay` y `fetchBgg` con `vi.mock`. Cubrir:

- `POST /api/bgg/partidas`:
  - BGG devuelve playid + verificación encuentra el play → 200, `BggPlay` upserted con datos de BGG (no de `req.body`)
  - BGG devuelve payload sin playid → 502, sin mirror
  - BGG devuelve playid pero verificación devuelve vacío → 502, sin mirror
  - Verificación falla la primera vez, ok la segunda → 200 (reintento funciona)
- `PUT /api/bgg/partidas/:playId`:
  - Caso ok, caso verificación vacía → 502
- `DELETE /api/bgg/partidas/:playId`:
  - Verificación devuelve null (borrado real) → 200 y `BggPlay.deleteOne` corre
  - Verificación devuelve el play (no se borró) → 502, `BggPlay` intacto

Helper: `tests/mocks/bggHttp.js` con un fake para `fetchBgg` / `submitToGeekplay` que se inyecta por test.

**Client — no nuevos tests** salvo que tenga que tocar `CreatePlayModal` (en cuyo caso extender su test existente). El cambio del cliente es opcional.

## Critical files

- [server/routes/bgg.js](server/routes/bgg.js) — endpoints 1473–1603, helpers 749–799, parsers 323–397
- [server/tests/integration/bgg-partidas-write.test.js](server/tests/integration/bgg-partidas-write.test.js) — **nuevo**
- [client/src/pages/bg-watch/CreatePlayModal.jsx](client/src/pages/bg-watch/CreatePlayModal.jsx) — revisar manejo de error 502 (probable no-op)
- [client/src/pages/bg-watch/PlayDetailModal.jsx](client/src/pages/bg-watch/PlayDetailModal.jsx) — revisar manejo de error 502 en delete (probable no-op)

## Verification

1. **Test suite**: `npm test --prefix server` — el nuevo archivo debe pasar; suite completa verde.
2. **Test manual (golden path)** con `npm run dev`:
   - Estar conectado a BGG en `/perfil`.
   - Ir a `/bg-watch/<mi-usuario>`, agregar una partida nueva. Confirmar que aparece en BG Watch **y** en `boardgamegeek.com/plays/thing/<gameId>`.
   - Editar la misma partida (cambiar la duración). Confirmar el cambio en ambas.
   - Borrarla. Confirmar que desaparece de las dos.
3. **Test manual (failure path)** — simular `geekplay.php` roto temporalmente cortando la red del server (o mockeando con `BGG_GEEKPLAY` apuntando a `http://127.0.0.1:1`):
   - Intentar agregar una partida. Esperar error 502 visible en la UI ("BGG no confirmó…"). Confirmar que `BggPlay` **no** tiene el nuevo doc (revisar en `/base-de-datos`).
4. **Regresión**: `npm test --prefix client` no debe romper nada relacionado a BG Watch.
