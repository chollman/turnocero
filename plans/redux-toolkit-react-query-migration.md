# Migración a Redux Toolkit + TanStack Query — Turnocero

**Fecha:** 2026-07-29
**Motivación:** práctica dirigida — el trabajo de oficina del usuario pide arquitectura MVC-ish y Redux Toolkit; este plan usa Turnocero (hobby, sin equipo) como sandbox real para incorporar ambos patrones sin arriesgar el proyecto.
**Alcance:** `client/` únicamente. `server/` no se toca.
**Método:** migración incremental por fases, con convivencia explícita entre Context API (actual) y las librerías nuevas durante todo el proceso — sin big-bang rewrite.

---

## Estado actual (medido, no estimado)

| Contexto | Líneas | Consumidores |
|---|---|---|
| `NotificationContext` | 490 (+ `notificationReducers.js` 1096 + 13 hooks de listeners) | 43 archivos |
| `AuthContext` | 265 | 65 archivos |
| `CommunityContext` | 325 | 18 archivos |
| `ChatContext` | 233 | 9 archivos |
| `SiteConfigContext` | 159 | 21 archivos |
| `LanguageContext` | 58 | 1 archivo |
| `ThemeContext` | 49 | 2 archivos |

Además: **102 archivos** llaman `axios.` directamente (fetch ad hoc con `useState`+`useEffect`+`AbortController`, ver `feedback_abort_controller_pattern`), y solo **1** usa un hook `useApi` genérico. Ese es el verdadero volumen de la migración de datos, no los 7 contextos.

Los **820 `useState`** del proyecto son en su mayoría estado local de UI/forms — **quedan fuera de alcance**, no se tocan.

---

## Principio de diseño: no todo Context es "client state"

Antes de mecánicamente convertir cada Context en un slice de Redux, hay que clasificar qué es **estado de cliente** (UI, preferencias, flags — va a Redux Toolkit) y qué es en realidad **estado de servidor cacheado** (datos que vienen de una API y se invalidan — va a TanStack Query). Migrar todo a Redux sin esta distinción es el error más común al adoptar RTK y recrea a mano lo que TanStack Query ya resuelve (cache, staleness, refetch, merge por id).

Clasificación de los 7 contextos:

| Contexto | Client state (→ Redux slice) | Server state (→ TanStack Query) |
|---|---|---|
| `ThemeContext` | tema elegido + persistencia localStorage | — |
| `LanguageContext` | idioma elegido + persistencia localStorage | — |
| `AuthContext` | token, `isActuallyAdmin` vs `user.isAdmin` (view-as-user toggle) | `GET /api/auth/me` (perfil del usuario) |
| `SiteConfigContext` | — | `GET /api/site-config` + mutación PATCH (admin) |
| `CommunityContext` | preferencia de skin/viewing seleccionada en UI (antes de guardar) | membresías, directorio, community activa (`GET /api/comunidades/*`) |
| `ChatContext` | ventanas flotantes abiertas/minimizadas (UI) | historial de mensajes (vía socket + TanStack cache) |
| `NotificationContext` | contadores de "activeTable/activeEvento" (supresión local) | notificaciones persistidas (`GET /api/notifications`, actualizado por socket vía `setQueryData`) |

Esta tabla es el entregable de la Fase 1 y determina el resto del plan — no se migra nada de la Fase 2 en adelante sin haber confirmado esta clasificación caso por caso.

---

## ✅ Fase 0 — Setup (medio día)

- `npm i @reduxjs/toolkit react-redux @tanstack/react-query` en `client/` + `@tanstack/react-query-devtools` como devDependency.
- Crear `client/src/store/store.js` (store RTK vacío) y `client/src/store/hooks.js` (`useAppDispatch`/`useAppSelector` — sin TS pero con la convención lista para si más adelante se tipa).
- Crear `client/src/queries/queryClient.js` (instancia de `QueryClient`, `defaultOptions` con `staleTime` razonable, comportamiento de `retry` acorde al patrón de errores del backend — `{ message }` + status codes documentados en CLAUDE.md).
- Envolver `App.jsx`: `<QueryClientProvider><Provider store={store}>{/* providers actuales sin tocar */}</Provider></QueryClientProvider>` — **por fuera** de los providers existentes, que siguen funcionando exactamente igual.
- Agregar Redux DevTools + React Query Devtools solo en dev.
- Sin tests nuevos todavía (no hay lógica propia aún).

