Audit all React files in `client/src/` for stale state on logout — state loaded from the server based on the authenticated user that is NOT cleared when the user logs out. Fix every issue found.

## Background

The bug: a component fetches user-specific data into local state (`useState`) but never resets that state when `user` becomes `null` (logout). When a new user logs in in the same tab, they briefly see the previous user's data until the next fetch completes.

**Known-good pattern (required in always-mounted components and contexts):**

```js
useEffect(() => {
  if (!user) {
    setMyState(initialValue); // ← reset on logout
    return;
  }
  axios.get("/api/...").then(({ data }) => setMyState(data));
}, [user]);
```

**Bug pattern (missing reset):**

```js
useEffect(() => {
  if (!user) return; // ← bails but does NOT clear stale state
  axios.get("/api/...").then(({ data }) => setMyState(data));
}, [user]);
```

**localStorage bug pattern:**

```js
const [items, setItems] = useState(loadFromStorage); // ← initializes from previous session
// ...no clear on logout → new user sees old user's cached data
```

## Steps

### 1. Classify components by risk

Identify which components are **always mounted** (high risk) vs **route-level** (low risk, naturally reset on unmount):

- **Always mounted** = contexts (`context/`), shell components (`components/layout/`), and any component rendered unconditionally in `App.jsx`
- **Route-level** = pages (`pages/`), skipped unless they also use `localStorage` initialization

### 2. Scan for the bug patterns

Grep `client/src/` for files matching ALL of these criteria simultaneously:

**a)** Has `useState` holding data that could be user-specific (arrays of items, objects with user data — not pure UI state like `isOpen`, `loading`, `error`)  
**b)** Has a `useEffect` that either:

- Depends on `[user]` or `[currentUser]` AND contains `if (!user) return` (without also calling a setter to clear state)
- Has `[]` as deps AND calls a protected API endpoint (like `/api/tables/mine`, `/api/dm`, `/api/notifications`)  
  **c)** OR uses `useState(loadFromStorage)` / `useState(() => JSON.parse(localStorage...))` in a component that is always mounted

Focus areas to check in this order:

1. `client/src/context/` — all context providers
2. `client/src/components/layout/` — all layout/shell components
3. `client/src/components/chat/` — chat components
4. `client/src/pages/compartidas/` — especially `CompartidasSidebar.jsx`

### 3. For each flagged file, verify the fix status

Read the file and check:

- Does EVERY `useEffect([..., user, ...])` clear relevant state when `user` is null?
- Does EVERY `useEffect(fn, [])` that calls a user-authenticated endpoint depend on `user` instead?
- Does any `useState(loadFromStorage)` reset the localStorage key when user logs out?

**Already-fixed examples** (do NOT flag these):

- `ChatContext.jsx`: clears `conversations`, `openOrder`, `loadedRef` on `!user`
- `ChatLauncher.jsx`: `fetchFriends` calls `setFriends([])` when `!user`
- `NotificationContext.jsx`: clears `notifications`, `toasts`, `adminChatUnread` on `!user`
- `CompartidasSidebar.jsx`: clears `tables` on `!user`, depends on `[user]`

### 4. Fix every unfixed instance

Apply the fix directly — do not just report it:

**Fix type A — missing null branch in `useEffect([user])`:**

```js
// Before
useEffect(() => {
  if (!user) return;
  axios.get(...).then(({ data }) => setFoo(data));
}, [user]);

// After
useEffect(() => {
  if (!user) {
    setFoo([]); // or null / '' / {} depending on initial value
    return;
  }
  axios.get(...).then(({ data }) => setFoo(data));
}, [user]);
```

**Fix type B — `useEffect([])` fetching user data:**

```js
// Before
useEffect(() => {
  axios.get('/api/user-specific-endpoint').then(...);
}, []);

// After — add user import + dependency
const { user } = useAuth();
useEffect(() => {
  if (!user) { setFoo([]); return; }
  axios.get('/api/user-specific-endpoint').then(...);
}, [user]);
```

**Fix type C — localStorage initialization in always-mounted component:**
Ensure the reset effect writes empty state to localStorage on logout so the next session starts clean. The `useEffect([state])` sync already handles this automatically if the state is reset to `[]` in the logout branch.

### 5. Verify

After all fixes:

- Re-read each changed file to confirm the pattern is correct
- Ensure no new `useEffect` dependency warnings would be introduced (added state variables to deps if needed)

### 6. Report

List every file checked with one of:

- ✅ `filename.jsx` — already correct
- 🔧 `filename.jsx` — fixed: [one-line description of what was wrong]
- ⏭️ `filename.jsx` — skipped (route-level page, no localStorage, low risk)
