# ESLint setup, conventions y gotchas

Fecha: 2026-06-08. Config: `eslint.shared.cjs` (raíz) extendido por `client/eslint.config.js` y `server/eslint.config.js`. Comandos: `npm run lint` / `lint:fix` en cada workspace (`client/` corre `eslint src`, `server/` corre `eslint .`). No hay script de lint en la raíz — hay que entrar a cada workspace.

## `no-warning-comments` usa `location: "start"`, NUNCA `"anywhere"`

El código está comentado en **español argentino**, donde **"todo"** = "all" y aparece por todos lados en los comentarios. Con `location: "anywhere"` (como estaba originalmente) la regla disparaba ~13 falsos positivos tratando cada "todo" español como un marcador `TODO` pendiente. La gente había ido tapándolos con `// eslint-disable-next-line no-warning-comments` esparcidos por el repo.

**Fix definitivo:** en `eslint.shared.cjs`, `no-warning-comments` quedó con `location: "start"` — solo marca markers reales al **inicio** de un comentario (`// TODO: ...`), no la palabra española a mitad de frase. Al cambiarlo, todos esos `eslint-disable` quedaron "unused" y se borraron (línea completa, no dejar líneas en blanco con whitespace huérfano).

- **NO volver a poner `location: "anywhere"`.**
- **NO agregar `// eslint-disable-next-line no-warning-comments`** para silenciar un "todo" español — ya no hace falta.
- Si un comentario español **empieza** con "Todo ..." y dispara la regla, reformularlo (que no arranque con esa palabra), no agregar un disable.
- Quedan 2 disables legítimos (en `client/src/pages/colabora/Colaborar.jsx` y `server/routes/auth.js`) que tapan markers reales al inicio — esos se quedan.

## Reglas compartidas relevantes (warnings/errors comunes)

De `eslint.shared.cjs`: `no-unused-vars` (warn, ignora `^_` y `caughtErrors: "none"`), `no-useless-assignment` (no asignar un valor que se reescribe antes de leerse — ej. `let x = []` cuando todas las ramas lo reasignan → poner `let x;`), `no-promise-executor-return` (error — `new Promise((r) => setTimeout(r, 400))` falla porque el arrow retorna el timer id; envolver en bloque: `new Promise((r) => { setTimeout(r, 400); })`), `prefer-const`, `eqeqeq` smart, `no-duplicate-imports`, `no-var`.

En tests **vitest** importar explícitamente los globals que se usan (`afterEach`, `beforeEach`, etc.) o salta `no-undef` — no hay globals automáticos configurados.

## Gotcha de shell (Bash tool = zsh)

El Bash tool corre **zsh**, que **NO hace word-splitting** de variables sin comillar. `FILES="a b c"; git checkout $FILES` pasa `"a b c"` como UN solo pathspec y falla. Listar los archivos directos en el comando, o usar arrays, no `$VAR` desnuda esperando split.