**Criterio de salida:** build y suite completa (server+client) siguen en verde sin ningún cambio funcional + checklist de verificación post-fase (ver sección dedicada).

**Cerrada 2026-07-29.** Client: 297 test files / 2958 tests verdes. Server: sin tocar (2 fallas pre-existentes ajenas a esta fase — `bgg-comunidad.test.js` con fecha relativa y un crash de worker en `eventoReminders.test.js` que no reprodujo en aislamiento). Verificado a mano en dev: consola limpia, `GET /api/site-config`/`/api/compartidas` sin fallas reales (los `ERR_ABORTED` son el doble-mount de StrictMode, esperado), login + shell autenticado + toggle de tema (dark→light→dark, persistido en `localStorage`) + Redux DevTools + React Query Devtools visibles, todo sin cambios de comportamiento.

---

## ✅ Fase 1 — POC #1: Redux Toolkit puro (Theme + Language)

Objetivo: aprender el patrón `createSlice` en el caso más chico posible (2 y 1 consumidores) antes de tocar algo con superficie real.

- `client/src/store/slices/themeSlice.js` — estado `{ theme: 'dark' | 'light' }`, reducers `toggleTheme`/`setTheme`, persistencia a `localStorage` vía `listenerMiddleware` (reemplaza el `useEffect` actual del Context) manteniendo la key `turnocero_theme`.
- Igual para `languageSlice.js` (`STORAGE_KEYS.LANGUAGE`, sincronización con `i18n.changeLanguage` + `<html lang>` + header Axios `Accept-Language` vía el mismo middleware).
- Mantener `useTheme()`/`useLanguage()` como hooks finos (`useAppSelector`+`useAppDispatch` por dentro) para que los 2+1 archivos consumidores **no cambien ninguna línea**. El Context viejo se borra recién acá porque no queda nadie usándolo.
- El script inline de `index.html` que aplica `data-theme`/`lang` pre-hidratación no cambia — sigue leyendo `localStorage` directamente.
- Tests: portar `ThemeContext.test.jsx`/`LanguageContext.test.jsx` a `themeSlice.test.js`/`languageSlice.test.js` (reducers puros, fáciles de testear sin render).

**Criterio de salida:** `ThemeContext.jsx`/`LanguageContext.jsx` eliminados, cero regresiones, primer PR de referencia para el resto de las fases + checklist de verificación post-fase.

**Cerrada 2026-07-30.** `client/src/store/slices/{theme,language}Slice.js` (createSlice + `createListenerMiddleware` para el side-effect de `data-theme`/`lang`/localStorage/axios header/`i18n.changeLanguage`, antes en el `useEffect` del Context) + hooks públicos en `client/src/hooks/{useTheme,useLanguage}.js` (mismo shape de retorno que antes). Ajuste sobre el plan original: los 2+1 consumidores (`UserProfile.jsx`, `AddressMap.jsx`) sí tocaron 1 línea de import cada uno (nueva ruta `hooks/useTheme` en vez de `context/ThemeContext`) — "no cambia ninguna línea" era optimista; en la práctica fue un cambio de ruta de import, no de lógica. También se actualizó `test/wrappers/AllProviders.jsx` (ya no monta `<ThemeProvider>`, monta `<ReduxProvider store={store}>`) y `App.jsx` ganó un `<I18nextProvider>` explícito (antes lo aportaba `LanguageProvider`; ahora es plumbing de la librería, separado del estado "idioma" que vive en Redux). Client: 299 test files / 2969 tests verdes. Verificado a mano en dev: toggle de tema y de idioma (es→en tradujo todo el sidebar/perfil en vivo), persistencia tras reload sin FOUC, consola limpia en todos los pasos.

---

## ✅ Fase 2 — POC #2: TanStack Query puro (una página de solo lectura)

Objetivo: aprender `useQuery`/cache/invalidación en el caso más simple del proyecto — **Noticias** (`GET /api/noticias`, paginado, público, sin sockets, sin mutación compleja).

- `client/src/queries/noticias.js`: `useNoticiasQuery({ page })`, `useNoticiaQuery(id)`, usando los paths existentes de `api/endpoints.js` (no se toca ese archivo).
- Reemplazar el `useState`+`useEffect`+`axios`+`AbortController` actual de `Noticias.jsx`/`NoticiaDetail.jsx` por los hooks nuevos — código bruscamente más corto, cancelación la maneja React Query solo.
- Mutaciones admin (`POST`/`PUT`/`DELETE /api/noticias`) → `useMutation` con `invalidateQueries(['noticias'])` en `onSuccess`.
- Tests: mock de MSW ya existe (`src/test/server.js`); agregar un wrapper `<QueryClientProvider>` a `AllProviders` para que los tests de componentes sigan funcionando igual.

