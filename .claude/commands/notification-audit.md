Audit all notification types in the app and fix any that are missing proper display handling.

## Steps

1. **Collect server-side types** — grep `server/routes/` for all `saveNotification(` calls and `io.*emit(` calls. Extract the type string (second arg of `saveNotification`, or the event name mapped to its client type). Build a list like:

   | server event / saveNotification type | client type string |
   |---|---|
   | `saveNotification(..., 'chat', ...)` | `chat` |
   | `emit('join:request', ...)` | `join_request` |
   | etc. |

2. **Collect client-side handling** — read these two files:
   - `client/src/pages/notifications/Notifications.jsx` → find all `case '...'` branches in `getNotifMeta` (or all conditions if not a switch)
   - `client/src/context/NotificationContext.jsx` → find all `socket.on('...')` handlers and the notification object shape they push into state (what fields are set)
   - `client/src/components/layout/ToastContainer.jsx` → find all `toast.type === '...'` conditions for `icon`, `title`, and `body`/`subtitle`

3. **Cross-reference** — for each server-side type:
   - Is there a `case` (or condition) in `getNotifMeta`? If not → **gap**
   - Does `ToastContainer` handle its `icon`, `title`, and body? If any of those fall through to a default that uses fields the type doesn't carry (e.g. `lastSenderUsername` on a `friend_accepted` object) → **gap**

4. **For each gap found**, fix it:
   - In `getNotifMeta`: add the missing `case` with appropriate `icon`, `countLabel`, `preview`, and `chipClass`. Use the fields actually present in the notification object (from step 2). Use Argentine Spanish for all user-facing strings.
   - In `ToastContainer`: add the missing condition for `icon`, `title`, and body text. Match style of existing entries.

5. **Verify no `undefined`** — after fixes, check that no branch in `getNotifMeta` or `ToastContainer` references a field that isn't set by the corresponding `socket.on` handler. If a field could be missing, add a `?? ''` or `|| 'desconocido'` fallback.

6. Report a concise summary: list each type audited, mark ✅ already correct or 🔧 fixed, and describe what was changed.
