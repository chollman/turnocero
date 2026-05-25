# Panel Admin — Toggles de secciones

## Objetivo

Crear un panel admin que permita prender/apagar secciones del app (Mesas, Compartidas, Noticias, Torneos, Amigos, DMs, Admin Chat, BG Watch, Utilidades) para usuarios no-admin. Cuando una sección está OFF:

1. La ruta queda bloqueada (server 403 + client redirect) para no-admins.
2. Sidebar/BottomNav ocultan el link.
3. **Widgets cruzados** en otras secciones se ocultan (ej: si Mesas está OFF, el widget `linkedTable` dentro de `CompartidaCard` no se renderiza).
4. **Nuevas notificaciones** de esa sección no se crean/emiten.
5. Las notificaciones existentes en la DB se mantienen (no se migran).
6. Admins con `viewAsUser` OFF ven todo (ignorando toggles). Admins con `viewAsUser` ON ven **exactamente** lo mismo que un no-admin, incluyendo secciones OFF ocultas. Para volver al estado admin completo, usan el botón de toggle existente.

## Decisiones tomadas

- **Storage**: singleton `SiteConfig` en MongoDB.
- **Secciones toggleables**: `mesas`, `compartidas`, `noticias`, `torneos`, `eventos`, `comunidad`, `miFeed`, `amigos`, `dms`, `bgwatch`, `utilidades`.
- **NO toggleables (siempre admin-only intrínseco)**: Base de datos, Chat Admin, el propio Panel Admin.
- **Defaults** (preservan comportamiento actual hardcodeado): `mesas`, `torneos`, `miFeed` → `false`. Resto → `true`.
- **Notif legacy**: bloquear nuevas, dejar las viejas.
- **View as user**: SÍ respeta los toggles client-side. Admin con `viewAsUser` ON ve lo mismo que un no-admin. El gating server-side sigue tratando al admin como admin (igual que el patrón actual de view-as-user, que es filtrado client-side).

## Estado actual del código (relevante)

- Gating actual de "Mesas/Torneos/Mi Feed/DB admin-only" está **hardcoded** en `client/src/components/layout/Sidebar.jsx:227-242` (flag `adminOnly: true`) y `BottomNav.jsx:129-134` (array `ADMIN_NAV`). El server NO bloquea (`/api/tables` es público con `privacyFilter`).
- No existe modelo `SiteConfig` ni feature flags — todo es hardcode.
- `viewAsUser` ya existe en `AuthContext.jsx` (línea 27-37, 119) — flag local en `localStorage`.
- Widgets cruzados detectados:
  - `CompartidaCard.jsx:200-202` → `post.linkedTable` muestra mesa dentro de compartida.
  - `BgWatchHomeWidget.jsx` → widget de BG Watch en home (condicionado por `user.bggUsername`).
  - `UserProfilePublic.jsx:218,266` → `stats.compartidas`, `stats.favoriteGames`.
  - `Dashboard.jsx:69` → tabs de mesas (es la sección Mesas en sí).
  - `AddParticipantModal.jsx:26` (Torneos) → fetcha `/api/users`.
- Notificaciones por sección (modelo `Notification.js`):
  - **Mesas**: `chat`, `comment`, `image`, `join_request`, `join_accepted`, `join_rejected`, `spot_opened`, `table_cancelled`.
  - **Amigos**: `friend_request`, `friend_accepted`.
  - **DMs**: `dm`.
  - **Admin Chat**: `admin_chat`.
  - **Compartidas**: `compartida_comment`, `compartida_like`.
  - **Torneos**: `tournament_accepted`, `tournament_rejected`, `tournament_advanced`, `tournament_eliminated`, `tournament_started`, `tournament_finished`.

## Arquitectura propuesta

### Fuente de verdad: `SiteConfig` singleton

```js
// server/models/SiteConfig.js
{
  _id: 'singleton',  // siempre el mismo doc
  sections: {
    mesas:       { enabled: true },
    compartidas: { enabled: true },
    noticias:    { enabled: true },
    torneos:     { enabled: true },
    amigos:      { enabled: true },
    dms:         { enabled: true },
    adminChat:   { enabled: true },
    bgwatch:     { enabled: true },
    utilidades:  { enabled: true },
  },
  updatedAt, updatedBy
}
```

### Distribución