**Criterio de salida:** Noticias funciona idéntico o mejor en el browser, con menos código y sin `AbortController` manual + checklist de verificación post-fase. Este es el patrón de referencia para la Fase 6.

**Cerrada 2026-07-30.** Ajuste sobre el plan original: la portada usa "cargar más" acumulativo (no un selector de página), así que `useNoticiasQuery` terminó siendo `useInfiniteQuery` (no `useQuery({page})`) — mapea 1:1 con el patrón existente y es más idiomático que forzar `useQuery` + estado manual de acumulación. `client/src/queries/noticias.js` expone `useNoticiasQuery` (infinite), `useNoticiaQuery(id)`, `useRelatedNoticiasQuery` (query dependiente, `enabled` hasta que resuelve la principal — "seguí leyendo") y las 3 mutaciones (create/update/delete) con `invalidateQueries` sobre la key raíz `['noticias']`. `AllProviders.jsx` ahora crea un `QueryClient` nuevo por render (`retry:false` en tests, evita que un mock de error cuelgue el test en backoff) — necesario para que cualquier test que renderice algo con `useQuery` funcione. 3 archivos de test existentes (`Noticias`, `NoticiaDetail`, `NoticiaForm`) se migraron de `MemoryRouter`+`HelmetProvider` sueltos a `AllProviders`, sin cambiar ninguna aserción. Client: 299 test files / 2969 tests verdes. Verificado a mano en dev: lista, detalle, lightbox, y un ciclo completo de edición (PUT exitoso → `invalidateQueries` → refetch automático de detalle + relacionadas → vuelta al detalle actualizado), consola limpia en todo momento.

---

## 🔲 Fase 3 — NotificationContext (el caso más complejo, con sockets)

El más valioso para aprender porque ya tiene forma de reducer (1096 líneas) — la pregunta real es cuánto de eso desaparece al usar TanStack Query correctamente:

- Lista de notificaciones persistidas → `useQuery(['notifications'], ...)` sobre `GET /api/notifications`.
- Los 13 hooks de `notificationListeners/` dejan de despachar a un reducer local y pasan a llamar `queryClient.setQueryData(['notifications'], updater)` (merge por `notifId`, exactamente la lógica de dedup que ya existe, pero como updater de cache en vez de reducer de Context) o `invalidateQueries` cuando el merge no vale la pena replicar.
- `unreadCount`/`dmUnreadTotal` pasan a ser **selectors derivados** sobre los datos de la query (`useMemo` sobre el resultado de `useQuery`), no estado propio.
- Lo que sí es client state real y va a un `notificationUiSlice` de Redux: `activeTableId`/`activeEventoId`/`activeTorneoId`/`activeCompartidaId` (supresión de toasts para el recurso abierto) — esto no viene del servidor, es UI pura.
- El registro de sockets sigue las reglas ya documentadas (`feedback_socket_handler_race`): listeners antes de cualquier `await`.
- Mantener `markReadTable`/`markReadEvento`/etc. como `useMutation` con optimistic update vía `queryClient.setQueryData` antes del PATCH, rollback en `onError` — reemplaza el patrón optimista actual sin la fuente-única ambigua entre socket y estado local (ver `feedback_optimistic_vs_socket`).
- Tests: el archivo de regresión de doble-conteo (`NotificationContext.test.jsx`) se porta a tests de query + mutation; el contrato server (`notifId`+`count`+`timestamp`) no cambia.

**Criterio de salida:** `notificationReducers.js` se reduce drásticamente o desaparece; comportamiento (badge, toasts, dedup) idéntico o mejor, verificado a mano en el browser con 2 sesiones simultáneas + checklist de verificación post-fase.

---

## 🔲 Fase 4 — SiteConfigContext (casi 100% server state)

El caso más simple de "esto en realidad no necesitaba Redux":

- `useSiteConfigQuery()` reemplaza el fetch-on-boot actual.
- `isSectionEnabled(key)` pasa a ser una función derivada del resultado de la query, no estado de contexto.
- Mutación admin (`PATCH /api/site-config`) → `useMutation` + `invalidateQueries`.
- Sin slice de Redux para esto — cero client state real acá.

