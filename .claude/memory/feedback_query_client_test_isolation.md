---
name: feedback-query-client-test-isolation
description: tests that render <App/> more than once in the same file must call queryClient.clear() in beforeEach — the production QueryClient is a module-level singleton
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53ce6a90-e61b-40eb-982f-94260843ba8f
  modified: 2026-07-30T16:57:06.479Z
---

`client/src/queries/queryClient.js` exports a single module-level `QueryClient` instance, imported directly by `App.jsx` — correct for the real app (one client for its whole lifetime), but it means **the same cache persists across every test in a file that imports and renders `<App/>` more than once**, since ES module imports are cached per test file run.

**Concretely:** `App.test.jsx` renders `<App/>` 3 times. The first two use the default (successful) MSW handlers, populating e.g. the site-config query's cache. The third overrides the handler to simulate a failure — but with `staleTime: Infinity` on that query (see [[project_rtk_react_query_migration]]), React Query considers the already-cached data fresh and never refetches on mount, so the third render silently reuses the stale successful data instead of hitting the new mock. The test then times out waiting for UI that depends on the error path (e.g. the 500 screen) that never appears — with no obvious error, just a timeout.

**How to apply:** any test file that renders the real `<App/>` (importing the production `queryClient` transitively) more than once, where different tests expect different network outcomes for the same query key, must call `queryClient.clear()` in `beforeEach` (import `{ queryClient }` from `client/src/queries/queryClient.js` directly). Tests that use `AllProviders` or a hand-rolled per-test `QueryClient` (the common pattern for component/context tests, not full-app tests) don't have this problem — each render gets its own isolated client.
