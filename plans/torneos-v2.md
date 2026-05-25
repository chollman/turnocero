# Plan — Ajustes a Torneos (v2)

> Este archivo se mueve a `plans/torneos-v2.md` apenas se apruebe.

## Contexto

La primera versión de Torneos (mergeada hace unas horas) cubrió Liga (1vs1 round-robin) y Eliminación simple (bracket). Probándola, surgieron tres ajustes:

1. **Falta feedback visual al inscribirse**: el botón cambia de estado, pero no hay confirmación clara para el usuario de que la acción se completó.
2. **El admin necesita poder agregar usuarios directamente**, sin esperar a que se inscriban. Pensado para torneos presenciales donde el admin arma la lista.
3. **Hace falta un formato más realista para juegos de mesa**: grupos multi-fase con mesas de N jugadores y P partidas por grupo, donde se acumula puntaje, los mejores C pasan a la siguiente fase, hasta llegar a la mesa final.

**Decisiones de producto confirmadas:**

- Mantener los 3 formatos: Liga, Eliminación simple, **Grupos** (nuevo).
- Puntaje en formato Grupos: el admin carga la **puntuación real del juego (PV)** por jugador al cierre de cada partida. La ranking del grupo es por suma de PV descendente, sin sistema separado de "puntos por posición". (Posición de cada jugador dentro de una partida se deriva del PV.)
- Cut desparejo: validación + admin decide manualmente por fase (puede cambiar el `tableSize` o aceptar mesa con menos jugadores).
- Modo inscripción: toggle al crear (`open` | `admin_only`). En `admin_only` el botón de inscripción no se ve y el admin usa un picker de usuarios. El estado `registration` se puede saltar.

---

## Ajuste 1 — Feedback visual al inscribirse

**Archivo**: [client/src/pages/torneos/components/RegisterButton.jsx](client/src/pages/torneos/components/RegisterButton.jsx)

Sumar toast de éxito con `useNotifications().addToast()` (ya existe el helper, lo usa NotificationContext para los tipos de torneo). Después de `axios.post('/api/torneos/:id/register')`:

```js
addToast({
  type: "tournament_pending",
  torneoId: torneo._id,
  torneoTitle: torneo.title,
});
```

Agregar el tipo `tournament_pending` en [client/src/components/layout/ToastContainer.jsx](client/src/components/layout/ToastContainer.jsx) con icono ⏳ y body "Tu inscripción está pendiente de aprobación".

Además, mejorar el feedback inline: cuando `isPending`, en lugar del pill estático, mostrar un mensaje animado tipo "✅ Inscripción enviada · Esperando aprobación del admin" durante 3 segundos antes de colapsar al pill normal. Un `useState` con un timer es suficiente.

---

## Ajuste 2 — Modo `admin_only`: el admin agrega usuarios

### Modelo

[server/models/Torneo.js](server/models/Torneo.js) — agregar:

```js
inscriptionMode: { type: String, enum: ['open', 'admin_only'], default: 'open' }
```

### Transiciones de estado

Actualizar `VALID_TRANSITIONS` en [server/routes/torneos.js](server/routes/torneos.js):

```js
draft → (registration | in_progress)   // in_progress solo si admin_only
registration → (in_progress | draft)
in_progress → finished
```

### Nuevo endpoint (admin)

```
POST /api/torneos/:id/participants/:userId      — admin only
                                                  — agrega un user directo a participants
                                                  — válido en cualquier estado != finished
```

Validar: que el usuario no esté ya en `participants` ni en `pendingRegistrations`, y respetar `maxParticipants`.

### Form de creación

[client/src/pages/torneos/CreateTorneo.jsx](client/src/pages/torneos/CreateTorneo.jsx) — agregar selector "Modo de inscripción":

- "Inscripción abierta" — usuarios se anotan, admin acepta
- "Yo agrego participantes" — admin maneja la lista directo

### UI nueva: `AddParticipantModal.jsx`

`client/src/pages/torneos/components/AddParticipantModal.jsx` — modal con:

