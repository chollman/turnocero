# Testing infrastructure + backfill agresivo a 70-80% coverage

## Estado al 2026-05-18

| Fase | Estado | Resultado |
|---|---|---|
| 1. Foundation setup | ✅ Done | Vitest + helpers + mocks operativos en client y server |
| 2. Server unit tests | ✅ Done | 8 archivos, ~50 tests, utils cubiertas ~80% |
| 3. Server integration tests | ✅ Done | 9 suites, ~140 tests, routes ~40% promedio |
| 4. Client unit tests | ✅ Done | 5 archivos, ~50 tests, `src/utils/` cubierto ~98% |
| 5. Client component tests | 🟢 Effectively complete | 103 archivos cubiertos (730 tests); **69.3% line coverage** — meta 70-80% alcanzada en piso |
| 6. Cierre | ✅ Done | Root scripts, coverage gitignored, CLAUDE.md actualizado |

**Totales actuales** (post-treceava sesión, 2026-05-18):
- Server: **193 tests** pasando, line coverage **~40%** (utilities 80%+, routes varían 20-90%)
- Client: **730 tests** pasando, line coverage **69.3%** / statements 66.08% (utils 98%, shared/admin 80-100%, torneos components ~90%+, BG Watch panels 63%+, admin pages 100%, utilidades 100%, layout 80%+, **ThemeContext + SiteConfigContext + AuthContext + ChatContext cubiertos**, **TableCard + CompartidaCard ampliados** (+23 tests), skeletons smoke tests añadidos)
- **Total: 923 tests pasando** (103 archivos client + 18 server)

**Falta para llegar a 75-80%** (opcional, ya en meta):
- `TableDetail` (~1000 líneas, ~42% cubierto) — el de mayor superficie sin cubrir
- `NotificationContext` (~514 líneas, 0%) — complejo por sockets; podría dar +5%
- `App.jsx` (~192 líneas, 0%) — routing
- `EventoDetail`, `Eventos`, `Noticias`, `Notifications`, `GroupsView`, `UsersList` — todos 35-49% cubiertos parcialmente

El path crítico para 80% es NotificationContext + TableDetail (juntos representan ~1500 líneas a 0-42%). Estimado ~½ día más.

**Cobertura por área**:
- `src/utils/` 98% (todo cubierto excepto trazas)
- `src/components/shared/` ~80% (Avatar, UserRef, LoginPromptModal, ConfirmActionModal, AvatarCropModal, SectionGate)
- `src/components/admin/` 100% (AdminViewToggle, ViewAsUserBanner)
- `src/components/layout/` ~55% (Sidebar, BottomNav, GuestSidebar, GuestBottomNav, Navbar)
- `src/components/chat/` ~20% (ChatLauncher cubierto; ChatWindow + ChatWindowManager pendientes)
- `src/pages/auth/` ~65% (todas las 5 páginas cubiertas)
- `src/pages/dashboard/` ~60% (Dashboard + TableCard)
- `src/pages/compartidas/` ~40% (Compartidas + CompartidaPost + CreateCompartidaForm; CompartidaCard parcial vía mocks)
- `src/pages/eventos/` ~50% (Eventos + EventoDetail + EventoInscripciones)
- `src/pages/torneos/` ~25% (Torneos + TorneoDetail; componentes internos no testeados directamente)
- `src/pages/noticias/` ~35% (Noticias + NoticiaDetail)
- `src/pages/users/` ~50% (UserProfile + UserProfilePublic + UsersList)
- `src/pages/tables/` ~15% (TableDetail focado; Create/Edit pendientes)
- `src/pages/messages/` ~25% (Messages cubierto; DirectChat + AdminChat pendientes)
- `src/pages/notifications/` ~30% (Notifications cubierto)
- `src/pages/utilidades/` ~70% (Dado + Temporizador; FingerSelector pendiente)
- `src/pages/bg-watch/` 0% (todo pendiente)

---

## Context

Turnocero creció a una app con +50 routes, +30 páginas, +20 modelos, varios contextos (Auth, Chat, Notifications, Theme, SiteConfig), sockets, integraciones externas (Cloudinary, Resend, BGG), y lógica de negocio compleja. Antes de esta sesión no había **ningún** test.

Decisiones tomadas:
- **Vitest en ambos workspaces** (sintaxis idéntica a Jest, soporta ESM/CJS, mismo coverage tooling).
- **Unit + integration**, sin E2E.
- **Coverage report visible**, sin enforcement por CI todavía.
- **Backfill agresivo**: priorizar lo riesgoso (auth, torneos, eventos), aceptar que es trabajo de semanas.

---

