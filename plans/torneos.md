# Plan — Sección de Torneos

> **Nota**: este archivo debe moverse a `plans/torneos.md` del repo apenas se apruebe (preferencia registrada en memoria).

## Contexto

Turnocero hoy tiene Mesas, Compartidas, Noticias y un sistema de amigos/DM, pero no hay forma de organizar competencias formales. La comunidad arma torneos por afuera (planillas, grupos de WhatsApp). El objetivo de esta feature es:

- Que los admins puedan crear y gestionar torneos completos (alta, inscripciones, generación de fixture, carga de resultados, cierre).
- Que cualquier usuario pueda ver el progreso de un torneo en vivo (tabla de posiciones o bracket actualizado a medida que el admin carga resultados).
- Que usuarios logueados puedan **inscribirse** y el admin acepte/rechace.

**Decisiones de producto confirmadas:**
- Formatos: **Liga (round-robin)** y **Eliminación simple**. (Sin doble eliminación ni Suizo en v1.)
- Participantes: solo usuarios registrados de Turnocero.
- Juego: campo de texto libre por torneo (consistente con cómo Turnocero maneja juegos hoy).
- Inscripción: usuarios se anotan, admin aprueba/rechaza.
- Generación de fixture: automática al pasar a "En curso", con posibilidad de reordenar seeds manualmente antes.
- Carga de resultado: solo ganador (o empate en liga). Sin puntajes numéricos ni notas en v1.
- Estados del torneo: `draft` → `registration` → `in_progress` → `finished`.
- Notificaciones: inscripción aceptada/rechazada + avance/eliminación en bracket (solo eliminación simple).

---

## Arquitectura

### Modelos nuevos (`server/models/`)

#### `Torneo.js`
```
title           String, required, max 200
description     String, max 2000
game            String, required, max 200            // texto libre
format          enum ['league', 'single_elim'], required
status          enum ['draft', 'registration', 'in_progress', 'finished'], default 'draft', indexed
image           { url, publicId } (Cloudinary, opcional)
maxParticipants Number (opcional; null = sin tope)
createdBy       ObjectId ref User, required
participants    [ObjectId ref User]                  // aprobados, en orden de seed
pendingRegistrations [{ user: ObjectId, requestedAt: Date }]
rejectedRegistrations [ObjectId ref User]            // para evitar re-inscripción inmediata
winner          ObjectId ref User (solo cuando finished)
runnerUp        ObjectId ref User (opcional)
timestamps
```

Índices: `{ status: 1, createdAt: -1 }`, `{ createdBy: 1 }`.

#### `TorneoMatch.js`
```
torneo          ObjectId ref Torneo, required, indexed
round           Number, required        // 1-indexed
matchIndex      Number, required        // posición dentro de la ronda (para ordenar y dibujar bracket)
playerA         ObjectId ref User (nullable; null en caso de bye o TBD)
playerB         ObjectId ref User (nullable)
nextMatch       ObjectId ref TorneoMatch (solo single_elim; null en la final)
isUpperSlot     Boolean (solo single_elim; true si el ganador ocupa el slot A del nextMatch, false si B)
winner          ObjectId ref User (nullable)
isDraw          Boolean, default false  // solo válido en league
status          enum ['pending', 'completed', 'bye'], default 'pending'
playedAt        Date (nullable)
timestamps
```

Índice compuesto: `{ torneo: 1, round: 1, matchIndex: 1 }`.

### Helpers de generación (`server/utils/tournamentGeneration.js`)
- `generateLeagueFixture(participantIds)` — método del círculo. `n` participantes (con bye si `n` impar) → `n-1` rondas, `floor(n/2)` matches por ronda. Devuelve `[{ round, matchIndex, playerA, playerB }]`.
- `generateSingleElimBracket(participantIds)` — siembra estándar (1 vs n, 2 vs n-1, etc.). Rellena con byes hasta la próxima potencia de 2; los seeds altos reciben bye en R1. Devuelve matches con `nextMatch` linkeado (crea primero los de la ronda final y va hacia atrás para resolver refs).
- `computeStandings(matches, participantIds)` — para league, devuelve `[{ user, played, won, drawn, lost, points }]` ordenado por puntos (3/1/0). Ties: cantidad de victorias, luego ID estable.

### Rutas (`server/routes/torneos.js`)