- Input de búsqueda (debounce 250ms) que pega contra `GET /api/users?search=...` (verificar el endpoint actual)
- Lista de resultados con botón "Agregar" en cada uno
- Marcar visualmente a los que ya son participantes
- Llamar a `POST /api/torneos/:id/participants/:userId` al click

### Cambios en componentes existentes

- [RegisterButton.jsx](client/src/pages/torneos/components/RegisterButton.jsx): si `torneo.inscriptionMode === 'admin_only'`, retornar `null` (excepto para los participantes ya cargados, donde se sigue mostrando "Estás inscripto ✓").
- [AdminPanel.jsx](client/src/pages/torneos/components/AdminPanel.jsx): cuando `inscriptionMode === 'admin_only'`, mostrar botón "+ Agregar participantes" que abre el modal. Disponible en `draft` y `registration`.
- [TorneoCard.jsx](client/src/pages/torneos/components/TorneoCard.jsx): si `inscriptionMode === 'admin_only'` y status es `registration`, mostrar "Inscripción cerrada" en lugar de "Inscripción abierta".

---

## Ajuste 3 — Formato Grupos (multi-fase)

### Lógica del formato

**Configuración por torneo:**

- `tableSize` (X): jugadores por mesa, default 4
- `gamesPerGroup` (P): partidas por grupo en cada fase, default 3
- `qualifiersPerGroup` (C): cuántos pasan a la siguiente fase, default 2

**Ciclo:**

1. Al pasar a `in_progress`: se generan los grupos de la **fase 1** (ceil(N/X) grupos, distribución con seeding tipo serpentina para balancear).
2. En cada grupo se juegan P partidas. Para cada partida, el admin carga el PV (puntaje real del juego) de cada jugador.
3. Standings del grupo: suma de PV descendente. La posición del jugador dentro de cada partida se deriva del PV.
4. Cuando todas las P partidas de un grupo están cargadas → el grupo queda `completed` y el sistema sugiere los top C como "promovidos" (editable por el admin antes de avanzar).
5. Cuando todos los grupos de la fase están completed → admin clickea "Siguiente fase" y elige cómo armar las mesas (validación si no divide).
6. Cuando la siguiente fase queda en **una sola mesa** → es la final. Top 1 = campeón.

### Modelos nuevos

`server/models/TorneoGroup.js`:

```js
{
  torneo:        ObjectId ref Torneo, indexed,
  phase:         Number (1-indexed),
  tableNumber:   Number (1-indexed dentro de la fase),
  players:       [ObjectId ref User],
  advancedPlayers: [ObjectId ref User],   // editable por el admin antes del cut
  status:        enum ['pending', 'in_progress', 'completed'], default 'pending',
  completedAt:   Date,
  timestamps
}
```

Índice: `{ torneo: 1, phase: 1, tableNumber: 1 }`.

`server/models/TorneoGame.js`:

```js
{
  torneo:     ObjectId ref Torneo, indexed,
  group:      ObjectId ref TorneoGroup, indexed,
  gameNumber: Number (1..P),
  results:    [{ player: ObjectId ref User, score: Number, position: Number }],
  status:     enum ['pending', 'completed'], default 'pending',
  playedAt:   Date,
  timestamps
}
```

Índice: `{ group: 1, gameNumber: 1 }`.

### Extensiones al modelo Torneo

```js
format: { ..., enum: ['league', 'single_elim', 'groups'] }
tableSize:          { type: Number, min: 2, max: 12, default: 4 }
gamesPerGroup:      { type: Number, min: 1, max: 12, default: 3 }
qualifiersPerGroup: { type: Number, min: 1, default: 2 }
currentPhase:       { type: Number, default: 0 }   // 0 = no arrancó; 1, 2, 3... cuando hay grupos
```

### Helpers nuevos en [tournamentGeneration.js](server/utils/tournamentGeneration.js)