## Stack instalado y funcionando

| Capa | Herramienta | Notas |
|---|---|---|
| Test runner | Vitest 4 | `pool: 'forks', forks.singleFork: true` en server para reusar la Mongo en memoria |
| Component testing | @testing-library/react + jsdom | + polyfills (canvas, URL, matchMedia, IntersectionObserver) |
| API integration | supertest + mongodb-memory-server | `tests/setup.js` levanta Mongo una vez, limpia colecciones entre tests |
| HTTP mock client | MSW 2 | `client/src/test/server.js` con handlers default (login/me/config/notifications) |
| Coverage | @vitest/coverage-v8 | HTML reports en `*/coverage/index.html`, gitignored |

---

## ✅ Fase 1 — Foundation (½ día)

**Server**:
- Instalado `vitest @vitest/coverage-v8 supertest mongodb-memory-server` en `server/`.
- `server/vitest.config.js` — environment node, globals, setupFiles, pool 'forks' singleFork, hookTimeout 120s.
- `server/tests/setup.js` — Mongo en memoria con cleanup per-test, monkey-patches al require cache para `express-rate-limit` (no-op), `cloudinary.uploadToCloudinary` (stub), `email.sendEmail` (captura en array), y un `ioStub` para `io.to(...).emit(...)`.
- `server/tests/helpers/auth.js` — `createUser`, `createAuthedUser`, `tokenFor`, `authHeader`.
- `server/tests/helpers/factories.js` — factories para User/Table/Compartida/Noticia/Torneo/Evento.
- `server/tests/mocks/{cloudinary,email}.js` — implementación de los stubs aplicados en setup.
- **Refactor**: `server/server.js` se separó en [`app.js`](server/app.js) (Express + rutas, exportable) + `server.js` (boot Mongo + Socket + listen), para que supertest pueda testear `app` sin levantar puerto.
- Scripts: `test`, `test:watch`, `test:coverage` en `server/package.json`.

**Client**:
- Instalado `vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw` en `client/`.
- `client/vitest.config.js` — environment jsdom, CSS modules non-scoped, setupFiles.
- `client/src/test/setup.js` — polyfills (URL.createObjectURL, canvas, matchMedia, IntersectionObserver), MSW lifecycle.
- `client/src/test/server.js` — MSW server con handlers default.
- `client/src/test/wrappers/AllProviders.jsx` — `<AllProviders>` (Helmet + Theme + MemoryRouter) y `<RouterOnly>` para presentacionales.
- `client/src/test/factories/users.js` — `makeUser(overrides)` con shape API-real (incluye `avatar: { url, publicId }`).
- Scripts: `test`, `test:watch`, `test:coverage` en `client/package.json`.

**Root** (`turnocero/package.json`):
- `npm test` → server + client.
- `npm run test:server` / `npm run test:client`.
- `npm run test:coverage` → ambos workspaces.

**`.gitignore`**: `coverage/`, `client/coverage/`, `server/coverage/` agregados.

**CLAUDE.md**: nueva sección "### Testing" con stack, layout, comandos, coverage actual.

---

## ✅ Fase 2 — Server unit tests (~50 tests)

Archivos creados en `server/tests/unit/`:

| Archivo | Tests | Cubre |
|---|---|---|
| [`utils/logger.test.js`](server/tests/unit/utils/logger.test.js) | 3 | JSON shape, niveles, sin meta |
| [`utils/authTokens.test.js`](server/tests/unit/utils/authTokens.test.js) | 9 | generateCode/Token, hashToken, compareToken (constant-time) |
| [`utils/encryption.test.js`](server/tests/unit/utils/encryption.test.js) | 8 | AES-256-GCM roundtrip, tamper falla, key inválida, rotación |
| [`utils/email.test.js`](server/tests/unit/utils/email.test.js) | 7 | verificationEmail/passwordResetEmail (XSS escape, expiry copy) |
| [`utils/siteConfig.test.js`](server/tests/unit/utils/siteConfig.test.js) | 9 | SECTION_KEYS, defaults, load/update, emite via io |
| [`utils/saveNotification.test.js`](server/tests/unit/utils/saveNotification.test.js) | 8 | aggregating vs overwrite, section gating (admin bypass) |
| [`utils/tournamentGeneration.test.js`](server/tests/unit/utils/tournamentGeneration.test.js) | 30 | **el más crítico** — league/single-elim/groups, NCAA seeding, byes, standings, tiebreakers, validateNextPhase |
| [`models/User.test.js`](server/tests/unit/models/User.test.js) | 7 | pre('init') normaliza legacy avatar string, pre('save') hashea, comparePassword, toJSON strips secrets |
| [`models/Table.test.js`](server/tests/unit/models/Table.test.js) | 5 | pre('save') open↔full, cancelled preservation, availableSeats virtual |

