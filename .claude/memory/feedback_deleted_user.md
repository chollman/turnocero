---
name: feedback-deleted-user
description: "Hard-deleted users surface as \"Usuario eliminado\" with ghost icon — use UserRef and getUserDisplay everywhere a populated user ref is shown"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2fdbad78-c716-4c1d-a6df-46ed1a8de431
---

Deleted users are hard-deleted (no soft-delete flag, no tombstone). References to them in scalar fields (`host`, `author`, `sender`, `rater`, comment `author`, `images.uploader`, etc.) become `null` after `.populate()`. They must render as **"Usuario eliminado"** with a ghost icon — never crash, never show `undefined`, never link to a profile.

**Why:** The user explicitly chose hard delete (so usernames/emails free up for re-registration) plus a "Usuario eliminado" + icon fallback (not soft-delete, not cascade). Implemented 2026-05-16.

**How to apply:**

1. **Server**: when adding a new Mongoose model with a `ref: 'User'` field, always `.populate(field, 'username displayName avatar nombre apellido')` so the fallback helper has fields to work with. When adding a new admin route that touches users, follow the patterns in `server/routes/admin.js`:
   - reject self-target → 400 "No podés [X] a vos mismo"
   - reject admin-target → 400 "No podés [X] a otro admin"
   - on user delete, `$pull` the user from any array fields you introduce (similar to existing `players`, `pendingRequests`, `followers`, `reactions`, `friends`, `friendRequests`)

2. **Client**: any new UI that renders a user from a populated ref must use the shared primitives — never access `user.displayName` / `user.username` directly:
   - `client/src/utils/userDisplay.js` — `getUserDisplay(user)` returns `{ name, isDeleted, _id, username, avatar }`
   - `client/src/components/shared/UserRef.jsx` — `<UserRef user={x} />` renders link-or-ghost; also exports `GhostIcon` for avatar placeholders
   - For avatars (initial-letter circles), use a `GhostIcon` fallback when `isDeleted`

3. **Don't** assume populated refs are non-null. Even pre-existing code that "always had a host" can encounter `null` after a delete. When editing such code for any reason, defensively guard with `?.` and route through the helpers.

Related: [[project_features]] (admin moderation section). The 403 `code: 'banned'` ban expulsion is a separate concern — banning doesn't null out refs.
