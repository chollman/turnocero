---
name: reference-dev-scripts
description: "Scripts npm disponibles a nivel root en Turnocero — incluye `npm run dev` (concurrently) que la CLAUDE.md no menciona"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 00e5fcaf-acf3-4658-9706-9653f00b2185
---

Scripts en el `package.json` root:

- `npm run install:all` — instala server y client.
- `npm run dev` — corre **ambos en paralelo** con `concurrently` (prefijos `server,client` con colores). **No mencionado en CLAUDE.md.**
- `npm run dev:server` — solo Express :4000 (nodemon).
- `npm run dev:client` — solo Vite :3000.
- `npm run start:server` — `npm start` en `server/`.

**Why:** CLAUDE.md solo documenta `dev:server` + `dev:client` en terminales separadas, lo que llevó a afirmar que `npm run dev` no existía. Existe y es la forma más rápida cuando se acepta tener ambos logs mezclados en una sola terminal.

**How to apply:** cuando el usuario pregunte cómo levantar el dev environment, mencionar `npm run dev` como opción primaria (1 terminal, ambos procesos) y `dev:server` / `dev:client` como alternativa (2 terminales, logs separados). Si la pregunta es sobre worktrees, recordar que `node_modules` y `.env` no se comparten.