```js
generateGroupsPhase(playerIds, tableSize) → [{ tableNumber, players[] }]
  // distribución serpentina por seed: con 12 jugadores y X=4 →
  // grupo 1: [seed 1, 8, 9, 12], grupo 2: [2, 7, 10, 11], grupo 3: [3, 6, 4, 5] etc.

computeGroupStandings(games, playerIds) → [{ user, played, totalPV, byGame: [score, score, ...] }]
  // ordenado por totalPV desc, luego por nombre (estable)

validateNextPhase(advancedCount, tableSize) → { valid, suggestions, warnings }
  // si advancedCount % tableSize !== 0 →
  // sugerencias: { newTableSize, byes, singleFinalTable }
```

### Endpoints nuevos en [routes/torneos.js](server/routes/torneos.js)

```
GET    /api/torneos/:id/groups                                     — optionalAuth
                                                                    — ?phase (opcional, default = currentPhase)
                                                                    — devuelve grupos + games + standings computadas
GET    /api/torneos/:id/groups/:groupId                            — optionalAuth (detalle de grupo)
POST   /api/torneos/:id/games/:gameId/result                       — admin only
                                                                    — body: { results: [{ playerId, score }] }
                                                                    — calcula position desde score, marca game completed
                                                                    — si último game del grupo → grupo completed + sugerencia advancedPlayers
DELETE /api/torneos/:id/games/:gameId/result                       — admin only (deshace resultado)
PATCH  /api/torneos/:id/groups/:groupId/advanced                   — admin only
                                                                    — body: { advancedPlayers: [userId, ...] }
                                                                    — solo si group está completed y phase no se avanzó todavía
POST   /api/torneos/:id/next-phase                                  — admin only
                                                                    — body: { tableSize? }   // override opcional para esta fase
                                                                    — valida que todos los grupos de la fase actual estén completed y con advancedPlayers seteados
                                                                    — genera grupos de la siguiente fase
                                                                    — si queda <= tableSize jugadores → genera 1 mesa final
```

Actualizar `PATCH /api/torneos/:id/status` para que `registration → in_progress` (o `draft → in_progress` si admin_only) en formato grupos llame a `generateGroupsPhase()` y cree la fase 1.

Actualizar el endpoint `POST /api/torneos/:id/matches/:matchId/result` para no usarlo en formato grupos (las partidas grupales tienen su propia ruta `/games/:gameId/result`).

Para "finalizar" un torneo de grupos: el endpoint `PATCH /status` en `in_progress → finished` revisa la fase actual; si tiene una sola mesa con resultados completos, el campeón es el top 1 del standings de ese grupo y runner-up es el top 2.

### UI nueva

`client/src/pages/torneos/components/GroupsView.jsx` (tab principal cuando `format=groups`):

- Selector de fase (1, 2, 3…) en la parte superior si hay más de una fase.
- Por cada grupo de la fase activa:
  - Card con título "Mesa #N — Fase X"
  - Lista de jugadores
  - Tabla de standings (Jugador | PJ | Total PV | Detalle por partida)
  - Partidas (P en total): cada una muestra estado (pendiente/completada) y resultados; si pending, botón "Cargar resultado" (admin)
  - Si group.status === 'completed', sección "Promovidos a la siguiente fase" con la lista (editable por admin antes de avanzar)
- Si todos los grupos de la fase actual están completed y promovidos → mostrar botón "Generar siguiente fase" (admin) que abre `PhaseTransitionModal`.

`client/src/pages/torneos/components/GameScoreModal.jsx` (modal para cargar resultado de una partida):

- Lista de jugadores del grupo
- Input numérico de score (PV) por jugador
- Muestra posición autocalculada en vivo (1°, 2°, etc. según el score)
- Botón "Guardar resultado"
- Validación: todos los scores cargados, números válidos.

`client/src/pages/torneos/components/PhaseTransitionModal.jsx`:

- Muestra cantidad de promovidos, `tableSize` actual, y la división
- Si no divide exactamente: mostrar las opciones (cambiar tableSize, dejar 1 mesa con menos, etc.) — se selecciona y se manda al endpoint
- Si quedan ≤ tableSize → indicar "Esta será la mesa final"

