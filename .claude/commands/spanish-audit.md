Scan user-facing text for English and replace it with Argentine Spanish — both the JSX/JS in `client/src/` and the **server messages that reach the user** (the `message` strings in `httpError(...)` / `res.json({ message })` that the client renders via `getErrorMessage`).

## Background

All user-facing text in Turnocero must be in Argentine Spanish (voseo: "vos tenés", "iniciá", "agregá"). Any English string that ends up in the rendered UI is a bug — whether in button labels, placeholders, empty states, error messages, or headings.

This includes **server-side messages that reach the user**. The API returns errors as `{ message: '<string>' }` (see CLAUDE.md → "Server error format"), and the client surfaces that text through `getErrorMessage` into `setError(...)` / toasts. So an English `throw httpError(401, 'Invalid credentials')` in a route is just as much a bug as an English `<button>` label — the user reads both. The server still logs and comments in English; only the strings the client _displays_ are in scope.

**In scope (must be Spanish):**

- Visible text inside JSX: `<p>No tables found</p>`, `<button>Submit</button>`
- `placeholder="Search..."` attributes
- `aria-label="Close"` and `title="..."` attributes that users read
- Error/success strings passed to state: `setError('User not found')`
- Toast/notification messages
- **Server messages returned to the client and rendered by the UI**: the `message` in `throw httpError(4xx, '...')`, `res.json({ message: '...' })`, `res.status(4xx).json({ message })`, and any other body field the client displays (e.g. a `bannedReason`). These live in `server/routes/**`, `server/services/**`, `server/middleware/**`, and notification/email builders under `server/utils/**`.

**Out of scope (English is correct):**

- `className`, `type`, `id`, `name`, `key`, `href`, `src`, `alt` when it's a technical identifier
- CSS module class names
- Console logs and comments (including `logger.info/warn/error(...)` on the server)
- API route strings (`'/api/tables'`)
- Variable names and function names
- File imports
- **Server strings the user never sees**: developer guards like `throw new Error('useX must be used within Provider')`, generic internal 500 messages that the errorHandler masks, machine-readable `code` discriminators (`code: 'email_not_verified'` — the `message` beside it is in scope, the `code` is not), and status-only responses with no `message` body. When unsure whether a server string reaches the UI, trace it: a 4xx `httpError` message or a `res.json({ message })` a client catch surfaces → in scope; a log line, an internal throw, or a status-only response → out.

## Steps

### 1. Find candidate files

Run `git diff --name-only HEAD` to get modified files, then filter for **both**:

- `client/src/**/*.{jsx,js}`, and
- server files that can hold user-facing messages: `server/{routes,services,middleware}/**/*.js` plus notification/email builders under `server/utils/**/*.js`.

If no uncommitted changes, use `git diff --name-only HEAD~1 HEAD`. Also include context files and any file that was flagged in previous runs.

If the user invokes this without recent changes, scan ALL `client/src/**/*.{jsx,js}` files plus the server route/service/middleware files above.

### 2. Search for English patterns in each file

In each file, look for:

**a) Hardcoded English strings in JSX text nodes:**

- Any JSX content matching common English words: `No`, `Yes`, `Cancel`, `Submit`, `Save`, `Delete`, `Edit`, `Create`, `Loading`, `Error`, `Success`, `Search`, `Close`, `Open`, `Back`, `Next`, `View`, `Add`, `Remove`, `Send`, `Accept`, `Reject`, `Confirm`, `New`, `All`, `None`, `Empty`, `More`, `Less`
- Full sentences or phrases that are clearly English

**b) English placeholder attributes:** `placeholder="Search..."`, `placeholder="Enter name"`

**c) English aria-label / title:** `aria-label="Close"`, `title="Settings"`

**d) English error strings:** `setError('...')`, `throw new Error('...')` where the message is user-visible (passed to the UI, not just console)

**e) English empty state text:** strings shown when lists are empty, like `'No results found'`, `'Nothing here yet'`

**f) English server messages that reach the user (in the server files from step 1):**

- `throw httpError(4xx, 'Invalid credentials')` — the `message` is returned as `{ message }` and rendered by the client.
- `res.json({ message: '...' })` / `res.status(4xx).json({ message: '...' })`, including control-flow responses like `res.status(403).json({ code, message })` (translate the `message`, leave the `code`).
- Other body fields the UI shows verbatim (e.g. a `bannedReason`).
- Notification/email copy built server-side and shown in-app.

Skip `logger.*` calls, comments, internal `throw new Error(...)` guards, and generic 500s — see "Out of scope".

### 3. For each English string found, apply the Argentine Spanish equivalent

Use voseo (vos/tenés/podés) and common Argentine expressions. Examples:

| English                   | Argentine Spanish        |
| ------------------------- | ------------------------ |
| No results                | Sin resultados           |
| No items yet              | Todavía no hay elementos |
| Search...                 | Buscar...                |
| Cancel                    | Cancelar                 |
| Save changes              | Guardar cambios          |
| Delete                    | Eliminar                 |
| Edit                      | Editar                   |
| Create                    | Crear                    |
| Loading...                | Cargando...              |
| Something went wrong      | Ocurrió un error         |
| Close                     | Cerrar                   |
| Back                      | Volver                   |
| Submit                    | Enviar                   |
| Accept                    | Aceptar                  |
| Reject                    | Rechazar                 |
| Send                      | Enviar                   |
| Add                       | Agregar                  |
| Remove                    | Quitar                   |
| View all                  | Ver todos                |
| No friends yet            | No tenés amigos aún      |
| You don't have permission | No tenés permiso         |
| Page not found            | Página no encontrada     |
| Invalid credentials       | Usuario o contraseña incorrectos |
| Username already in use   | Ese nombre de usuario ya está en uso |
| All fields are required   | Completá todos los campos |
| User not found            | Usuario no encontrado    |

Match the tone and style of existing Spanish strings in the same file (the server messages should read like the existing Spanish ones, e.g. "Tenés que verificar tu email antes de iniciar sesión.").

### 4. Verify no regressions

After edits, re-read each changed file and confirm no English user-facing strings remain.

When you translate a **server** message that a test asserts on (e.g. `expect(res.body.message).toMatch(/already in use/i)` or `.toBe('...')`), update that assertion in the same pass so the suite stays green. Run the affected `server` tests to confirm.

### 5. Report

- ✅ `filename.jsx` / `route.js` — all Spanish, no changes needed
- 🔧 `filename.jsx` / `route.js` — fixed N strings: [brief list of what was changed]

Group the report by side (client vs server) when both were touched, and call out any test assertions you updated alongside a server message.
