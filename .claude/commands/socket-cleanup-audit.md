Scan all React files in `client/src/` for Socket.IO subscriptions (`socket.on`) inside `useEffect` that are missing their cleanup (`socket.off` or `return () => ...`), and fix every instance found.

## Background

A `socket.on` inside a `useEffect` without a corresponding cleanup leaks an event listener every time the component re-renders or re-mounts. On a socket that persists across the session (like the one in `NotificationContext`), this causes:

- Duplicate handlers firing for the same event
- Memory leaks that grow with each navigation
- Stale closure bugs where old handlers capture outdated state

**Required pattern:**

```js
useEffect(() => {
  socket.on("event:name", handler);
  return () => socket.off("event:name", handler); // ← required
}, [deps]);
```

**Or when using a named handler:**

```js
useEffect(() => {
  const handleFoo = (data) => { ... };
  socket.on('foo', handleFoo);
  return () => socket.off('foo', handleFoo);
}, [deps]);
```

**Exception — NotificationContext pattern:**
`NotificationContext.jsx` creates a new socket instance per `user` change and returns `socket.disconnect()` as cleanup. This is correct — the socket itself is torn down, so `.off` is not needed on individual events. Do NOT flag this pattern.

## Steps

### 1. Find all files with socket subscriptions

Grep `client/src/` for `socket.on(` — collect all matching files.

### 2. For each file, audit every `socket.on` call

Read the file. For each `socket.on('event', handler)`:

**a) Is it inside a `useEffect`?**  
If no (e.g., it's at module level or in an event handler), skip — different concern.

**b) Does the `useEffect` return a cleanup function that calls `socket.off('event', ...)`?**  
If yes → ✅ correct  
If the `useEffect` returns `socket.disconnect()` or full socket teardown → ✅ correct (NotificationContext pattern)  
If no cleanup at all → 🔧 needs fix

**c) Is the handler an inline arrow function?**  
Calling `.off` on an inline function doesn't work (different reference each render). The handler must be extracted to a named `const` inside the effect so both `.on` and `.off` reference the same function.

### 3. Fix each issue

**Fix for missing cleanup:**

```js
// Before
useEffect(() => {
  socket.on("table:update", (data) => setTable(data));
}, [socket]);

// After
useEffect(() => {
  const handleUpdate = (data) => setTable(data);
  socket.on("table:update", handleUpdate);
  return () => socket.off("table:update", handleUpdate);
}, [socket]);
```

**Fix for inline function (can't `.off` it):**
Extract to a named `const` inside the effect before the `.on` call.

### 4. Report

- ✅ `filename.jsx` — all socket handlers have cleanup
- 🔧 `filename.jsx` — fixed N handlers: [event names]
- ⏭️ `filename.jsx` — uses full socket teardown (correct pattern), skipped