```
GET    /api/torneos                          optionalAuth — ?status, ?game, ?page, ?limit
                                              status='draft' solo visible a admins
POST   /api/torneos                          protect + requireAdmin       // crea en draft
GET    /api/torneos/:id                      optionalAuth                 // draft 404 a no-admins
PUT    /api/torneos/:id                      protect + requireAdmin       // metadatos + imagen opcional
DELETE /api/torneos/:id                      protect + requireAdmin       // solo si draft o sin matches

POST   /api/torneos/:id/register             protect                      // crea pending
DELETE /api/torneos/:id/register             protect                      // cancela propia pending
POST   /api/torneos/:id/registrations/:userId/accept   protect + requireAdmin
POST   /api/torneos/:id/registrations/:userId/reject   protect + requireAdmin
DELETE /api/torneos/:id/participants/:userId protect + requireAdmin       // remueve aprobado (solo si draft/registration)

PATCH  /api/torneos/:id/seeds                protect + requireAdmin       // body: { participantIds: [...] }
PATCH  /api/torneos/:id/status               protect + requireAdmin       // body: { status }
                                              // transiciones válidas:
                                              //   draft → registration
                                              //   registration → in_progress (genera matches)
                                              //   in_progress → finished (calcula podio)
                                              //   draft/registration → draft (vuelve atrás)

GET    /api/torneos/:id/matches              optionalAuth                 // populated playerA/B
POST   /api/torneos/:id/matches/:matchId/result   protect + requireAdmin
                                              // body: { winnerId } o { draw: true } (league only)
                                              // si single_elim: avanza ganador a nextMatch + dispara notifs
DELETE /api/torneos/:id/matches/:matchId/result   protect + requireAdmin
                                              // deshace resultado; en single_elim cascadea (limpia ganador de matches descendientes)
```

Registrar en `server/server.js` junto a las demás rutas: `app.use('/api/torneos', require('./routes/torneos'))`.

### Cloudinary
- Banner de torneo: folder `turnocero/torneos/<torneoId>/`, transform `{ width: 1200, crop: 'limit' }`.
- Usar el mismo middleware multer in-memory + helper de upload existente.

### Notifications

Agregar 4 tipos nuevos a `server/utils/saveNotification.js` (todos no-agregantes, lógica de overwrite):
- `tournament_accepted` — payload: `{ torneoId, torneoTitle }`
- `tournament_rejected` — payload: `{ torneoId, torneoTitle }`
- `tournament_advanced` — payload: `{ torneoId, torneoTitle, round }`
- `tournament_eliminated` — payload: `{ torneoId, torneoTitle, round }`

Agregar al `Notification` schema: `torneoId`, `torneoTitle`, `round`.

### Socket.IO events (server → client)

| Evento | Room | Trigger |
|---|---|---|
| `torneo:registration-accepted` | `user:<id>` | admin acepta inscripción |
| `torneo:registration-rejected` | `user:<id>` | admin rechaza inscripción |
| `torneo:advanced` | `user:<id>` | en single_elim, el ganador del match recién cargado |
| `torneo:eliminated` | `user:<id>` | en single_elim, el perdedor (si la ronda no es la final) |

Cada evento incluye `{ torneoId, torneoTitle }` para que `NotificationContext` arme el toast con link a `/torneos/<id>`.

---

## Frontend

### Rutas nuevas (`client/src/App.jsx`)
```
/torneos                    — público (lista con filtros por estado)
/torneos/:id                — público (detalle: brackets/tabla, inscripción, controles admin)
/torneos/crear              — admin only (envuelto en <AdminRoute>)
/torneos/:id/editar         — admin only
```

### Estructura (`client/src/pages/torneos/`)
```
Torneos.jsx                    — lista con tabs de estado (Inscripción / En curso / Finalizados)
TorneoDetail.jsx               — detalle (info + tabs: Participantes | Matches | Bracket/Posiciones)
CreateTorneo.jsx               — form de creación (admin) — toma como modelo CreateTable.jsx
EditTorneo.jsx                 — form de edición (admin)
TorneoSkeleton.jsx             — skeleton (shimmer estándar via .bone)
components/
  TorneoCard.jsx               — card de lista
  RegisterButton.jsx           — "Inscribirme" / "Cancelar inscripción" / "Pendiente de aprobación" / "Inscripto"
  AdminPanel.jsx               — todos los controles admin (gated por isActuallyAdmin && !viewAsUser)
  RegistrationsList.jsx        — admin: pending registrations con accept/reject
  ParticipantsList.jsx         — público; admin puede remover en draft/registration
  SeedReorderModal.jsx         — admin: drag-handles + flechas ↑↓ para reordenar seeds antes de iniciar
  LeagueStandings.jsx          — tabla de posiciones (Pos | Jugador | PJ | G | E | P | Pts)
  LeagueRoundsList.jsx         — matches agrupados por ronda
  Bracket.jsx                  — bracket de eliminación simple (CSS grid custom)
  MatchRow.jsx                 — fila de match con botón "Cargar resultado" (admin)
  RecordResultModal.jsx        — admin: elige ganador, o "Empate" si es league
Torneos.module.css
TorneoDetail.module.css
Bracket.module.css
```

