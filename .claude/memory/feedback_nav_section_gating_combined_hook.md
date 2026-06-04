---
name: feedback_nav_section_gating_combined_hook
description: "Las superficies de nav/shell que gatean por sección deben usar useSectionEnabled() (global + override por comunidad), no useSiteConfig.isSectionEnabled directo"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e4c1efe1-758f-434c-91c0-8b40b9b821f2
---

Desde 2026-06-04: todo componente del shell/nav que oculte ítems por sección debe usar el hook combinado `useSectionEnabled()` (de `client/src/hooks/useSectionEnabled.js`), NUNCA `useSiteConfig().isSectionEnabled` a secas.

**Why:** `useSiteConfig().isSectionEnabled` solo mira el flag GLOBAL de `SiteConfig`. `useSectionEnabled()` combina ese global CON el override por comunidad-skin (`CommunityContext.isSectionEnabledInSkin`) — y el admin efectivo bypassa. El guard de rutas `<SectionGate>` ya usa el combinado. Si la nav usa solo el global, en un subdominio de comunidad (modo tenant) muestra el set de secciones GLOBAL en vez del de la comunidad, y queda inconsistente con `SectionGate` (mostraba un link que al clickear redirigía/ocultaba). Afecta a miembros y no-miembros por igual. Semántica restrictiva-only: una comunidad puede OCULTAR una sección globalmente prendida, no PRENDER una globalmente apagada.

**How to apply:**

- En el componente: `const isSectionEnabled = useSectionEnabled();` y usar `isSectionEnabled(key)` igual que antes (misma firma `(key) => bool`).
- Surfaces ya migradas: `Sidebar`, `GuestSidebar`, `Navbar`, `ChatLauncher`, `ColaborarFab`. Al sumar una nueva, copiá el patrón.
- En tests: dejá correr el hook real mockeando los 3 contextos que consume (`useSiteConfig`, `useCommunity` con `isSectionEnabledInSkin`, `useAuth`) en vez de mockear `useSectionEnabled` — así un revert a global-only rompe el test. Cada surface tiene un regression test "sección apagada por la comunidad se oculta aunque esté global ON".

Relacionado: [[project_community_subdomains]], [[feedback_panel_admin_toggles]], [[feedback_notifications_tenant_scoping]].
