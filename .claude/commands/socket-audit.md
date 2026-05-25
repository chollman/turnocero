Audit all Socket.IO events in the app — verify that every event emitted by the server has complete handling on the client side (NotificationContext, ChatContext, ToastContainer), and that no client handler references an event the server never emits.

## Background

The server emits events via `io.to(...).emit(eventName, payload)`. The client handles them in up to three places:

- `NotificationContext.jsx` — `socket.on(eventName, ...)` registers the handler and pushes to `notifications` / `toasts`
- `ChatContext.jsx` — handles `dm:message`
- `ToastContainer.jsx` — renders the toast UI for each `toast.type`
- `Notifications.jsx` — renders the persistent notification UI via `getNotifMeta`

A missing handler in any of these means silent data loss or broken UI.

## Steps

### 1. Collect all server-emitted events

Grep `server/` for all `io.to(` and `socket.emit(` and `.emit(` calls. For each, extract:

- Event name (string)
- Payload shape (fields sent)
- Which file/route emits it

Build a table:

| Event name        | Payload fields                 | Emitted from               |
| ----------------- | ------------------------------ | -------------------------- |
| `chat:message`    | `{ ... }`                      | `server/routes/tables.js`  |
| `friend:accepted` | `{ fromUserId, fromUsername }` | `server/routes/friends.js` |
| etc.              |                                |                            |

### 2. Collect all client-side socket handlers

Read these files:

- `client/src/context/NotificationContext.jsx` — list every `socket.on('eventName', ...)` and the state it updates
- `client/src/context/ChatContext.jsx` — list every DM-related handler

For each handler, note which fields from the payload it actually uses.

### 3. Collect all toast types handled

Read `client/src/components/layout/ToastContainer.jsx`:

- List every `toast.type === '...'` condition in the `icon`, `title`, and `body` blocks

Read `client/src/pages/notifications/Notifications.jsx`:

- List every `case '...'` (or condition) in `getNotifMeta`

### 4. Cross-reference — find gaps

For each server-emitted event:

**a) Missing socket.on handler** — event is emitted by server but no `socket.on` in NotificationContext or ChatContext  
**b) Missing toast icon** — `toast.type` has no matching condition → shows wrong icon  
**c) Missing toast title** — falls through to a default using fields not present in this payload → shows `undefined`  
**d) Missing toast body** — same as above  
**e) Missing getNotifMeta case** — notification stored in DB but Notifications.jsx shows wrong label/preview  
**f) Payload field mismatch** — handler uses `notif.foo` but server sends `notif.bar`

Also check the reverse: client handles events that the server never emits (dead code).

### 5. Fix every gap

For each gap found, apply the fix directly:

- Add missing `socket.on` handler with correct payload destructuring
- Add missing toast conditions for `icon`, `title`, `body` — use Argentine Spanish for all user-facing strings
- Add missing `getNotifMeta` case — match style of existing cases
- Fix field name mismatches

When adding toast/notification handling, use the actual payload fields confirmed in step 1 — do not guess.

### 6. Report

List each event with:

- ✅ `event:name` — fully handled (socket + toast + notification page)
- 🔧 `event:name` — fixed: [what was missing]
- ⚠️ `event:name` — dead handler on client, server never emits this