`client/src/pages/torneos/components/GroupStandings.jsx`:

- Tabla similar a `LeagueStandings` pero con columna "Total PV" y subcolumnas por cada partida del grupo.

### Cambios en componentes existentes

- [CreateTorneo.jsx](client/src/pages/torneos/CreateTorneo.jsx): si el admin elige formato "Grupos", mostrar los tres inputs (`tableSize`, `gamesPerGroup`, `qualifiersPerGroup`) con defaults razonables.
- [EditTorneo.jsx](client/src/pages/torneos/EditTorneo.jsx): permite editar `tableSize`/`gamesPerGroup`/`qualifiersPerGroup` solo si el torneo está en draft (después no, porque ya hay grupos generados).
- [TorneoDetail.jsx](client/src/pages/torneos/TorneoDetail.jsx): en `TABS_BY_FORMAT` agregar `groups: ['groups', 'participants']`. Renderizar `<GroupsView />` cuando el tab activo es 'groups'.
- [TorneoCard.jsx](client/src/pages/torneos/components/TorneoCard.jsx): agregar a `FORMAT_META` el icono 🧩 + label "Grupos".

### Notificaciones (opcionales para v2.1, NO en este alcance)

No se agregan notifs nuevas para resultados de grupo. Se mantienen las 4 actuales (`tournament_accepted/rejected/advanced/eliminated`). El `tournament_advanced` se reutiliza cuando un jugador pasa a la siguiente fase del formato grupos.

---

## Archivos críticos

**Crear:**

- `server/models/TorneoGroup.js`
- `server/models/TorneoGame.js`
- `client/src/pages/torneos/components/GroupsView.jsx`
- `client/src/pages/torneos/components/GroupStandings.jsx`
- `client/src/pages/torneos/components/GameScoreModal.jsx`
- `client/src/pages/torneos/components/PhaseTransitionModal.jsx`
- `client/src/pages/torneos/components/AddParticipantModal.jsx`

**Modificar:**

- `server/models/Torneo.js` — campos `inscriptionMode`, `tableSize`, `gamesPerGroup`, `qualifiersPerGroup`, `currentPhase`; extender enum `format`
- `server/routes/torneos.js` — endpoints nuevos + transiciones de estado actualizadas + integración con generación de grupos
- `server/utils/tournamentGeneration.js` — `generateGroupsPhase`, `computeGroupStandings`, `validateNextPhase`
- `client/src/pages/torneos/CreateTorneo.jsx` — toggle modo inscripción + sección de config Grupos
- `client/src/pages/torneos/EditTorneo.jsx` — campos editables (solo en draft)
- `client/src/pages/torneos/TorneoDetail.jsx` — tab Grupos + render condicional
- `client/src/pages/torneos/components/RegisterButton.jsx` — hide en modo admin_only + toast al inscribirse
- `client/src/pages/torneos/components/AdminPanel.jsx` — botón "Agregar participantes" en modo admin_only
- `client/src/pages/torneos/components/TorneoCard.jsx` — chip de "Inscripción cerrada" si admin_only + icono de Grupos
- `client/src/pages/torneos/Torneos.module.css` y `TorneoDetail.module.css` — estilos para los componentes nuevos
- `client/src/components/layout/ToastContainer.jsx` — agregar tipo `tournament_pending`
- `CLAUDE.md` — sección Torneos: agregar formato Grupos, modo de inscripción, modelos nuevos

**Sin cambios:**

- `server/models/TorneoMatch.js` (sigue siendo solo para liga y single_elim)
- `Bracket.jsx`, `LeagueStandings.jsx`, `LeagueRoundsList.jsx`, `RecordResultModal.jsx`, `SeedReorderModal.jsx` (los formatos viejos siguen tal cual)

---

## Cumplimiento de reglas del proyecto