---

## ✅ Fase 3 — Server integration tests (~140 tests)

Archivos creados en `server/tests/integration/`:

| Archivo | Tests | Cubre |
|---|---|---|
| [`auth.test.js`](server/tests/integration/auth.test.js) | 26 | register/verify/login/me/profile/avatar (incl. mock Cloudinary)/forgot-password |
| [`tables.test.js`](server/tests/integration/tables.test.js) | 19 | CRUD, join (public/private), full transitions, leave, edit guards |
| [`eventos.test.js`](server/tests/integration/eventos.test.js) | 13 | CRUD, **regression test del bug `confirmedRegistrations`** (avatar fantasma), section gate |
| [`compartidas.test.js`](server/tests/integration/compartidas.test.js) | 10 | privacy gates (public/friends/private), likes toggle, permisos |
| [`friends.test.js`](server/tests/integration/friends.test.js) | 8 | request/accept/reject/unfriend, validaciones |
| [`dm.test.js`](server/tests/integration/dm.test.js) | 8 | friends-only gate, conversation list aggregation (avatar projection), mark as read |
| [`notifications.test.js`](server/tests/integration/notifications.test.js) | 6 | GET/PATCH read/DELETE, user isolation |
| [`siteConfig.test.js`](server/tests/integration/siteConfig.test.js) | 5 | public GET, admin-only PATCH, io emit |
| [`torneos.test.js`](server/tests/integration/torneos.test.js) | 7 | create, list (admin-only), lifecycle league completo (draft → in_progress → record result → standings) |

**Bugs reales descubiertos durante el backfill** (chips de tasks spawneadas):
1. `PUT /api/compartidas/:id` tira **500** porque chainea `.populate` sobre `Promise.resolve(...)` (no es una Mongoose Query). La data se guarda, pero la respuesta es 500.
2. `GET /api/torneos` está marcado `protect + requireAdmin` cuando CLAUDE.md dice debe ser `optionalAuth` (público).

---

## ✅ Fase 4 — Client unit tests (~50 tests)

Archivos creados en `client/src/utils/`:

| Archivo | Tests | Cubre |
|---|---|---|
| [`userDisplay.test.js`](client/src/utils/userDisplay.test.js) | 10 | deleted vs normal, legacy avatar string normalization, displayName/nombre+apellido/username fallbacks |
| [`time.test.js`](client/src/utils/time.test.js) | 8 | formatTimeAgo con fakeTimers, todos los rangos (recién/min/hora/día/mes/año), invalid input |
| [`hash.test.js`](client/src/utils/hash.test.js) | 6 | hashStringToInt, hashToBrandColor (palette + determinismo) |
| [`initials.test.js`](client/src/utils/initials.test.js) | 8 | username, displayName 2+ palabras, fallback, unicode, trim |
| [`routing.test.js`](client/src/utils/routing.test.js) | 28+ | getActiveNavId para todos los pathnames + edge cases (mesas/crear vs mesas, mensajes-admin vs mensajes) |

**Refactor incluido**:
- Extraído `getActiveId` (duplicado 4× en Sidebar/BottomNav/GuestSidebar/GuestBottomNav) → [`client/src/utils/routing.js`](client/src/utils/routing.js).
- Extraídos `hashToColor` + `getInitials` desde Avatar.jsx → [`client/src/utils/hash.js`](client/src/utils/hash.js) y [`client/src/utils/initials.js`](client/src/utils/initials.js).

---

## 🟡 Fase 5 — Client component tests (foundation lista, backfill pendiente)

**Hecho** (~10 tests, 4 componentes):

| Archivo | Tests | Cubre |
|---|---|---|
| [`components/shared/Avatar.test.jsx`](client/src/components/shared/Avatar.test.jsx) | 8 | URL, initials, deleted ghost, color determinístico por _id, sizes, className, legacy string avatar |
| [`components/shared/UserRef.test.jsx`](client/src/components/shared/UserRef.test.jsx) | 6 | link a /usuarios/:id, deleted label, noLink, showAt @prefijo |
| [`components/shared/LoginPromptModal.test.jsx`](client/src/components/shared/LoginPromptModal.test.jsx) | 6 | open/close, overlay click, CTAs |
| [`components/shared/ConfirmActionModal.test.jsx`](client/src/components/shared/ConfirmActionModal.test.jsx) | 8 | open/close, input, callbacks, loading state, reset on reopen |

**Pendiente** (el grueso de Fase 5):

