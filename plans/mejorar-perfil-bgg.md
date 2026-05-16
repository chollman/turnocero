# Mejorar Perfil BGG

## Context

La página [client/src/pages/bgg/BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx) es el punto de contacto entre el historial de juego del usuario en BGG y Turnocero. Hoy funciona como un visor minimalista de dos pestañas: **Colección** (primero) y **Partidas** (segundo). Tres problemas concretos:

1. **Orden de pestañas invertido**: la información más interesante (lo que el usuario *jugó*) está oculta detrás del segundo tab y no carga hasta clickear.
2. **Datos desaprovechados**: BGG devuelve por cada partida `players[]` (con username, color, position, score, win, new, rating), `comments`, `incomplete`, `nowinstats`, etc. Hoy el cliente solo muestra fecha, juego, cantidad, duración y ubicación (~30% del payload). Lo demás se descarta en [server/routes/bgg.js:202-210](server/routes/bgg.js#L202-L210).
3. **Sin flujo de carga**: el usuario tiene que irse a boardgamegeek.com para registrar una partida. La integración es solo lectura.

Además, el diseño visual usa las variables del tema correctamente pero se siente plano comparado con [TorneoDetail](client/src/pages/torneos/TorneoDetail.jsx) o [Compartidas](client/src/pages/compartidas/Compartidas.jsx) (sin hero rico, sin stats, sin filtros).

**Resultado esperado**: una experiencia de "diario de partidas" en la que el usuario gestiona su historial BGG sin salir de Turnocero — ver, filtrar, agrupar por juego, y crear/editar/eliminar partidas directamente desde la app.

## Decisión de arquitectura

La API oficial XML de BGG es **solo lectura** para partidas. Para soportar escritura usamos el endpoint interno no documentado `POST /geekplay.php` (mismo que usa el formulario web de BGG), con autenticación via cookie de sesión obtenida con `POST /login/api/v1`. Esto requiere guardar la contraseña BGG del usuario en Turnocero.

**Riesgos asumidos** (deben quedar documentados en la UI):
- El endpoint no es oficial y puede romperse si BGG cambia su web sin aviso.
- BGG podría rate-limit o bloquear cuentas si detecta uso automatizado abusivo.
- Guardar una contraseña externa es una responsabilidad de seguridad seria.

**Mitigaciones**:
- Contraseña BGG cifrada en reposo con **AES-256-GCM** y clave maestra en `BGG_CREDS_KEY` (env var).
- Nunca se devuelve al cliente; solo el flag "BGG conectado: sí/no".
- Cache de cookies de sesión BGG en memoria (15 min TTL) para evitar re-login por cada operación.
- Si BGG rechaza la sesión (401/403), se invalida el cache y se marca la credencial como caducada — el usuario debe reconectar.
- Opt-in explícito en `/perfil` con warning visible.
- Solo el dueño de la cuenta puede crear partidas en su nombre (`req.user.id` debe matchear).

## Cambios a implementar

### Backend

#### 1. Encryption helper (nuevo)
[server/utils/encryption.js](server/utils/encryption.js) — nuevo módulo con `encrypt(plaintext)` y `decrypt(ciphertext)` usando AES-256-GCM. Clave de 32 bytes desde `process.env.BGG_CREDS_KEY` (validar al boot). Formato de salida: `iv:authTag:ciphertext` en hex.

#### 2. User model
[server/models/User.js](server/models/User.js) — agregar:
```js
bggCredentials: {
  encryptedPassword: { type: String, default: '' },
  connectedAt: { type: Date, default: null },
  lastValidatedAt: { type: Date, default: null },
  invalid: { type: Boolean, default: false },
}
```
Excluir `bggCredentials` del `toJSON()` excepto un flag derivado `bggConnected: Boolean`.

#### 3. BGG auth + session manager (nuevo)
[server/utils/bggAuth.js](server/utils/bggAuth.js):
- `loginToBgg(username, password)` → POST `https://boardgamegeek.com/login/api/v1` con body JSON `{ credentials: { username, password } }`. Extraer cookies `bggusername` y `SessionID` del `Set-Cookie`. Devolver string de cookie listo para reusar.
- `getSessionCookie(userId)` — busca en cache (Map en memoria, TTL 15 min). Si no hay, descifra password y hace login. Si BGG devuelve 401, marca `bggCredentials.invalid = true` y tira error.
- `clearSession(userId)` — invalida cache (usado en logout o desconexión BGG).

#### 4. Auth routes
[server/routes/auth.js](server/routes/auth.js) — extender `PUT /api/auth/profile` para aceptar `bggPassword` (string). Si viene, validar contra BGG (intentar login una vez), si OK cifrar y guardar. Si no, devolver 400. Agregar `DELETE /api/auth/bgg-connection` para borrar las credenciales.

#### 5. BGG routes
[server/routes/bgg.js](server/routes/bgg.js) — extender significativamente:

- **Enriquecer `GET /api/bgg/partidas/:bggUsername`** para extraer:
  - `players[]` con `{ name, username, userid, color, position, score, win, new, rating }`
  - `comments`, `incomplete`, `nowinstats`
  - Soportar query param `?id=<gameId>` para filtrar por juego (pass-through al `id` de BGG).
  - Soportar `?mindate` y `?maxdate` (pass-through).
  - **Enriquecer con thumbnails de juegos**: extraer todos los `gameId` únicos de la respuesta, hacer un solo batch call a `/xmlapi2/thing?id=1,2,3,...` con cache de 30 min, mapear thumbnails al payload de cada partida.

- **`POST /api/bgg/partidas`** (auth required, requiere `bggConnected`):
  - Body: `{ objectid, playdate, length, location, quantity, comments, incomplete, nowinstats, players: [{ name, username, position, color, score, win, new, rating }] }`
  - Validar campos (Joi o validación manual).
  - Obtener cookie de sesión via `bggAuth.getSessionCookie(req.user.id)`.
  - POST a `https://boardgamegeek.com/geekplay.php` con `Content-Type: application/x-www-form-urlencoded`, body con `ajax=1`, `action=save`, `version=2`, `objecttype=thing`, los campos del body + `players[N][...]` por cada jugador.
  - Parsear respuesta JSON; devolver `{ playid, success: true }`.
  - Invalidar cache de partidas del usuario.

- **`PUT /api/bgg/partidas/:playId`** — mismo que POST pero con `playid` adicional.

- **`DELETE /api/bgg/partidas/:playId`** — POST a `/geekplay.php` con `ajax=1`, `action=delete`, `playid=<id>`.

### Frontend

#### 6. Reorganización de [client/src/pages/bgg/BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx)

Romper el monolito (294 líneas) en componentes más pequeños:

- **BggProfile.jsx** (shell, hero, tabs, routing entre paneles)
- **PartidasPanel.jsx** (nuevo) — lista de partidas con filtros y vista por juego
- **ColeccionPanel.jsx** (nuevo) — grid de colección (la lógica actual, casi sin cambios)
- **PlayCard.jsx** (nuevo) — card rica de una partida
- **PlayDetailModal.jsx** (nuevo) — modal de detalle con todos los datos
- **CreatePlayModal.jsx** (nuevo) — wizard de carga de partida (2-3 steps)
- **PerGameView.jsx** (nuevo) — vista filtrada por un juego, con stats locales

#### 7. Cambios concretos en BggProfile.jsx
- **Tab order**: Partidas (default activo) → Colección. Eager-load ambos en `useEffect` al montar.
- **Hero enriquecido** (estilo TorneoDetail):
  - Eyebrow "◆ PERFIL BGG"
  - Title con el username
  - Stats row: `<total partidas>` · `<partidas en 2026>` · `<juegos únicos>` · `<juego top>`
  - Botón "+ Nueva partida" (solo si es el propio perfil y BGG está conectado)
  - Link "Ver en BoardGameGeek ↗"
  - Si el perfil corresponde al usuario logueado pero BGG no está conectado: banner "Conectá tu cuenta de BGG para cargar partidas" con CTA a `/perfil`.

#### 8. PartidasPanel.jsx
- **Barra de filtros**: chips de período (todo / 2026 / este mes / 7 días), input de búsqueda por juego (autocomplete con `/api/bgg/search`), botón "Filtros avanzados" (sheet/modal con rango de fechas, jugador específico).
- **Toggle de vista**: `Lista cronológica` | `Por juego` (groupBy `gameId`).
- **Modo lista**: agrupado por mes con header (estilo Mensajes), cada partida es un `<PlayCard />`.
- **Modo por juego**: grid de `GameWithPlaysCard` (thumbnail + nombre + total plays + último play + win rate) que al clickearse abre `PerGameView`.

#### 9. PlayCard.jsx — diseño rico
```
┌─────────────────────────────────────────────────────────┐
│ [thumb] │ Wingspan                          [14 may 2026]│
│         │ 🏆 Claudio • 87  ·  Ana • 72  ·  Pedro • 65   │
│         │ 📍 Casa de Ana  · ⏱ 90 min  · 💬 "..."        │
└─────────────────────────────────────────────────────────┘
```
- Thumbnail 64x64 del juego (con fallback a 🎲)
- Título: nombre del juego (link a `PerGameView`)
- Fecha relativa + absoluta
- Línea de jugadores: ganador con badge 🏆 + amber, resto en gris, score destacado
- Si el jugador es amigo de Turnocero con `bggUsername` matching → linkear avatar/nombre a `/usuarios/:id`
- Tags: location, length, quantity (si >1), incomplete (con badge rojo), comments truncados con icono
- Hover: border amber + cursor pointer → abre `PlayDetailModal`
- Si es propia partida: menú "⋯" con Editar / Eliminar (sin abrir el modal)

#### 10. PlayDetailModal.jsx
- Modal estilo `TorneoDetail` modals.
- Hero con thumbnail grande del juego + nombre + fecha completa.
- Sección "Jugadores": tabla ordenada por position con columnas Posición, Jugador, Color, Score, Nuevo, Rating, 🏆.
- Sección "Detalles": location, length, quantity, incomplete flag, nowinstats flag.
- Sección "Comentarios": texto completo.
- Footer: botones Editar / Eliminar (solo si es propio) + Cerrar.

#### 11. CreatePlayModal.jsx — wizard de 3 pasos
**Step 1 — Juego**:
- Si vino desde `PerGameView`, juego preseleccionado (skippeable).
- Si no, autocomplete con `/api/bgg/search` (≥3 chars, debounce 300ms). Mostrar thumbnail + año.
- También sugerir "Recientes" (últimos 5 juegos jugados según las partidas existentes).

**Step 2 — Datos generales**:
- Fecha (date picker, default hoy)
- Duración en minutos (number input opcional)
- Ubicación (text input opcional; sugerir las últimas 5 usadas)
- Cantidad (default 1; raramente >1)
- Comentarios (textarea, máx 500 chars)
- Checkboxes: Incompleta, Sin estadísticas

**Step 3 — Jugadores**:
- Lista dinámica de jugadores (add/remove).
- Para agregar: tres opciones por jugador:
  - **Amigos de Turnocero** con `bggUsername` (autocomplete sobre `/api/users` filtrado por friends + `bggUsername` no vacío)
  - **Búsqueda BGG** por username (opcional, no implementar en esta iteración — solo texto libre)
  - **Texto libre** (solo nombre, sin BGG username)
- Por jugador: position, color (selector con paleta + custom), score, win checkbox (auto-1 al jugador de mayor score si quiere), new checkbox, rating (slider 1-10 opcional)
- Auto-incluir al propio usuario como primer jugador con su `bggUsername`.

Submit → `POST /api/bgg/partidas` → toast de éxito → cerrar modal → refrescar lista.

#### 12. PerGameView.jsx
Ruta: `/perfil-bgg/:bggUsername/juego/:gameId`.
- Hero con imagen grande del juego + nombre + año + link a BGG.
- Stats row: total plays, win rate (si hay datos), avg duration, último play, # de jugadores únicos.
- Lista de partidas usando el mismo `PlayCard`.
- Botón "+ Nueva partida de este juego" (solo si es propio + BGG conectado).
- Llama a `/api/bgg/partidas/:bggUsername?id=:gameId`.

#### 13. UserProfile.jsx — settings de credenciales BGG
[client/src/pages/users/UserProfile.jsx](client/src/pages/users/UserProfile.jsx) — agregar sección "Conexión con BoardGameGeek":
- Si no está conectado: campo password de BGG + botón "Conectar". Warning visible con los riesgos.
- Si está conectado: muestra "Conectado como `<bggUsername>` desde `<connectedAt>`". Botón "Desconectar" (DELETE).
- Si `invalid: true`: alerta naranja "Tu sesión BGG caducó, ingresá tu password de nuevo".

#### 14. CSS module
[client/src/pages/bgg/BggProfile.module.css](client/src/pages/bgg/BggProfile.module.css) — adaptar al patrón de TorneoDetail:
- Hero más alto (32-40px title), eyebrow uppercase 11px, stats row con cards pequeñas.
- Tabs con la misma firma visual ya existente (✓ ok).
- Nuevos estilos para `PlayCard`, `PlayDetailModal`, `CreatePlayModal`, `PerGameView`.
- Respetar `--page-padding-left` para el sidebar desktop. Asegurar dark/light theme — solo variables CSS, cero hardcodes.
- Mantener responsive: en mobile el `PlayCard` colapsa la lista de jugadores en máximo 2 líneas con "+3 más".

### Documentación

#### 15. CLAUDE.md
Actualizar la sección "Known limitations" — sacar la nota que dice que BGG fue revertida y agregar una sección breve sobre el endpoint no oficial de escritura y los riesgos asumidos.

#### 16. Informe / roadmap separado
Crear [plans/bgg-perfil-mejoras-roadmap.md](plans/bgg-perfil-mejoras-roadmap.md) **como output paralelo de esta iteración** (no es parte del código, es deliverable de planificación). Va a contener las ideas de feature que detectamos pero quedan fuera del scope ejecutable:

- Heatmap calendario (GitHub-style) de actividad de partidas
- Win rate y record head-to-head vs cada oponente recurrente
- Top opponents leaderboard
- Game variety score (cuántos juegos únicos en últimas N partidas)
- Longest sessions / cumulative playtime por juego
- Winning/losing streaks
- Análisis de patrones (día de la semana, hora típica)
- Cross-reference con `Mesa` de Turnocero — sugerir "¿Cargar como partida BGG?" cuando una mesa se completa
- Cross-reference con `Compartida` — botón "Crear compartida" desde un play card
- Comparación con amigos: "Quién jugó más a X" entre amigos con BGG vinculado
- Importación automática de plays BGG hacia las "memorias" de Turnocero (timeline unificado)
- Widget de hot games BGG en la home
- Recomendaciones de juegos basadas en historial (mechanics + categories del endpoint `/thing`)
- Detección de partidas duplicadas (mismo juego + mismo día + mismos jugadores)
- Métricas de "rating consistency" (cuán parecidos son los ratings del usuario vs el avg de BGG)

## Archivos críticos

**Backend**:
- [server/models/User.js](server/models/User.js) — agregar `bggCredentials`
- [server/routes/bgg.js](server/routes/bgg.js) — enriquecer GET, agregar POST/PUT/DELETE
- [server/routes/auth.js](server/routes/auth.js) — endpoint para guardar credencial BGG
- [server/utils/bggAuth.js](server/utils/bggAuth.js) — **nuevo**, login + session cache
- [server/utils/encryption.js](server/utils/encryption.js) — **nuevo**, AES-256-GCM
- `server/.env.example` — agregar `BGG_CREDS_KEY=`

**Frontend**:
- [client/src/pages/bgg/BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx) — refactor a shell
- [client/src/pages/bgg/BggProfile.module.css](client/src/pages/bgg/BggProfile.module.css) — estilos nuevos
- [client/src/pages/bgg/PartidasPanel.jsx](client/src/pages/bgg/PartidasPanel.jsx) — **nuevo**
- [client/src/pages/bgg/ColeccionPanel.jsx](client/src/pages/bgg/ColeccionPanel.jsx) — **nuevo** (mover lógica actual)
- [client/src/pages/bgg/PlayCard.jsx](client/src/pages/bgg/PlayCard.jsx) — **nuevo**
- [client/src/pages/bgg/PlayDetailModal.jsx](client/src/pages/bgg/PlayDetailModal.jsx) — **nuevo**
- [client/src/pages/bgg/CreatePlayModal.jsx](client/src/pages/bgg/CreatePlayModal.jsx) — **nuevo**
- [client/src/pages/bgg/PerGameView.jsx](client/src/pages/bgg/PerGameView.jsx) — **nuevo**
- [client/src/pages/users/UserProfile.jsx](client/src/pages/users/UserProfile.jsx) — sección de credenciales BGG
- [client/src/App.jsx](client/src/App.jsx) — agregar ruta `/perfil-bgg/:bggUsername/juego/:gameId`

**Reutilizables existentes a usar (no recrear)**:
- Estilos de tabs ya correctos en [BggProfile.module.css:67-107](client/src/pages/bgg/BggProfile.module.css#L67-L107)
- Patrón de paginación interno (`Pagination` component) — moverlo a `client/src/components/shared/Pagination.jsx` para reuso en `PerGameView`
- Componente `UserRef` / helper `getUserDisplay` (per memoria `feedback_deleted_user`) para mostrar nombres de jugadores que sean usuarios de Turnocero
- Sistema de toasts de [NotificationContext](client/src/context/NotificationContext.jsx) para confirmaciones de carga
- Variables CSS de [client/src/index.css](client/src/index.css) — nunca hardcodear colores
- Patrón `--page-padding-left` (memoria `padding_system`) para el shell

## Slices (commits incrementales)

Cada slice debe poder buildearse, testearse y commitearse de forma independiente sin romper la app. Orden recomendado:

### Slice 1 — Reordenar tabs y eager-load
**Scope**: Partidas como tab default, ambos paneles cargan al montar (no esperar al click).
**Files**: [BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx)
**Test**: visitar `/perfil-bgg/<user>` → "Partidas" activo, ambas listas cargan en paralelo.
**Commit**: `feat: reorder BGG profile tabs and eager-load both panels`

### Slice 2 — Hero con stats derivadas
**Scope**: hero estilo TorneoDetail con eyebrow, título, stats row (total partidas, YTD, juegos únicos, juego top), link BGG. Stats calculadas client-side desde lo cargado.
**Files**: [BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx), [BggProfile.module.css](client/src/pages/bgg/BggProfile.module.css)
**Test**: visual + verificar conteos.
**Commit**: `feat: add stats hero to BGG profile`

### Slice 3 — Enriquecer GET /partidas (backend)
**Scope**: extraer `players[]`, `comments`, `incomplete`, `nowinstats` del XML de BGG. Frontend sin cambios visibles aún.
**Files**: [server/routes/bgg.js](server/routes/bgg.js)
**Test**: `curl /api/bgg/partidas/<user>` → ver JSON enriquecido.
**Commit**: `feat: enrich BGG plays response with players, scores, comments`

### Slice 4 — Thumbnails de juegos en partidas
**Scope**: batch fetch a `/thing?id=1,2,3` con los `gameId` únicos, mapear thumbnails al payload, cache 30 min.
**Files**: [server/routes/bgg.js](server/routes/bgg.js)
**Test**: `curl` → cada partida tiene `gameThumbnail`.
**Commit**: `feat: include game thumbnails in BGG plays response`

### Slice 5 — PlayCard rico
**Scope**: reemplazar `PlayRow` por `PlayCard.jsx` (thumb + nombre + jugadores con scores + ganador 🏆 + tags). Lista de jugadores colapsa en mobile.
**Files**: `client/src/pages/bgg/PlayCard.jsx` (new), [BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx), [BggProfile.module.css](client/src/pages/bgg/BggProfile.module.css)
**Test**: visual; jugadores que sean amigos de Turnocero linkean a `/usuarios/:id`.
**Commit**: `feat: redesign BGG play row as rich PlayCard`

### Slice 6 — PlayDetailModal
**Scope**: click en `PlayCard` abre modal con tabla completa de jugadores (posición, color, score, new, rating, win), comentarios full, todos los flags.
**Files**: `client/src/pages/bgg/PlayDetailModal.jsx` (new), [PlayCard.jsx](client/src/pages/bgg/PlayCard.jsx)
**Test**: click → modal con todos los datos.
**Commit**: `feat: add BGG play detail modal`

### Slice 7 — Refactor a PartidasPanel/ColeccionPanel + filtros
**Scope**: extraer lógica de cada tab a su panel. Agregar filtros: chips de período (todo/2026/30d/7d), búsqueda por juego con `/api/bgg/search`.
**Files**: `client/src/pages/bgg/PartidasPanel.jsx` (new), `client/src/pages/bgg/ColeccionPanel.jsx` (new), [BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx)
**Test**: filtros aplican client-side (sobre los datos cargados); paginación se resetea al filtrar.
**Commit**: `refactor: split BGG profile tabs into panels with filters`

### Slice 8 — Vista "Por juego" en PartidasPanel
**Scope**: toggle Lista | Por juego. En modo "Por juego", agrupa partidas por `gameId` y muestra cards con thumb + total plays + último play + win rate (si hay data).
**Files**: [PartidasPanel.jsx](client/src/pages/bgg/PartidasPanel.jsx)
**Test**: alternar modos, conteos coherentes.
**Commit**: `feat: add 'by game' view to BGG Partidas panel`

### Slice 9 — PerGameView + filtro backend
**Scope**: `GET /api/bgg/partidas/:user` acepta `?id=<gameId>`. Nueva ruta `/perfil-bgg/:user/juego/:gameId` con hero del juego (imagen grande, año, link BGG), stats locales y lista de partidas.
**Files**: [server/routes/bgg.js](server/routes/bgg.js), [App.jsx](client/src/App.jsx), `client/src/pages/bgg/PerGameView.jsx` (new)
**Test**: click en un juego desde Slice 8 → vista filtrada con stats.
**Commit**: `feat: add per-game BGG plays view with stats`

### Slice 10 — Encryption helper + bggCredentials field
**Scope**: `BGG_CREDS_KEY` en env, `utils/encryption.js` con AES-256-GCM (encrypt/decrypt), agregar `bggCredentials` al `User` model, excluir del `toJSON`, exponer `bggConnected: boolean` derivado.
**Files**: `server/utils/encryption.js` (new), [server/models/User.js](server/models/User.js), `server/.env.example`
**Test**: script ad-hoc o REPL — round-trip encrypt/decrypt funciona; nuevo User sin bggCredentials no rompe.
**Commit**: `feat: add encrypted BGG credentials storage on User model`

### Slice 11 — BGG auth + session manager
**Scope**: `utils/bggAuth.js` con `loginToBgg`, `getSessionCookie` (cache 15 min), `clearSession`. Endpoints: `POST /api/auth/bgg-connect` (valida + cifra + guarda), `DELETE /api/auth/bgg-connection` (borra).
**Files**: `server/utils/bggAuth.js` (new), [server/routes/auth.js](server/routes/auth.js)
**Test**: `curl POST /api/auth/bgg-connect` con creds válidas → 200 + `bggConnected: true`; creds inválidas → 401.
**Commit**: `feat: add BGG authentication and session cache`

### Slice 12 — UI de conexión BGG en /perfil
**Scope**: sección "Conexión con BoardGameGeek" en `UserProfile.jsx`: input password, warning visible (riesgos), botón Conectar/Desconectar, banner naranja si `invalid: true`.
**Files**: [client/src/pages/users/UserProfile.jsx](client/src/pages/users/UserProfile.jsx)
**Test**: conectar/desconectar end-to-end desde la UI, password no se devuelve al cliente.
**Commit**: `feat: add BGG account connection UI in profile settings`

### Slice 13 — POST /api/bgg/partidas + CreatePlayModal
**Scope**: endpoint backend que mappea el body al form `/geekplay.php` (incluyendo `players[N][...]`). Wizard de 3 steps en frontend (juego → datos → jugadores). Botón "+ Nueva partida" en el hero (solo si es el propio perfil + `bggConnected`).
**Files**: [server/routes/bgg.js](server/routes/bgg.js), `client/src/pages/bgg/CreatePlayModal.jsx` (new), [BggProfile.jsx](client/src/pages/bgg/BggProfile.jsx)
**Test**: cargar una partida real → verificar en `boardgamegeek.com/plays/thismonth/user/<username>` que aparece con todos los datos.
**Commit**: `feat: log BGG plays directly from Turnocero`

### Slice 14 — Editar partida (PUT)
**Scope**: `PUT /api/bgg/partidas/:playId`. Reusar `CreatePlayModal` con `initialValues`. Opción "Editar" en el menú "⋯" de `PlayCard` (solo si es propia).
**Files**: [server/routes/bgg.js](server/routes/bgg.js), [CreatePlayModal.jsx](client/src/pages/bgg/CreatePlayModal.jsx), [PlayCard.jsx](client/src/pages/bgg/PlayCard.jsx)
**Test**: editar la partida del Slice 13 → verificar en BGG.com.
**Commit**: `feat: edit BGG plays from Turnocero`

### Slice 15 — Eliminar partida (DELETE)
**Scope**: `DELETE /api/bgg/partidas/:playId` (POST a `/geekplay.php` con `action=delete`). Confirm modal + opción "Eliminar" en `PlayCard`.
**Files**: [server/routes/bgg.js](server/routes/bgg.js), [PlayCard.jsx](client/src/pages/bgg/PlayCard.jsx)
**Test**: borrar → verificar que desaparece de BGG.com.
**Commit**: `feat: delete BGG plays from Turnocero`

### Slice 16 — Docs + roadmap separado
**Scope**: actualizar [CLAUDE.md](CLAUDE.md) sacando la nota de "BGG revertida" y describiendo el endpoint no oficial y los riesgos. Crear `plans/bgg-perfil-mejoras-roadmap.md` con todas las ideas del punto 4 del pedido original.
**Files**: [CLAUDE.md](CLAUDE.md), `plans/bgg-perfil-mejoras-roadmap.md` (new)
**Commit**: `docs: update CLAUDE.md and add BGG profile improvements roadmap`

---

**Dependencias críticas**:
- Slice 5 depende de Slice 3 (datos) y Slice 4 (thumbnails).
- Slice 8 depende de Slice 7.
- Slice 9 depende de Slice 8 (para el click-through) pero podría hacerse antes con un entry point alternativo.
- Slice 11 depende de Slice 10.
- Slice 12 depende de Slice 11.
- Slices 13-15 dependen de Slice 11 (auth funcionando) y son ideales después de Slice 12 (para tener cómo conectarse).
- Slice 16 es independiente; puede hacerse al final o intercalarse.

**Slices 1-9** entregan un perfil BGG mucho más rico **sin tocar credenciales** (solo lectura mejorada).
**Slices 10-15** habilitan escritura — feature opt-in por usuario.
**Slice 16** cierra la documentación.

## Verificación end-to-end

1. **Setup**: agregar `BGG_CREDS_KEY` (32 bytes random hex) al `server/.env`. Reiniciar server.
2. **Conexión**: ir a `/perfil`, ingresar `bggUsername` y password BGG → "Conectar" → debe validar contra BGG y marcar como conectado. Probar con password inválida → debe rechazar.
3. **Orden de tabs**: ir a `/perfil-bgg/<username>` → "Partidas" debe estar activo por default y cargar inmediatamente.
4. **Datos enriquecidos**: cada `PlayCard` debe mostrar jugadores con scores, ganador con 🏆, location, length, comentarios truncados.
5. **Detalle**: click en un `PlayCard` → modal con toda la info.
6. **Filtros**: probar filtro por fecha y por juego en `PartidasPanel`.
7. **Vista por juego**: toggle "Por juego" → grid → click en un juego → `PerGameView` con stats correctas.
8. **Crear partida**: "+ Nueva partida" → wizard → completar → submit → verificar en `boardgamegeek.com/plays/thismonth/user/<username>` que la partida aparece.
9. **Editar y eliminar**: probar ambos sobre la partida recién creada → confirmar en BGG.com.
10. **Caducidad de sesión**: borrar manualmente el cache de cookies (reiniciar server) → cargar nueva partida → debe re-loguear transparentemente.
11. **Credencial inválida**: cambiar la password en BGG.com → intentar cargar partida → debe marcar `invalid: true` y mostrar alerta en `/perfil`.
12. **Permisos**: con usuario A, intentar cargar partida en perfil de usuario B → 403.
13. **Mobile**: probar wizard, `PlayCard`, filtros en viewport <600px.
14. **Tema claro/oscuro**: toggle de tema → todo coherente, sin colores hardcodeados (per memoria `feedback_theme_support`).
15. **Linter limpio**: `cd client && npx eslint src --ext .js,.jsx`.
16. **Roadmap escrito**: confirmar que `plans/bgg-perfil-mejoras-roadmap.md` existe con las ideas listadas.
