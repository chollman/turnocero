---
name: reference-vscode-eslint
description: How to wire up the VSCode ESLint extension so client/ lint errors show in the Problems tab (recreate per machine since .vscode/ is gitignored)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2fdbad78-c716-4c1d-a6df-46ed1a8de431
---

The ESLint flat config lives at `client/eslint.config.js`, not at the repo root. Without a `.vscode/settings.json` pointing the ESLint extension at `./client`, the Problems tab shows nothing for `.jsx` files.

**Why:** `.vscode/` is in `.gitignore` (treated as per-machine editor preference), so this setup must be recreated on every machine. Set up 2026-05-16.

**How to apply (per machine):**

1. Install the **ESLint** extension (`dbaeumer.vscode-eslint`).
2. Create `.vscode/settings.json` with:
   ```json
   {
     "eslint.workingDirectories": [
       { "directory": "./client", "changeProcessCWD": true }
     ],
     "eslint.useFlatConfig": true,
     "eslint.validate": ["javascript", "javascriptreact"],
     "eslint.run": "onType"
   }
   ```
3. Optionally add `.vscode/extensions.json` recommending the extension:
   ```json
   { "recommendations": ["dbaeumer.vscode-eslint"] }
   ```
4. Reload window (`Ctrl+Shift+P` → "Developer: Reload Window").

`server/` has no ESLint config — only `client/` files will show problems. This is expected.

If problems still don't show, open the "Output" panel and select "ESLint" in the dropdown to see config-load errors.