### Renderizado del bracket (custom CSS, sin librerías)
- Por ronda, una columna flex con gap calculado: `gap: calc(<base-gap> * (2^(round - 1) - 1))` y `padding-top` similar para offset.
- Conectores entre matches via `::after`/`::before` con `border-right` y `border-top/bottom` (técnica clásica de brackets HTML).
- En desktop: scroll horizontal natural; en mobile: vista de "ronda actual" con selector arriba.
- Hasta 32 participantes funciona prolijo; si en el futuro hace falta más, evaluar librería.

### Componentes existentes a reutilizar
- `UserRef` / helper `getUserDisplay` para mostrar nombres (memoria: usuarios eliminados → "Usuario eliminado").
- `ImageDropzone` de [client/src/pages/noticias/Noticias.jsx:17-77](client/src/pages/noticias/Noticias.jsx#L17-L77) para el banner.
- Skeleton `.bone` pattern de [client/src/pages/compartidas/CompartidaSkeleton.module.css](client/src/pages/compartidas/CompartidaSkeleton.module.css).
- Padding tokens `--page-padding`, `--page-padding-left`, `--page-padding-mobile`.
- `useAuth()` → `{ user, isActuallyAdmin, viewAsUser }` para gateo de UI admin.

### Soporte dual de tema (dark + light) — REQUISITO
Toda la feature debe funcionar en ambos temas sin trabajo adicional. La app tiene toggle en `/perfil` (Apariencia) que conmuta `:root[data-theme='dark']` ↔ `:root[data-theme='light']`. Reglas para todo CSS module y JSX nuevo:

- **Cero colores hardcoded.** Usar siempre variables de [client/src/index.css](client/src/index.css):
  - Fondos: `--bg-dark`, `--bg-card`, `--bg-elevated`, `--bg-hover`.
  - Texto: `--text-primary`, `--text-secondary`, `--text-muted`.
  - Bordes: `--border`, `--border-amber`.
  - Marca y estados: `--amber` (+ light/dark), `--red`, `--green`, `--orange`, `--purple`.
  - Tints temáticos: `--overlay-soft`, `--overlay-medium`, `--overlay-strong`.
  - Texto sobre fondos de marca: `--on-amber` (no `#fff`).
  - Variantes de opacidad: `--amber-10/15/20/25/30/35/40/50`, `--red-10/15/25/30`, `--green-10/15/25/30/35/40`. Si necesito un valor que no existe (ej: para tintar el highlight del "ganador" en el bracket), agregarlo a `index.css` bajo `:root` y `:root[data-theme='light']`.
- **Sombras `rgba(0,0,0,X)`** quedan como literales (son theme-agnostic).
- **Conectores del bracket**: usar `border-color: var(--border)` (o `--amber` para el path del ganador). NO `#444` ni similares.
- **Highlight de "ganador"** en match: tint `var(--amber-15)` de fondo + `border-color: var(--amber)` (funciona en ambos temas).
- **Tabla de posiciones**: zebra rows con `var(--bg-card)` y `var(--bg-elevated)`. Header sticky con `var(--bg-elevated)` + `border-bottom: 1px solid var(--border)`.
- **Estados de chip** ("Inscripción abierta" / "En curso" / "Finalizado" / "Borrador"): tints con `--green-25` / `--amber-20` / `--text-muted` / `--orange-25` respectivamente, texto con la variante sólida.
- **Inline en JSX o SVG** (íconos del bracket, líneas decorativas): si depende del tema, leer la variable en runtime con `getComputedStyle(document.documentElement).getPropertyValue('--amber')` y re-aplicar via `useEffect([theme])` con `useTheme()` de [client/src/context/ThemeContext.jsx](client/src/context/ThemeContext.jsx). Ver patrón en `buildMarkerIcon` de [client/src/pages/users/UserProfile.jsx](client/src/pages/users/UserProfile.jsx).

### NotificationContext
Agregar 4 listeners en [client/src/context/NotificationContext.jsx](client/src/context/NotificationContext.jsx) (paralelo a `chat:notification`):
```js
socket.on('torneo:registration-accepted', (data) => addToast({ type: 'tournament_accepted', ...data }))
socket.on('torneo:registration-rejected', (data) => addToast({ type: 'tournament_rejected', ...data }))
socket.on('torneo:advanced',              (data) => addToast({ type: 'tournament_advanced', ...data }))
socket.on('torneo:eliminated',            (data) => addToast({ type: 'tournament_eliminated', ...data }))
```
Y en el render del toast, click → navega a `/torneos/${torneoId}`.

### Navegación
- [client/src/components/layout/Sidebar.jsx](client/src/components/layout/Sidebar.jsx) — agregar "Torneos" en la sección pública (entre "Noticias" y "Eventos"). Ícono nuevo en el objeto ICONS (trofeo).
- [client/src/components/layout/BottomNav.jsx](client/src/components/layout/BottomNav.jsx) — agregar en `REGULAR_NAV` en la misma posición. (Memoria: siempre sincronizar Sidebar y BottomNav.)
- `getActiveId(pathname)` en ambos: matchear `/torneos*`.

### i18n
Todo en castellano rioplatense, slugs incluidos (`/torneos`, `/torneos/crear`, `/torneos/:id/editar`). Textos: "Torneos", "Inscribirme", "Inscripción abierta", "En curso", "Finalizado", "Tabla de posiciones", "Bracket", "Cargar resultado", "Empate", etc.

---

## Validación / verificación end-to-end

Levantar ambos servers (`npm run dev:server` + `npm run dev:client`) y probar este flujo completo:

1. **Como admin** (con view-as-user **OFF**):
   - Crear torneo de tipo Liga con 4 participantes posibles → guarda como `draft`.
   - Pasar a `registration`.
   - Verificar que aparece en `/torneos` (tab "Inscripción").
2. **Como usuario común** (otra cuenta, logout/login):
   - Ver `/torneos/:id` → ver botón "Inscribirme".
   - Inscribirse → estado pasa a "Pendiente de aprobación".
3. **Vuelta como admin**:
   - Ver pending registrations → aceptar a 4 usuarios.
   - Verificar que el usuario aceptado recibió notificación (toast + persistente).
   - Reordenar seeds.
   - Pasar a `in_progress` → se generan 6 matches (round-robin de 4: 3 rondas, 2 matches por ronda).
   - Cargar resultados (uno con empate) → tabla de posiciones se actualiza con 3/1/0.
   - Pasar a `finished` → se calcula podio.
4. **Repetir** con torneo de Eliminación simple con 5 participantes:
   - Bracket debe tener byes en R1 para los seeds altos.
   - Al cargar resultado de un match, el ganador aparece en el match de la siguiente ronda.
   - Ganador recibe `torneo:advanced`; perdedor (si no es final) recibe `torneo:eliminated`.
   - Deshacer resultado → cascadea: si el ganador ya pasó de ronda, se limpia.
5. **Admin con view-as-user ON**:
   - Todos los botones admin (crear, editar, aceptar, cargar resultado, etc.) deben **ocultarse**.
6. **Visitante sin login**:
   - Puede ver `/torneos` y `/torneos/:id`.
   - No ve botón "Inscribirme" (debe mostrar prompt de login).
   - No ve drafts.
7. **Mobile**:
   - BottomNav muestra el ítem "Torneos".
   - Bracket en mobile: selector de ronda funciona.
8. **Tema light**:
   - Toggle desde `/perfil` (Apariencia).
   - Recorrer `/torneos`, `/torneos/:id` (Liga y Eliminación), `/torneos/crear`, `/torneos/:id/editar`.
   - Verificar contraste en: cards de la lista, chips de estado, tabla de posiciones (zebra rows + header), bracket (conectores y highlight de ganador), modales (cargar resultado, reordenar seeds), toasts de notificación.
   - Hover states de filas y botones legibles en ambos temas.
9. **Edge cases**:
   - Torneo sin participantes y `registration → in_progress` → debe rechazar con 400.
   - Single_elim con 1 participante → rechazar.
   - Cancelar inscripción cuando ya estás aceptado → no permitido en `in_progress`.

Sin tests automatizados (proyecto no usa). Antes del commit final correr sobre los archivos nuevos:
- `/react-review` — best practices y ESLint.
- `/mobile-review` — viewport y touch.
- `/css-hardcode-audit` — confirma cero colores hardcoded (requisito de tema dual).

---

## Archivos críticos a crear/modificar

**Crear:**
- `server/models/Torneo.js`
- `server/models/TorneoMatch.js`
- `server/routes/torneos.js`
- `server/utils/tournamentGeneration.js`
- `client/src/pages/torneos/` (todos los componentes listados arriba)

**Modificar:**
- `server/server.js` — registrar router y agregar logging del nuevo módulo.
- `server/models/Notification.js` — campos `torneoId`, `torneoTitle`, `round`.
- `server/utils/saveNotification.js` — manejar los 4 tipos nuevos.
- `client/src/App.jsx` — 4 rutas nuevas.
- `client/src/context/NotificationContext.jsx` — 4 socket listeners + toast rendering.
- `client/src/components/layout/Sidebar.jsx` — entry "Torneos".
- `client/src/components/layout/BottomNav.jsx` — entry "Torneos" en REGULAR_NAV.
- `CLAUDE.md` — agregar sección Torneos al final del documento (modelos, rutas, eventos).

## Out of scope (v1)
- Doble eliminación, Suizo.
- Participantes no registrados (free-text).
- Puntajes numéricos / tiebreaks por diferencia.
- Notificaciones por match programado o resultado cargado (solo aceptación/rechazo + avance/eliminación).
- Programación con fechas/horarios por match.
- Premios, integración con compartidas, etc.