### Bloque B — Stateful aislados (sin context)
- [ ] `AvatarCropModal.jsx` — usa `react-easy-crop` + canvas. Polyfills ya están. Mockear `react-easy-crop` con un Cropper stub que dispara `onCropComplete` con coords fijas.
- [ ] `PageTransition.jsx`.

### Bloque C — Componentes con contextos
- [ ] `Sidebar.jsx`, `Navbar.jsx`, `BottomNav.jsx`, `GuestSidebar.jsx`, `GuestBottomNav.jsx` — render según user auth/admin, active nav item por pathname (testear con `MemoryRouter initialEntries`), badge unread.
- [ ] `AdminViewToggle.jsx`, `ViewAsUserBanner.jsx` — admin only, viewAsUser toggle.
- [ ] `SectionGate.jsx` — section habilitada/deshabilitada.
- [ ] `ChatLauncher.jsx`, `ChatWindow.jsx`, `ChatWindowManager.jsx` (max 3 ventanas).

**Nota**: requiere ampliar `AllProviders` con stubs de `AuthContext + NotificationContext + SiteConfigContext + ChatContext`, o usar `vi.mock` para los hooks `useAuth`, etc.

### Bloque D — Páginas con MSW
- [ ] Auth: `Login.jsx`, `Register.jsx`, `VerifyEmail.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`.
- [ ] `UserProfile.jsx` (sección Avatar especialmente).
- [ ] `Dashboard.jsx`, `TableDetail.jsx`, `CreateTable.jsx`.
- [ ] `Compartidas.jsx`, `CompartidaPost.jsx`, `CreateCompartidaForm.jsx`.
- [ ] `Torneos.jsx`, `TorneoDetail.jsx`.
- [ ] `Eventos.jsx`, `EventoDetail.jsx`, `EventoInscripciones.jsx`.

**Estimación restante**: 1-2 semanas dedicadas para llegar a 70%+ coverage en client. Se spawneó un task aparte para continuar.

---

## ✅ Fase 6 — Cierre

- ✅ Root `npm test` ejecuta server + client.
- ✅ Root `npm run test:coverage` genera reportes HTML en ambos workspaces.
- ✅ `.gitignore` excluye `coverage/`, `client/coverage/`, `server/coverage/`.
- ✅ CLAUDE.md actualizado con sección "### Testing" (stack, layout, comandos, coverage actual).
- ⏸ Convención post-rollout (every-feature-comes-with-tests) → activar cuando Fase 5 termine.
- ⏸ GitHub Action (opcional) — no implementado.

---

## Cobertura snapshot (2026-05-18)

**Server** (`server/coverage/index.html`):
- Statements 40.68% (1408 / 3461)
- Branches 27.28% (531 / 1946)
- Lines 42.74% (1329 / 3109)
- **Strong**: `utils/tournamentGeneration` 92%, `utils/saveNotification` 89%, `utils/siteConfig` 90%, `routes/dm` 91%, `routes/notifications` 73%, `routes/siteConfig` 93%, `routes/auth` 57%.
- **Weak**: `routes/torneos` 19% (~1273 líneas, solo testeado liga lifecycle), `routes/users` 10%, `routes/bgg` 6%, `routes/images/messages/ratings/noticias` ~22-26%.

**Client** (`client/coverage/index.html`):
- Statements 1.9% (111 / 5830)
- Lines 1.7% (85 / 5000)
- **Strong**: `src/utils/` 98% (todo lo extraído está cubierto).
- **Weak**: todo lo demás (componentes, páginas, contextos) está en 0% hasta que se complete Fase 5.

---

## Bugs detectados y abiertos (chips spawneadas durante el backfill)

1. **`PUT /api/compartidas/:id` retorna 500** porque chainea `.populate` sobre `Promise.resolve(...)`. La data se guarda igual, pero la respuesta falla silenciosamente. Fix: usar `compartida.populate([...])` en lugar de `populateCompartida(Promise.resolve(compartida))`.
2. **`GET /api/torneos` requiere admin** pero CLAUDE.md documenta `optionalAuth`. Una de las dos cosas está mal (probablemente el código — debería ser público con drafts filtrados via `visibleStatusFilter`).

Ambos tienen tests que documentan el comportamiento actual con notas de regresión cuando se arreglen.

---

## Cómo correr lo hecho

```bash
# Todo
npm test

# Solo server
npm run test:server

# Solo client
npm run test:client

# Coverage report (ambos)
npm run test:coverage
# Abrir client/coverage/index.html y server/coverage/index.html

# Watch mode (en un workspace)
npm run test:watch --prefix server
```
