---
name: project-rtk-react-query-migration
description: Migración en curso de los 7 Context de client/ a Redux Toolkit (client state) + TanStack Query (server state) — plan y estado de fases
metadata: 
  node_type: memory
  type: project
  originSessionId: 53ce6a90-e61b-40eb-982f-94260843ba8f
  modified: 2026-07-30T14:22:26.793Z
---

Migración incremental de `client/src/context/*` a **Redux Toolkit** (estado de cliente) + **TanStack Query** (estado de servidor), documentada fase por fase en [plans/redux-toolkit-react-query-migration.md](plans/redux-toolkit-react-query-migration.md).

**Por qué:** el usuario hace este cambio como práctica dirigida — su trabajo de oficina (proyecto separado, NO Turnocero) le pide arquitectura MVC-ish + Redux Toolkit y quiere aprenderlo en un sandbox real sin arriesgar nada. Turnocero es hobby/solo-dev, así que la migración es opcional/de aprendizaje, no una necesidad estructural del proyecto (ver conversación 2026-07-29 — la arquitectura Context+reducer previa ya era adecuada para su escala).

**Decisión de arquitectura clave:** NO se adoptó RTK Query — se usa **TanStack Query** (`@tanstack/react-query`) por separado para todo lo que sea estado de servidor (los 102 archivos con `axios.` directo), y Redux Toolkit solo para estado de cliente real (UI, preferencias, flags). Cada uno de los 7 contextos se clasificó explícitamente en la tabla del plan antes de migrar — varios (`SiteConfigContext`, la lista de `NotificationContext`) resultaron ser casi 100% server state y NO necesitan slice de Redux, solo queries.

**Convivencia, no big-bang:** `ReduxProvider` + `QueryClientProvider` envuelven el árbol de providers existente en [client/src/App.jsx](client/src/App.jsx) desde la Fase 0; los Context viejos se borran uno por uno solo cuando su reemplazo ya está mergeado y verificado.

**Regla transversal del plan:** cada fase cierra solo después de un checklist de verificación exhaustiva (suite verde + recorrida manual end-to-end + ambos temas + ambos idiomas + consola limpia + comparación explícita antes/después) — el criterio es "la app queda igual o mejor", no solo "no rompió nada".

**Estado de fases** (actualizar acá al cerrar cada una — ver detalle y fecha de cierre en el plan):
- ✅ Fase 0 — Setup (`@reduxjs/toolkit`, `react-redux`, `@tanstack/react-query` instalados; `client/src/store/store.js`+`hooks.js`; `client/src/queries/queryClient.js`; providers envueltos en `App.jsx`; devtools en dev). Cerrada 2026-07-29.
- ✅ Fase 1 — POC Redux Toolkit puro (Theme + Language). `store/slices/{theme,language}Slice.js` (createSlice + `createListenerMiddleware` para side effects) + hooks públicos en `hooks/{useTheme,useLanguage}.js`; `ThemeContext.jsx`/`LanguageContext.jsx` eliminados. Cerrada 2026-07-30.
- ✅ Fase 2 — POC TanStack Query puro (Noticias). `queries/noticias.js`: `useNoticiasQuery` terminó siendo `useInfiniteQuery` (portada usa "cargar más" acumulativo, no page number) + `useNoticiaQuery`/`useRelatedNoticiasQuery` (query dependiente)/3 mutaciones con `invalidateQueries`. `AllProviders.jsx` gana un `QueryClient` nuevo por render (`retry:false`) — patrón de referencia para cualquier test que use `useQuery`. Cerrada 2026-07-30.
- 🔲 Fase 3 — NotificationContext (sockets)
- 🔲 Fase 4 — SiteConfigContext
- 🔲 Fase 5 — CommunityContext + ChatContext
- 🔲 Fase 6 — Migración masiva de los 102 axios ad hoc
- 🔲 Fase 7 — AuthContext (más riesgosa, al final a propósito)
- 🔲 Fase 8 — Cleanup

**Gotcha de setup:** Vite no define `process.env.NODE_ENV` como espera el check default de RTK — `devTools` en `configureStore` se pasa explícito vía `import.meta.env.DEV` (ver `client/src/store/store.js`).
