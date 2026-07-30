---
name: feedback-tanstack-query-test-timing
description: "queryClient.setQueryData notifies observers via microtask — tests need await waitFor(), not a bare synchronous expect after act(() => click())"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53ce6a90-e61b-40eb-982f-94260843ba8f
  modified: 2026-07-30T16:10:32.909Z
---

`queryClient.setQueryData(...)` (and any React Query cache write triggered from inside a click handler, socket callback, etc.) notifies subscribed `useQuery`/`useMutation` observers through a microtask-scheduled `notifyManager`, **not synchronously**. A synchronous `act(() => screen.getByText(...).click())` followed immediately by a bare `expect(...)` can read the DOM **before** the component actually re-rendered with the new cache value — the assertion sees stale data even though the write already landed in the cache.

**Why this matters:** under the old `useState`-based Context system, `setState` inside a click handler flushed synchronously within `act()`, so `act(() => click()); expect(...)` always worked. Migrating that state to a TanStack Query cache write breaks that assumption silently — the test doesn't error, it just asserts against stale data and fails with a confusing "expected X, got the old value" message.

**How to apply:** any test that performs an action (click, fired event, etc.) which triggers a `setQueryData` write (directly, or indirectly through a hook like `useMutation`) and then asserts on UI derived from that query's data, must wrap the assertion in `await waitFor(() => expect(...))` instead of a bare synchronous `expect(...)`. This was needed in 16 of 64 tests in `NotificationContext.test.jsx` during the [[project_rtk_react_query_migration]] Fase 3 migration (`markRead*`/`setActiveX`/`clearAll`/`markAllRead`/`dismiss` all triggered this). Plain `fireSocketEvent`-only assertions with no prior data in the cache sometimes appeared to pass synchronously anyway — don't rely on that; when in doubt, use `waitFor`.

Diagnosed by adding a temporary `console.log` inside the `setQueryData` updater and the component's render body — confirmed the cache write happened with the correct key and correct next value, but the component's render log didn't fire again before the assertion ran.
