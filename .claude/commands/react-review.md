Review all modified React files in `client/src/` for best practices issues and fix them.

## Steps

1. Run `git diff --name-only HEAD` to find modified files. If no uncommitted changes, use `git diff --name-only HEAD~1 HEAD` to get the last commit.
2. Filter for files under `client/src/` with `.jsx` or `.js` extension.
3. Run `npm run lint` from `client/` and note any ESLint errors or warnings.
4. Read each modified React file and review for the following issues:

### What to check

**Hooks**
- `useEffect` with missing or incorrect dependencies (stale closures)
- Event listeners / timers / subscriptions added in an effect without cleanup (`return () => ...`)
- Two separate `useEffect` hooks that could cause a double-fetch or redundant run on mount — consolidate into one with a cancellation flag when fetching data
- `useState` initialized from a prop that never updates when the prop changes

**Components**
- Identical JSX blocks repeated across two or more files — extract a shared component
- Handler functions doing the same thing with minor variation — merge with a parameter
- Inline styles that belong in the CSS module

**Ordering / structure**
- `const` component or helper defined *after* the line where it is first referenced (temporal dead zone)

**Resources**
- `setTimeout` / `setInterval` stored without cleanup on unmount
- Axios requests that are not cancelled when the component unmounts (add a `cancelled` flag)

5. For each real issue found, apply the fix directly. Do **not** add speculative changes.
6. After all fixes, re-run `npm run lint` from `client/` and confirm it exits clean.
7. Report a concise summary: list of files changed, one line per fix applied.
