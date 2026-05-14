Scan all JSX and JS files in `client/src/` for English text in user-facing UI and replace it with Argentine Spanish.

## Background

All user-facing text in Turnocero must be in Argentine Spanish (voseo: "vos tenés", "iniciá", "agregá"). Any English string that ends up in the rendered UI is a bug — whether in button labels, placeholders, empty states, error messages, or headings.

**In scope (must be Spanish):**
- Visible text inside JSX: `<p>No tables found</p>`, `<button>Submit</button>`
- `placeholder="Search..."` attributes
- `aria-label="Close"` and `title="..."` attributes that users read
- Error/success strings passed to state: `setError('User not found')`
- Toast/notification messages

**Out of scope (English is correct):**
- `className`, `type`, `id`, `name`, `key`, `href`, `src`, `alt` when it's a technical identifier
- CSS module class names
- Console logs and comments
- API route strings (`'/api/tables'`)
- Variable names and function names
- File imports

## Steps

### 1. Find candidate files

Run `git diff --name-only HEAD` to get modified files, then filter for `client/src/**/*.{jsx,js}`. If no uncommitted changes, use `git diff --name-only HEAD~1 HEAD`. Also include context files and any file that was flagged in previous runs.

If the user invokes this without recent changes, scan ALL `client/src/**/*.{jsx,js}` files.

### 2. Search for English patterns in each file

In each file, look for:

**a) Hardcoded English strings in JSX text nodes:**
- Any JSX content matching common English words: `No`, `Yes`, `Cancel`, `Submit`, `Save`, `Delete`, `Edit`, `Create`, `Loading`, `Error`, `Success`, `Search`, `Close`, `Open`, `Back`, `Next`, `View`, `Add`, `Remove`, `Send`, `Accept`, `Reject`, `Confirm`, `New`, `All`, `None`, `Empty`, `More`, `Less`
- Full sentences or phrases that are clearly English

**b) English placeholder attributes:** `placeholder="Search..."`, `placeholder="Enter name"`

**c) English aria-label / title:** `aria-label="Close"`, `title="Settings"`

**d) English error strings:** `setError('...')`, `throw new Error('...')` where the message is user-visible (passed to the UI, not just console)

**e) English empty state text:** strings shown when lists are empty, like `'No results found'`, `'Nothing here yet'`

### 3. For each English string found, apply the Argentine Spanish equivalent

Use voseo (vos/tenés/podés) and common Argentine expressions. Examples:

| English | Argentine Spanish |
|---|---|
| No results | Sin resultados |
| No items yet | Todavía no hay elementos |
| Search... | Buscar... |
| Cancel | Cancelar |
| Save changes | Guardar cambios |
| Delete | Eliminar |
| Edit | Editar |
| Create | Crear |
| Loading... | Cargando... |
| Something went wrong | Ocurrió un error |
| Close | Cerrar |
| Back | Volver |
| Submit | Enviar |
| Accept | Aceptar |
| Reject | Rechazar |
| Send | Enviar |
| Add | Agregar |
| Remove | Quitar |
| View all | Ver todos |
| No friends yet | No tenés amigos aún |
| You don't have permission | No tenés permiso |
| Page not found | Página no encontrada |

Match the tone and style of existing Spanish strings in the same file.

### 4. Verify no regressions

After edits, re-read each changed file and confirm no English user-facing strings remain.

### 5. Report

- ✅ `filename.jsx` — all Spanish, no changes needed
- 🔧 `filename.jsx` — fixed N strings: [brief list of what was changed]