- **CSS variables**: cero colores hardcoded. Reusar `--amber`, `--green`, `--red`, `--orange`, `--bg-card`, `--border`, etc. de [client/src/index.css](client/src/index.css). Tema dark + light cubierto. Ver [[feedback-theme-support]].
- **`isActuallyAdmin && !viewAsUser`**: gatear TODA la UI de admin nueva (AddParticipantModal, GameScoreModal, PhaseTransitionModal, botón de "Promover", "Siguiente fase"). Ver [[feedback_admin_view_as_user]].
- **Sidebar/BottomNav**: este cambio NO toca navegación; el item "Torneos" ya está. Ver [[feedback_sidebar_bottomnav_sync]].
- **Deleted users**: usar `UserRef` / `getUserDisplay` para participantes (ya está en el patrón). Ver [[feedback_deleted_user]].
- **Slugs en español**: las rutas del API mantienen el patrón existente. No se agregan slugs nuevos en el frontend (todo entra dentro de `/torneos/:id`).
- **Commits**: en inglés.

---

## Verificación end-to-end

Levantar ambos servers (`npm run dev:server` + `npm run dev:client`) y probar este flujo completo:

### Ajuste 1

1. Crear torneo con `inscriptionMode: 'open'` y abrir inscripciones.
2. Desde otra cuenta, click "Inscribirme" → debe aparecer toast ⏳ "Inscripción enviada — esperando aprobación".
3. La fila inline debe mostrar mensaje de éxito ~3s antes de pasar al pill estático.

### Ajuste 2

1. Crear torneo con `inscriptionMode: 'admin_only'`.
2. Desde cuenta de usuario, abrir el torneo → NO debe verse el botón "Inscribirme".
3. Como admin, abrir el modal "Agregar participantes", buscar y agregar 4 usuarios.
4. Pasar el torneo de `draft` directo a `in_progress` (sin pasar por registration).
5. Confirmar que se generaron los grupos (si formato Grupos) o los matches (si liga/single_elim).

### Ajuste 3

1. Crear torneo formato **Grupos** con tableSize=4, gamesPerGroup=3, qualifiersPerGroup=2.
2. Agregar 12 participantes (`admin_only`) y pasar a in_progress.
3. Verificar que se generen **3 grupos de 4** en la fase 1.
4. Como admin, abrir un grupo, cargar resultados de las 3 partidas con scores variados.
5. Verificar standings: ordenado por suma de PV. Confirmar que las posiciones por partida (1°, 2°, 3°, 4°) se calculan bien.
6. Cuando todos los grupos estén completed → editar la lista de "promovidos" en un grupo (cambiar manualmente uno).
7. Click "Generar siguiente fase". Como hay 6 promovidos y tableSize=4, el sistema avisa el desbalance. Elegir "1 mesa final de 6" (override de tableSize).
8. Verificar que se genera fase 2 con una sola mesa de 6.
9. Cargar las 3 partidas de la mesa final.
10. Finalizar el torneo → campeón = top 1 del standings de esa mesa, runner-up = top 2.

### Cobertura cross-feature

- **Tema light**: toggle desde `/perfil` → verificar contraste en GroupsView, GroupStandings, GameScoreModal, PhaseTransitionModal, AddParticipantModal.
- **Mobile**: bracket en mobile sigue funcionando; los modales y la lista de grupos se ven en pantalla chica.
- **View-as-user (admin)**: con toggle activo, todos los botones de admin (cargar resultado, promover, agregar participantes, siguiente fase) deben ocultarse.
- **Visitante sin login**: puede ver `/torneos/:id` en formato Grupos (standings + partidas con scores) en estado `in_progress` o `finished`.

Antes del commit: correr `/react-review`, `/mobile-review`, `/css-hardcode-audit` sobre los archivos nuevos.

---

## Out of scope (v2.1+)

- Notifs específicas para "tu partida fue cargada" o "tu grupo terminó".
- Doble eliminación / Suizo (no pedidos).
- Estadísticas globales del jugador a través de torneos.
- Promoción automática sin confirmación del admin.
- Export PDF/imagen del bracket o las posiciones.
