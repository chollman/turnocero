---
name: feedback-redux-preloaded-state-per-test
description: "Redux slice cuyo estado inicial depende de localStorage por caller (no solo una vez al bootear la app) necesita preloadedState, no initialState bakeado"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53ce6a90-e61b-40eb-982f-94260843ba8f
  modified: 2026-08-03T23:44:37.122Z
---

Cuando un slice de Redux necesita releer su valor inicial en cada test (no solo una vez al importar el módulo real de la app), exportar un getter invocable (`getInitialXState()`) separado de `initialState`, y pasarlo vía `configureStore({ preloadedState: { x: getInitialXState() } })` en cada call site — el `store.js` real de la app Y un `makeStore()` por test.

**Por qué:** `createSlice({ initialState })` solo evalúa `initialState` una vez, en el momento en que el módulo se importa (primer `import` del archivo por proceso de test). Los slices `theme`/`language` de Turnocero bakean su valor inicial ahí mismo (`initialState: { value: getInitialTheme() }`) porque les alcanza con correr una sola vez — sus tests nunca necesitan que ese valor cambie entre casos. Un slice como `auth` (token en `localStorage`) sí lo necesita: cada test hace `localStorage.setItem("token", "tok")` y espera que el store recién creado lo refleje. Si el getter está bakeado en `initialState`, el valor queda congelado desde el primer test del archivo — los siguientes tests heredan el `localStorage` del primero.

**Cómo aplicar:** cualquier slice futuro (en Turnocero o en el trabajo de oficina que motiva esta práctica) cuyo valor inicial dependa de storage/env externo Y cuyos tests necesiten variar ese valor entre casos, usa este patrón. Si el valor solo importa una vez (nunca cambia entre tests del mismo archivo), el patrón más simple de `theme`/`language` (bakeado en `initialState`) alcanza y es menos código — no lo uses por defecto, solo cuando el test realmente lo necesita.

Ver [[project_rtk_react_query_migration]] — Fase 7 (AuthContext), donde se detectó este problema al portar `AuthContext.test.jsx`.