**Criterio de salida:** todos los toggles de `/panel-admin` y el gating de secciones (`SectionGate`, admin-only vs público) funcionan idéntico + checklist de verificación post-fase.

---

## 🔲 Fase 5 — CommunityContext y ChatContext (híbridos)

- **Community**: membresías/directorio/skin activa → TanStack Query; la selección en curso del picker de "Publicar en" (`CommunitySelect`) antes de confirmar → estado local del componente (ni Redux ni Context, no es global).
- **Chat**: `chatUiSlice` para ventanas abiertas/minimizadas (máx. 3, puramente cliente); historial de mensajes por conversación → `useQuery` + actualización de cache en el listener de `dm:message`.

**Criterio de salida:** directorio de comunidades, member list, skin en subdominio, y las 3 ventanas de chat (abrir/cerrar/minimizar/mensaje en vivo) funcionan idéntico o mejor + checklist de verificación post-fase.

---

## 🔲 Fase 6 — Migración masiva de datos: los 102 axios ad hoc

El bloque más grande en volumen de archivos, pero el de menor riesgo conceptual (ya validado en Fases 2 y 3):

- Ir dominio por dominio siguiendo la carpeta `pages/` (mesas → torneos → eventos → compartidas → bg-watch → usuarios), creando `client/src/queries/<dominio>.js` por cada uno.
- Los hooks ya existentes que hacían de wrapper manual (`useDebouncedValue` alimentando el fetch, `useInfiniteScroll` para paginación) se mantienen — TanStack Query no reemplaza el debounce, y `useInfiniteQuery` es un reemplazo opcional de `useInfiniteScroll` a evaluar dominio por dominio, no obligatorio.
- Cada PR de esta fase: 1 dominio, tests migrados 1:1, sin cambios de comportamiento visible.

**Criterio de salida por dominio:** CRUD completo, paginación, filtros/búsqueda con debounce y estados vacíos del dominio migrado funcionan idéntico o mejor + checklist de verificación post-fase, antes de pasar al siguiente dominio.

---

## 🔲 Fase 7 — AuthContext (el más riesgoso, al final a propósito)

- `authSlice` de Redux: `token`, `isActuallyAdmin`, view-as-user toggle. Persistencia a `localStorage` + header default de Axios vía `listenerMiddleware` (reemplaza el `useEffect` que hoy setea `axios.defaults.headers.common.Authorization`).
- `GET /api/auth/me` → `useQuery(['me'], ..., { enabled: !!token })`, invalidada en login/logout/verify-email.
- El interceptor 401 global (que hoy patea a `/login` ante cualquier 401 fuera de `/api/auth/`) se mantiene como interceptor de Axios tal cual está — no es responsabilidad de Redux ni de React Query, sigue siendo infraestructura de transporte.
- OAuth (Google/Facebook) y el flujo de cookie httpOnly para SSO entre subdominios (`project_community_subdomains`) son los puntos de mayor riesgo — probar manualmente cada flujo (login normal, OAuth, verificación de email, subdominio) antes de dar la fase por cerrada.

**Criterio de salida:** los 8 flujos de auth listados en el checklist post-fase (login, registro+verificación, OAuth x2, forgot/reset password, logout, view-as-user, SSO entre subdominios) funcionan idéntico o mejor — esta fase es la que menos margen tiene para "casi anda".

---

## 🔲 Fase 8 — Cleanup

- Confirmar que ningún archivo importa `context/AuthContext.jsx` (u otro ya migrado) y borrarlo.
- Actualizar `CLAUDE.md` (sección "App shell and layout" + agregar sub-sección de estado global) y `MEMORY.md`/memoria del proyecto con la arquitectura final.
- Actualizar `AllProviders`/`RouterOnly` en `src/test/wrappers/` si cambiaron los providers necesarios para tests.

**Criterio de salida:** smoke final de la app completa (checklist post-fase, fila "Fase 8") sin ningún Context viejo importado en ningún archivo.

---

## Reglas transversales (todas las fases)

