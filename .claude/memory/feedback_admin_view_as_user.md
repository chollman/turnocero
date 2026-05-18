---
name: feedback-admin-view-as-user
description: "When working with admin-exclusive features, always account for the admin \"view as user\" mode — the server still trusts the admin JWT, so the client must mirror non-admin behavior"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c105802a-014b-47dd-b456-9527cfc0eaa0
---

Cuando se implementa o se toca cualquier funcionalidad exclusiva de admins, tener en cuenta el modo "ver como usuario común" (`viewAsUser` en `AuthContext`).

**Why:** El toggle `viewAsUser` es puramente frontend. El JWT enviado al backend sigue siendo el del admin, así que el servidor le devuelve datos privilegiados (usuarios baneados, campos extra como `isBanned`/`bannedReason`, etc.). Si el cliente no filtra/oculta esos datos según el `isAdmin` efectivo, la "vista de usuario común" muestra contenido que un no-admin nunca vería. Esto rompe la idea misma del toggle (probar la UX real de un usuario común) y puede confundir al admin durante QA.

**How to apply:**
- En `AuthContext`, `user.isAdmin` es el **efectivo** (ya viene en `false` cuando `viewAsUser` está activo). `isActuallyAdmin` es el real. Usar el efectivo (`currentUser.isAdmin`) para decidir qué ver en la UI.
- En listados, derivar la versión visible filtrando los registros admin-only (ej: baneados) cuando `!isAdmin`. Hacerlo en render/`useMemo`, no en el fetch, para que el toggle funcione sin refetch.
- En páginas de detalle (`/usuarios/:id`, etc.), considerar también redirigir o mostrar 404 si el recurso solo debería ser visible para admins reales.
- Acciones admin (botones banear/eliminar, panels de moderación, links a `/base-de-datos`, etc.) ya se ocultan correctamente porque dependen del `isAdmin` efectivo — pero verificar caso por caso.
- Cuidado con contadores y badges: usar la lista filtrada, no la cruda, para que el conteo coincida con lo que se ve.

**Excepción: páginas estructurales del admin (Panel admin, Base de datos, Chat admin)**
Estas tres tienen que estar siempre accesibles a admins reales, sin importar el estado de `viewAsUser`. Si dependieran del `isAdmin` efectivo, activar view-as-user te dejaría sin forma de salir del modo o tocar la config global. Para esos casos:
- El `AdminRoute` en `App.jsx` usa `isActuallyAdmin`, no `user.isAdmin`.
- Los component-level guards en `PanelAdmin`, `DatabaseViewer` y `AdminChat` también chequean `isActuallyAdmin`.
- En `Sidebar`/`BottomNav`, los items con `adminOnly: true` (no los que tienen `section:`) filtran por `isActuallyAdmin`.

La regla general: **secciones de contenido** (Mesas, Torneos, Mi feed, etc., toggleables desde el Panel admin) respetan view-as-user; **secciones estructurales del admin** (las 3 de arriba más el toggle FAB) lo ignoran.