- **Server**: cache in-memory (`server/utils/siteConfig.js`), invalida en cada PATCH.
- **Cliente**: `SiteConfigContext` carga via `GET /api/site-config` al iniciar y escucha socket event `site-config:updated` para refrescar en vivo (cuando admin togglea, todos los clientes se enteran).
- **Endpoints**:
  - `GET /api/site-config` — público (necesario para que clientes anónimos sepan qué mostrar).
  - `PATCH /api/site-config` — admin only; emite `site-config:updated` global.

### Mapa sección → recursos afectados

| Sección       | Rutas server              | Notif types                                                  | Sockets                                                                                                                   | Widgets cliente                                                                                                                                                                          |
| ------------- | ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mesas`       | `/api/tables/*`           | chat, comment, image, join\_\*, spot_opened, table_cancelled | `chat:message`, `chat:notification`, `join:request`, `join:accepted`, `table:comment`, `table:image`, `table:spot-opened` | `CompartidaCard linkedTable`, Dashboard, MeFeed, TableDetail, CreateTable, EditTable                                                                                                     |
| `compartidas` | `/api/compartidas/*`      | compartida_comment, compartida_like                          | —                                                                                                                         | `CompartidasSidebar`, `CompartidaCard linkedTable's reverse`, stats en `UserProfilePublic`                                                                                               |
| `noticias`    | `/api/noticias/*`         | —                                                            | —                                                                                                                         | Noticias page                                                                                                                                                                            |
| `torneos`     | `/api/torneos/*`          | tournament\_\*                                               | `torneo:*`                                                                                                                | Torneos pages                                                                                                                                                                            |
| `amigos`      | `/api/friends/*`          | friend_request, friend_accepted                              | `friend:request`, `friend:accepted`                                                                                       | botones "Agregar amigo" en `UserProfilePublic`, lista en `/perfil`                                                                                                                       |
| `dms`         | `/api/dm/*`               | dm                                                           | `dm:message`                                                                                                              | ChatContext floating windows, `/mensajes`, `DirectChat`, link a chat desde perfiles                                                                                                      |
| `adminChat`   | `/api/admin-chat/*`       | admin_chat                                                   | `admin:message`                                                                                                           | (solo admins igual, pero por consistencia)                                                                                                                                               |
| `bgwatch`     | `/api/bgg/*` (read+write) | —                                                            | —                                                                                                                         | `BgWatchHomeWidget`, página `/bg-watch/:user`, badge BGG en perfil, banner BG Watch en perfil, link en `CompartidaCard` (autor con bggUsername), sección "Conexión con BGG" en `/perfil` |
| `utilidades`  | (sin endpoints)           | —                                                            | —                                                                                                                         | `/utilidades/dado`, `/utilidades/temporizador`, `/utilidades/selector-de-dedos`, links en Sidebar/BottomNav                                                                              |

## Plan de implementación

### Fase 1 — Foundation (storage + distribución)

1. **`server/models/SiteConfig.js`** — schema singleton con `sections`. Helper `getOrCreate()` que devuelve siempre el único doc.
2. **`server/utils/siteConfig.js`**:
   - `loadSiteConfig()` — lee de DB y guarda en módulo (cache).
   - `getSiteConfig()` — devuelve cache (sync, ya cargado al boot).
   - `updateSiteConfig(patch, userId)` — actualiza DB + cache + emite socket global.
   - `isSectionEnabled(name)` — helper sync.
   - Llamar `loadSiteConfig()` desde `server/index.js` al boot, antes de `app.listen`.
3. **`server/middleware/sectionGate.js`**:
   - `requireSection(name)` — middleware factory. Si `!isSectionEnabled(name) && !req.user?.isAdmin` → 403 `{ message: 'Sección deshabilitada' }`.
   - Para rutas que aceptan auth opcional (compartidas, noticias, torneos): chequea sin requerir auth.
4. **`server/routes/siteConfig.js`**:
   - `GET /api/site-config` — devuelve el doc actual (sin metadata sensible).
   - `PATCH /api/site-config` — `requireAdmin`. Body: `{ sections: { mesas: { enabled: false }, ... } }`. Valida claves contra whitelist. Emite `io.emit('site-config:updated', config)`.
5. **`client/src/context/SiteConfigContext.jsx`**:
   - Provider con `sections` state.
   - Carga inicial via `axios.get('/api/site-config')`.
   - Escucha `site-config:updated` en el socket (re-usar el socket del `NotificationContext` o crear uno propio). Probablemente más limpio: `SiteConfigContext` se suscribe a un evento global expuesto desde `NotificationContext`. **Decisión a tomar en implementación**: añadir `addSiteConfigListener` en `NotificationContext` (paralelo a `addDmListener`).
   - `isSectionEnabled(name)` — helper que considera el `user` **efectivo** (el que ya devuelve `AuthContext` aplicando `viewAsUser`, ver `AuthContext.jsx:119`). Por lo tanto:
     - Admin con `viewAsUser` OFF → `user.isAdmin === true` → siempre `true`.
     - Admin con `viewAsUser` ON → `user.isAdmin === false` (efectivo) → respeta el toggle de `SiteConfig`.
     - No-admin → respeta el toggle.
   - Esto significa que el helper se reduce a: `return sections[name]?.enabled || user?.isAdmin`.
6. **`App.jsx`**: envolver providers en orden `Theme → Auth → SiteConfig → Notification → Chat`. (SiteConfig necesita Auth para saber si es admin, pero NotificationContext es quien escucha sockets — habrá que decidir si SiteConfigContext crea su propio socket o pide listener al de Notification. **Recomendado**: dejarlo dentro de NotificationContext que ya maneja el socket, exponiendo `siteConfig` desde ahí o duplicando el socket — preferir lo segundo, separación de responsabilidades.)

### Fase 2 — Server gating (rutas)

> **Nota sobre view-as-user**: el server no conoce el flag `viewAsUser` (vive en `localStorage` y solo afecta el cliente). El middleware `requireSection` trata al admin como admin siempre. Esto es consistente con el patrón actual: view-as-user filtra client-side, no en el backend. Si un admin con view-as-user ON intenta acceder por URL directa a una sección OFF, el cliente lo redirige (via `<SectionGate>`) antes de hacer la request. Si bypasea el client (devtools, request manual), el server le responde como admin — aceptable.

Aplicar `requireSection(name)` antes de cualquier handler de cada sección:

- `server/routes/tables.js` → `router.use(requireSection('mesas'))`
- `server/routes/compartidas.js` → `requireSection('compartidas')`
- `server/routes/noticias.js` → `requireSection('noticias')`
- `server/routes/torneos.js` → `requireSection('torneos')`
- `server/routes/friends.js` → `requireSection('amigos')`
- `server/routes/dm.js` → `requireSection('dms')`
- `server/routes/adminChat.js` → `requireSection('adminChat')`
- `server/routes/bgg.js` → `requireSection('bgwatch')`

**Edge case**: la ruta pública `GET /api/compartidas/:id/og` (OG metadata para crawlers) debería seguir respondiendo, porque si la sección está OFF también está OFF para nuevos visitantes — está bien que devuelva 403/404. Lo mismo para `GET /api/compartidas/:id` con `optionalAuth`.

**Quitar el hardcode**: el array `NAV` en `Sidebar.jsx` y `ADMIN_NAV` en `BottomNav.jsx` siguen siendo útiles para ítems que son **siempre admin-only** (Mi Feed, Base de Datos, Chat Admin como página, futuro Panel Admin). Pero "Mesas" y "Torneos" pasan a controlarse por `SiteConfig` (no por `adminOnly` hardcoded).

### Fase 3 — Notification gating (server)

1. **`server/utils/saveNotification.js`**:
   - Mapa `TYPE_TO_SECTION` (constante en el archivo): `{ chat: 'mesas', comment: 'mesas', ..., dm: 'dms', friend_request: 'amigos', tournament_accepted: 'torneos', ... }`.
   - Antes de crear/upsertear: si `isSectionEnabled(section) === false` → return early sin crear nada.
   - Para tipos sin sección clara (si los hay), default a permitir.
2. **Socket emits en handlers de rutas**: la mayoría ya están detrás de `requireSection(...)` (que devuelve 403 antes de llegar al emit). Para los emits que disparan desde otros lugares (jobs, sockets cross-section), envolver con `isSectionEnabled(section)`.
3. **`addDmListener` en NotificationContext**: el cliente actual recibe `dm:message` aunque DMs esté OFF (porque el listener está siempre activo). Filtrar: si `!isSectionEnabled('dms')`, ignorar el evento. (Defense in depth — el server ya lo bloquea, pero por las dudas.)

### Fase 4 — Client gating (UI)

1. **`Sidebar.jsx` / `BottomNav.jsx`**:
   - Reescribir el filtro de items: para cada item asociado a una sección controlable, filtrar con `isSectionEnabled(section) || user?.isAdmin`.
   - Mantener `adminOnly: true` solo para Mi Feed, Base de Datos, Panel Admin (nuevo).
   - El BG Watch link sigue condicionado a `user.bggUsername` AND `isSectionEnabled('bgwatch')`.
2. **`App.jsx` routes**:
   - Crear componente `<SectionGate section="mesas">` que envuelve rutas: si sección OFF y no admin → redirect a `/` con toast "Sección no disponible".
   - Aplicar a las rutas listadas en el mapa.
3. **Widgets cruzados**:
   - `client/src/pages/compartidas/CompartidaCard.jsx:200-202` — ocultar bloque `linkedTable` si `!isSectionEnabled('mesas')`.
   - `client/src/pages/compartidas/CompartidaCard.jsx` — ocultar link "Ver BG Watch del autor" si `!isSectionEnabled('bgwatch')`.
   - `client/src/pages/compartidas/BgWatchHomeWidget.jsx` — ocultar si `!isSectionEnabled('bgwatch')`. (También revisar dónde se renderiza este widget.)
   - `client/src/pages/users/UserProfilePublic.jsx:218,266` — ocultar `stats.compartidas` (si `compartidas` OFF) y `stats.favoriteGames` (si depende de mesas/compartidas — revisar de dónde sale).
   - `client/src/pages/users/UserProfilePublic.jsx` — ocultar botón "Agregar amigo" si `!amigos`, ocultar botón "Enviar mensaje" si `!dms`.
   - `client/src/pages/users/UserProfile.jsx` — ocultar sección "Conexión BGG" si `!bgwatch`. Ocultar lista de amigos si `!amigos`.
   - `Dashboard.jsx` — si `mesas` OFF y no es admin, redirect (ya cubierto por SectionGate).
4. **Notificaciones en `/notificaciones`**:
   - No filtrar las viejas (decisión del usuario). Pero si una notificación es de tipo `dm` y la sección DMs está OFF, igual mostrarla (porque ya estaba ahí). El link "click → ir a /mensajes/:userId" puede fallar si la ruta está bloqueada — aceptable (caerá en redirect del SectionGate).
5. **Toast/Empty states**: cuando una sección está OFF, si un cliente conserva una URL vieja, mostrar página de "Sección no disponible" en lugar de un error feo.

### Fase 5 — Admin Panel UI

1. **Nueva página**: `client/src/pages/admin/PanelAdmin.jsx` en ruta `/panel-admin` (Spanish slug). Item nuevo en Sidebar/BottomNav con `adminOnly: true`. Icono: `Sliders` o `Settings`.
2. **Componente**: lista de secciones con `<Toggle>` por cada una. Para cada toggle:
   - Switch UI (re-usar el patrón de "Apariencia" en `/perfil` si existe).
   - Descripción de **qué pasa al apagar**: ruta bloqueada, widgets ocultos, notificaciones bloqueadas. Lista detallada de side-effects para evitar sorpresas al admin.
   - Confirm modal antes de apagar secciones grandes (Mesas, Torneos, Compartidas) — opcional.
3. **PATCH al togglear**: optimistic update + reconciliación con respuesta del server. Toast de confirmación.
4. **Mostrar quién/cuándo**: "Última actualización: <fecha> por <admin>".
5. **CSS Module**: `PanelAdmin.module.css` con tokens del sistema (recordar dark/light theme).

### Fase 6 — QA / matrix

Para cada sección, verificar manualmente con un user no-admin:

- [ ] Sidebar/BottomNav ocultan el link.
- [ ] Acceso directo a la URL → redirect/404 con mensaje claro.
- [ ] APIs devuelven 403.
- [ ] Widgets cruzados ocultos.
- [ ] No se crean nuevas notificaciones.
- [ ] Socket events de la sección no llegan al cliente (o son ignorados).
- [ ] Admin con view-as-user OFF sigue viendo todo (incluyendo secciones OFF).
- [ ] Admin con view-as-user ON ve **exactamente** lo que un no-admin: secciones OFF ocultas en sidebar, rutas redirigidas, widgets cruzados ocultos, notificaciones filtradas.
- [ ] Al apagar view-as-user, el admin recupera la vista completa sin recargar la página.
- [ ] Al togglear desde el panel, todos los clientes conectados reaccionan en vivo.

Cross-section específicos:

- [ ] Mesas OFF + Compartidas ON → `linkedTable` en CompartidaCard no aparece.
- [ ] BG Watch OFF + Compartidas ON → link al perfil BG Watch del autor no aparece.
- [ ] Amigos OFF + DMs ON → al intentar enviar DM sin amistad falla (el server ya lo bloquea por `friends only`); ¿tiene sentido permitir DMs sin amigos? Probablemente sí: si Amigos está OFF, no se pueden formar nuevas amistades pero las existentes siguen funcionando para DM. (Discutir si esto es lo deseado o si DM depende de Amigos.)

## Archivos críticos a tocar

### Nuevos

- `server/models/SiteConfig.js`
- `server/utils/siteConfig.js`
- `server/middleware/sectionGate.js`
- `server/routes/siteConfig.js`
- `client/src/context/SiteConfigContext.jsx`
- `client/src/components/shared/SectionGate.jsx`
- `client/src/pages/admin/PanelAdmin.jsx`
- `client/src/pages/admin/PanelAdmin.module.css`

### Modificados

- `server/index.js` — registrar nueva ruta, cargar config al boot, emitir socket al actualizar.
- `server/utils/saveNotification.js` — gating por sección.
- `server/routes/tables.js`, `compartidas.js`, `noticias.js`, `torneos.js`, `friends.js`, `dm.js`, `adminChat.js`, `bgg.js` — aplicar `requireSection`.
- `client/src/App.jsx` — provider + rutas envueltas en `<SectionGate>` + ruta `/panel-admin`.
- `client/src/context/NotificationContext.jsx` — escuchar `site-config:updated` (o exponer listener), filtrar DM si dms OFF.
- `client/src/components/layout/Sidebar.jsx` — reescribir filtro de NAV.
- `client/src/components/layout/BottomNav.jsx` — reescribir filtro.
- `client/src/pages/compartidas/CompartidaCard.jsx` — ocultar `linkedTable` y link BG Watch condicional.
- `client/src/pages/compartidas/BgWatchHomeWidget.jsx` — guard de sección.
- `client/src/pages/users/UserProfilePublic.jsx` — stats y botones cross-section.
- `client/src/pages/users/UserProfile.jsx` — sección BGG y lista de amigos.

## Decisiones pendientes (a discutir antes de implementar)

1. **Slug de la ruta admin**: `/panel-admin`, `/configuracion`, `/admin/panel`. Sugerencia: `/panel-admin`.
2. **DMs sin Amigos**: si Amigos está OFF, ¿se pueden seguir mandando DMs entre amigos existentes? Sugerencia: sí (no afectar amistades preexistentes).
3. **Default values al crear el doc por primera vez**: todos `enabled: true`.
4. **Persistir cambios incluso si MongoDB se reinicia**: el modelo singleton vive en DB, sobrevive reinicios.
5. **Notificaciones huérfanas**: una notif vieja de tipo `dm` con la sección DMs OFF se muestra pero el link puede no funcionar. Aceptable según decisión tomada.
6. **¿Necesitamos un toggle "modo mantenimiento" global?** Sería un toggle adicional que apaga TODO menos `/login`/`/register`. Fuera de alcance de este plan; mencionado como posible futuro.
7. **Public read de `/api/site-config`**: ¿devuelve flags de todas las secciones o sanitiza algo? Sugerencia: devolver todo (no hay info sensible — solo booleans).
8. **BG Watch tiene una particularidad**: el endpoint `GET /api/compartidas/:id/og` se llama desde el middleware Vercel para crawlers. Si Compartidas está OFF, el OG devolverá 403 y los share links rotos. ¿Aceptable o necesitamos endpoint público que ignore el toggle? Sugerencia: aceptable (apagar Compartidas implica apagar share links también).

## Estimación de esfuerzo

- Fase 1 (foundation): 2-3 h
- Fase 2 (server gating): 1 h
- Fase 3 (notifications): 1-2 h
- Fase 4 (client UI gating): 3-4 h (es la fase más invasiva por cantidad de widgets cruzados)
- Fase 5 (panel UI): 2-3 h
- Fase 6 (QA): 1-2 h

**Total**: ~10-15 h de trabajo. Se puede hacer en fases independientes con PRs separados.

## Notas

- El plan no migra notificaciones existentes (decisión del usuario).
- El plan no agrega tests automatizados (no hay test suite configurada en el proyecto).
- Recordar: commit messages en inglés, UI en español argentino, CSS variables (no hardcoded colors), soporte dark/light theme en el Panel Admin.
