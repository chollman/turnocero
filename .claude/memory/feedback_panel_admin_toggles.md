---
name: feedback-panel-admin-toggles
description: "When adding a new section or cross-cutting feature, plumb it through the Panel admin (SiteConfig) so the admin can toggle it on/off for regular users"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c105802a-014b-47dd-b456-9527cfc0eaa0
---

Cuando agregamos una **nueva sección** del sitio (rutas propias en el sidebar/bottomnav, su set de endpoints, sus notificaciones) o una **funcionalidad nueva que cruza secciones** (widgets que aparecen en otras pantallas, banners, integraciones tipo BG Watch), tiene que pasar también por el Panel admin (`/panel-admin`) — el toggle, sus gates server-side y los guards client-side.

**Why:** El Panel admin es la única fuente de verdad para decidir qué ve el usuario común. Si una sección nueva queda fuera, el admin no tiene cómo apagarla sin tocar código y se rompe el modelo mental de "todo se controla desde acá". Tampoco quiero descubrir meses después que un widget cruzado quedó visible cuando la sección dueña está OFF (caso real: linkedTable de Compartidas que apuntaba a Mesas cuando Mesas estaba OFF para usuarios comunes).

**How to apply:**

Para una **sección nueva** (ej: agregás `/foros`):
1. Agregar la key en `server/models/SiteConfig.js` (`SECTION_KEYS` + `DEFAULT_ENABLED` si arranca en OFF).
2. Mismo cambio en `client/src/context/SiteConfigContext.jsx` (mantener las listas en sync).
3. Aplicar `router.use(requireSection('foros'))` arriba del nuevo router en `server/routes/foros.js`.
4. Envolver las rutas en `App.jsx` con `<SectionGate section="foros">`.
5. Agregar el item al `NAV` de `Sidebar.jsx` y al `REGULAR_NAV`/`ADMIN_NAV` de `BottomNav.jsx`, con `section: 'foros'` (no `adminOnly`, salvo que sea estructural admin).
6. Agregar la entrada en `SECTION_META` de `PanelAdmin.jsx` (grupo + descripción + side-effects).
7. Si emite notificaciones, agregar el tipo en `TYPE_TO_SECTION` de `server/utils/saveNotification.js` y en `EVENT_SECTION` de `NotificationContext.jsx`.
8. Probar en QA matrix: anon, user, admin, admin con view-as-user.

Para una **funcionalidad cruzada** (ej: un nuevo widget de mesa dentro de Eventos):
1. Identificar la sección "dueña" de los datos (en el ejemplo: `mesas`).
2. En el call site, envolver con `const mesasEnabled = isSectionEnabled('mesas')` y renderizar condicional.
3. No requiere cambios en `SECTION_KEYS` — la sección dueña ya existe.
4. Mencionar el nuevo widget en la lista `affects` de `SECTION_META` del Panel admin para que el admin sepa qué se oculta al apagar la sección dueña.

**Cuándo NO toggleizar:** features estructurales del admin (Panel admin, Base de datos, Chat admin) no son toggleables — ver [[feedback-admin-view-as-user]].