- **Convivencia, no reemplazo simultáneo**: en ningún momento se borra un Context viejo sin que su reemplazo esté mergeado y verificado — cero ventanas donde ambos coexistan escribiendo el mismo estado.
- **Tests obligatorios por fase** (convención ya vigente: todo cambio ships con sus tests) — reducers/slices son triviales de testear (funciones puras); queries se testean con MSW igual que hoy.
- **Verificación exhaustiva obligatoria al cierre de cada fase** — ver checklist dedicado abajo. Ninguna fase se da por cerrada solo con suite verde.
- **Un PR por fase como mínimo** (las fases grandes como la 6 y 7 se pueden partir más), para poder revertir sin arrastrar migraciones no relacionadas.

---

## Checklist de verificación exhaustiva post-fase (obligatorio, las 8 fases)

El criterio de cierre de cada fase no es "no rompió nada" — es **"la app se puede seguir usando igual o mejor que antes de la fase"**. Ninguna fase pasa a la siguiente sin completar esto:

1. **Suite completa verde** — `npm test` en `server/` y `client/`, sin `.skip`/`.only` nuevos, sin bajar cobertura de la fase migrada.
2. **Recorrida manual end-to-end en dev** (`npm run dev`) del flujo migrado **y de todo lo que lo consume indirectamente** — no alcanza con probar el componente tocado de forma aislada.
3. **Ambos temas** (dark/light) si la fase toca algo visible — la migración no puede reintroducir el hardcoded-color problem que ya se resolvió (`feedback_theme_support`).
4. **Ambos idiomas** (es/en) si la fase toca algo visible — confirmar que ningún string se rompió en el camino (`feedback_i18n_keys`).
5. **Desktop y mobile** (breakpoints) si la fase toca UI.
6. **Consola del browser limpia** — sin errores ni warnings nuevos (React, Query, Redux DevTools incluidos).
7. **Network tab** — sin llamadas duplicadas, sin loops de refetch, sin llamadas que antes existían y ahora faltan (o viceversa). Comparar contra el comportamiento pre-fase, no solo "funciona".
8. **Sockets/tiempo real, cuando aplique** — probar con 2 pestañas/sesiones simultáneas (ej. Fase 3 notifs, Fase 5 chat/DM) para confirmar que el otro lado sigue recibiendo updates en vivo.
9. **Comparación explícita antes/después** — si algo quedó más lento, con más parpadeo, o con un estado transitorio (loading/error) peor que el Context que reemplaza, la fase no está lista aunque los tests pasen.
10. Recién después de 1-9: borrar el Context viejo (si corresponde en esa fase) y marcar la fase como cerrada (✅) en este documento.

**Qué verificar específicamente por fase** (además del checklist genérico):

| Fase | Foco de la verificación manual |
|---|---|
| 0 | Que los providers nuevos (vacíos) no rompan ningún flujo existente: toggle de tema, login, notifs, chat siguen andando igual que antes de instalar nada. |
| 1 | Toggle de tema e idioma en `/perfil`, persistencia tras refresh, que no reaparezca el FOUC pre-hidratación. |
| 2 | Noticias completo: lista, paginación, detalle, lightbox de imágenes, crear/editar/borrar (admin). |
| 3 | Badge de no leídos, toasts en tiempo real con 2 pestañas/usuarios distintos, `markRead` en cada dominio (mesas, eventos, torneos, compartidas, DM, amigos, comunidades), contador de chat. |
| 4 | Toggles de `/panel-admin`, gating de cada sección vía `SectionGate` para usuario no-admin y para admin con "ver como usuario" activado. |
| 5 | Switcher de comunidades, member list, skin en subdominio; chat flotante (abrir/cerrar/minimizar hasta 3 ventanas, historial, mensaje nuevo en vivo). |
| 6 | Por cada dominio migrado: CRUD completo, paginación, filtros/búsqueda con debounce, estados vacíos (`EmptyState`). |
| 7 | Login normal, registro + verificación de email, OAuth Google/Facebook, forgot/reset password, logout, toggle "ver como usuario", SSO entre subdominios, refresh de página autenticada. |
| 8 | Recorrida completa de la app una vez más como smoke final, confirmando que no queda ningún Context viejo importado en ningún lado. |

---

## Fuera de alcance (explícito)

- No se migra `server/` — sigue Express + services.
- No se tipa el proyecto con TypeScript como parte de este plan (evaluado como recomendación aparte, no bloqueante acá).
- No se reemplazan los 820 `useState` de estado local de UI/forms.
- `RTK Query` no se adopta — se eligió TanStack Query en su lugar; no correr ambas herramientas de data-fetching a la vez.
