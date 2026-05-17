---
name: feedback-no-worktrees
description: "User doesn't want to work in Claude Code worktrees — prefers working directly in the main repo at ~/Projects/turnocero/"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 00e5fcaf-acf3-4658-9706-9653f00b2185
---

**Preferencia explícita** (2026-05-17): el usuario no quiere que trabaje en worktrees de Claude Code (`.claude/worktrees/<algo>`).

**Why:** generaron fricción real durante la sesión:
- No puede abrir otra terminal fácilmente para correr `npm run dev` mientras chatea con Claude.
- `.env` y `node_modules` no se comparten → setup duplicado por worktree.
- Rebases con `master` (cuando trabaja en paralelo otra sesión) llevan a conflictos en archivos compartidos (especialmente plans).
- Después de mergear el PR, hay que volver a sincronizar manualmente.

**How to apply:**
- Trabajar directamente en el repo principal (`~/Projects/turnocero/`).
- Si el usuario me hace arrancar adentro de un worktree existente, ofrecerle salir o preguntarle si prefiere reiniciar en el repo principal.
- No proponer `git worktree add ...` para features nuevas.
- Para evitar pisar trabajo en curso del usuario en `master`, crear branches normales con `git checkout -b feature/...` y commitear ahí — sin necesidad de worktree separado.
- Si el usuario quiere correr el dev server en background, usar la herramienta de Bash con `run_in_background: true` desde el repo principal, no requerir terminales separadas.
