# Handoff: Notificaciones reimaginadas · TurnoCero

## Overview

Rediseño completo de la página **Notificaciones** (`/notificaciones`) de TurnoCero.
Hoy es una bandeja simple centrada solo en mesas; la reimaginación la convierte en
una **bandeja viva transversal a toda la plataforma** — mesas, eventos, torneos,
amigos, compartidas, noticias, BG Watch y sistema — con acciones inline,
agrupación inteligente y un panel lateral de resumen + preferencias.

Cambios clave respecto del actual:

- **Bandeja transversal** — 8 dominios de notificación (antes solo mesas), cada uno
  con color e icono propios.
- **Acciones inline** — solicitudes de mesa y de amistad se aceptan/rechazan sin
  salir de la bandeja, con confirmación animada (`ResolvedRow`). Inscripciones de
  evento (host) abren la revisión.
- **Agrupación inteligente** — eventos repetidos se colapsan en una sola fila con
  avatares apilados ("A Cami, Pancho y 7 más les gustó tu compartida", "3 mensajes
  nuevos en el chat de la mesa").
- **Agrupación por tiempo** — Hoy / Esta semana / Antes.
- **Filtros** — Todas · Sin leer · Requieren acción (destacado en rojo) · por dominio.
- **Panel lateral** — resumen diario (sin leer / accionables / hoy / total) con
  breakdown por categoría en barras, + tabla de preferencias push/email toggleable
  por dominio, + nota de horario tranquilo.
- **Affordances de hover** — marcar leída / descartar por fila; barra de acento a la
  izquierda en no leídas; densidad cómoda vs compacta.

---

## About the Design Files

Los archivos en este bundle son **referencias de diseño** en HTML + JSX vanilla
(Babel standalone). **No es código para copiar directo** — recrear en el entorno
actual de TurnoCero: React + Vite + CSS Modules + React Router.

Crear / reemplazar:

- Nueva página `client/src/pages/notificaciones/Notificaciones.jsx` (la ruta
  `/notificaciones` ya existe — hoy navega desde `Navbar.jsx` y `Sidebar.jsx`).
- `Notificaciones.module.css`
- Componentes: `NotifRow.jsx`, `SidePanel.jsx` (digest + preferencias).

Manteniendo intactas las integraciones con `useNotifications()`
(`NotificationContext`), que ya expone `unreadCount`, `adminChatUnread`,
`setActiveTorneo`, `setActiveCompartida`, `notifyFriendAdded`. Esta página debe
**consumir y extender** ese contexto (ver sección Integración).

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, radios, sombras y
animaciones del prototipo están finalizados.

---

## Design tokens (de `reimagined-styles.css`)

```css
/* Backgrounds */
--bg-dark:     #0a0d15;   --bg-card:     #151c28;
--bg-elevated: #1d2532;   --bg-deep:     #050810;

/* Brand */
--accent:       #1888ef;  --accent-light: #00aeff;
--accent-dark:  #0076d1;  --accent-glow:  rgba(24,136,239,0.18);

/* Text */
--text-primary: #ffffff;  --text-secondary: #a8b4cc;
--text-muted:   #5a6178;  --text-faint:     #353d52;

/* Borders */
--border: #1e2a3d;  --border-strong: #2a3a55;  --border-accent: rgba(24,136,239,0.4);

/* Status */
--red: #f31d77;  --red-10: rgba(243,29,119,0.10);  --red-25: rgba(243,29,119,0.25);
--green: #00d984;  --orange: #f5a623;  --purple: #b48cff;

/* Type */
--font-display: 'Poppins', sans-serif;       /* títulos, números */
--font-body:    'Archivo', sans-serif;       /* body */
--font-mono:    'JetBrains Mono', monospace; /* eyebrows, tags, timestamps */

--t: 0.2s ease;
```

### Color por dominio de notificación (`NOTIF_TYPES`)

| type         | label       | color     | icono      |
| ------------ | ----------- | --------- | ---------- |
| `mesa`       | Mesas       | `#1888ef` | Dice       |
| `evento`     | Eventos     | `#00aeff` | Calendar   |
| `torneo`     | Torneos     | `#f5a623` | Trophy     |
| `amigo`      | Amigos      | `#00d984` | Users      |
| `compartida` | Compartidas | `#f31d77` | Heart      |
| `noticia`    | Noticias    | `#b48cff` | News       |
| `bgwatch`    | BG Watch    | `#00d984` | Chart      |
| `sistema`    | Sistema     | `#5a6178` | Megaphone  |

El color del dominio se inyecta por fila como `--rowColor` y se usa para el icono,
la barra de no-leída, el tag, y tintes (`color-mix(in srgb, var(--rowColor) X%, transparent)`).

---

## Modelo de datos

El prototipo usa un mock (`NOTIFS` en `notif-shared.jsx`). En producción viene del
backend. Forma sugerida de cada notificación:

```ts
type Notif = {
  id: string;
  type: 'mesa'|'evento'|'torneo'|'amigo'|'compartida'|'noticia'|'bgwatch'|'sistema';
  action: null | 'mesa_request' | 'friend_request' | 'evento_pending';  // accionable inline
  unread: boolean;
  date: string;                 // ISO
  actors: Array<{ name: string; handle?: string; initial: string; color: string }>;
  target: string | null;        // contexto: "Catán · Otoño", "tu compartida"
  title: string;                // línea principal renderizada
  body?: string;                // subtexto / preview (si empieza con " se renderiza italic)
  cta?: string;                 // label de acción no-destructiva ("Ver mesa", "Responder")
  grouped?: boolean;            // colapsar múltiples actores en avatares apilados
  extraCount?: number;          // "+N" adicional sobre los actores mostrados
  badge?: number;               // contador rojo (ej. nº de mensajes nuevos)
  system?: boolean;             // usa icono de dominio en vez de avatar de persona
  resolved?: boolean;           // ya se actuó (oculta acciones)
};
```

Reglas de render del visual izquierdo:
1. `grouped && actors.length > 1` → **avatares apilados** (hasta 3 + "+N") con pip de dominio debajo.
2. `system === true` → **icono de dominio** sólido (sin persona).
3. default → **avatar del actor** (42×42) + **pip de dominio** (20×20) en esquina inferior derecha.

`action` define las acciones inline:
- `mesa_request` → "Rechazar" / "Aceptar"
- `friend_request` → "Rechazar" / "Aceptar"
- `evento_pending` → "Después" / "Revisar" (host: abre triage de inscripciones)
- `null` pero con `cta` → botón ghost "{cta} →"

---

## Layout

```
<page max-width: 1200px; padding: 32px 28px 80px>
  <.notifLayout>                  ← grid 1fr 320px, gap 36
    <main.notifMain>
      <.notifHero>                ← eyebrow live + H1 "Tu actividad." + acciones
      <.notifFilters>             ← chips (Todas/Sin leer/Requieren acción/dominios)
      <section> x3                ← buckets Hoy / Esta semana / Antes
        <.bucketHeader />
        <.notifList>
          <NotifRow /> …
    <aside.notifSide>             ← sticky: digest + preferencias
      <.sideCard> digest
      <.sideCard.prefCard> prefs
</page>
```

Mobile (≤ 980px): 1 columna, `.notifSide` pasa arriba (`order: -1`), se oculta
`.prefCard` para mantener foco (las preferencias completas viven en su propia
pantalla de settings). ≤ 560px: hero apila, botones de acción full-width.

---

## `<.notifHero>`

Flex space-between align-items flex-end, padding-bottom 24px, border-bottom 1px, margin-bottom 24px.

- **Eyebrow** (`.notifHeroEyebrow`): Mono 11px 0.18em uppercase cyan, con rule-line `::before` 28×1px **y** un `.liveDot` (7×7 rojo, box-shadow halo, `pulse 2s infinite`). Texto: `Bandeja · {unreadCount} sin leer`
- **H1** (`.notifHeroTitle`): Poppins 700, `clamp(2.2rem, 4.5vw, 3.4rem)`, ls -0.045em, lh 0.92. **"Tu <em>actividad.</em>"** (`<em>` normal-style cyan)
- **Acciones** (`.notifHeroActions`): 
  - `.notifActionBtn` "Marcar todas" (ghost, icon DoubleCheck) → marca todo leído
  - `.notifActionBtn.primary` "Preferencias" (bg accent, icon Gear)

---

## `<.notifFilters>` (chips)

`.notifChip`: transparent, border 1px, Mono 11px 0.06em uppercase, padding `7px 13px`, br 999px.
- `.active` → bg accent, border accent, color #fff
- `.alert` (filtro "Requieren acción" cuando count > 0) → color rojo, border red-25; activo → bg rojo
- `.chipCount` → `· N` con opacity 0.6

Filtros (`NOTIF_FILTERS`): `all` Todas · `unread` Sin leer · `actionable` Requieren acción · `mesa` · `evento` · `torneo` · `amigo` · `compartida` · `sistema` (agrupa sistema + noticia + bgwatch).

---

## `<.bucketHeader>` (separador de tiempo)

Flex baseline gap 14px, margin `28px 0 12px` (primero sin margin-top).
- `.bucketLabel`: Poppins 700 1.05rem ls -0.02em primary — "Hoy" / "Esta semana" / "Antes"
- `.bucketRule`: flex 1 height 1px border
- `.bucketCount`: Mono 10px 0.12em uppercase muted

Buckets calculados con `notifBucket(date)`: mismo día = `today`; < 7 días = `week`; resto = `earlier`. Solo render de buckets con items.

---

## `<NotifRow>` — la pieza central

`.notifRow`: flex gap 14px align-items flex-start, border 1px, br 13px, padding `14px 16px`, animation `rowEnter 0.4s` con delay `i * 40ms`.

Estados:
- **`.unread`** → bg `var(--bg-card)`, border-strong, **+ barra de acento**: `::before` absolute left 0, width 3px, top/bottom 14px, `background: var(--rowColor)`, br `0 3px 3px 0`
- **`.actionable`** → border `var(--rowColor)`, inset shadow 1px del color, + fondo con gradiente sutil del color: `linear-gradient(90deg, color-mix(in srgb, var(--rowColor) 7%, transparent), transparent 55%)` sobre bg-card
- hover → border-strong + bg `rgba(24,136,239,0.02)`

### Visual izquierdo (3 variantes — ver "Modelo de datos")

**1. Grouped** (`.notifGroupWrap`):
- `.notifGroupAvatars`: avatares 30×30 br 9px, **solapados** con `margin-left: -10px` (primero 0), border 2px del color de fondo del row (bg-dark normal, bg-card si unread). Hasta 3 + `.gAv.more` "+N".
- `.notifGroupPip` debajo: 22×22 br 7px, icono de dominio tintado.

**2. System** (`.notifIcon`): 42×42 br 12px, color `--rowColor`, bg `color-mix(--rowColor 14%)`, border `color-mix(--rowColor 28%)`, icono 19×19 centrado.

**3. Default — actor + pip** (`.notifAvatarStack`):
- `.mainAv`: 42×42 br 12px, bg `actor.color`, Poppins 800 16px, inicial
- `.domainPip`: absolute bottom/right -4px, 20×20 br 7px, bg color del dominio, border 2px del fondo del row, icono 11×11

### Body (`.notifBody`)

`.notifTopline` (flex align-center gap 8px wrap):
- `.unreadDot` (7×7 círculo `--rowColor`) si no leída
- `.notifDomainTag`: Mono 9px 700 0.12em uppercase color `--rowColor` — label del dominio
- `.notifTarget`: Mono 9.5px muted, prefijo "· ", ellipsis max 180px — el contexto
- `.notifCountBadge`: badge rojo Poppins 800 9.5px — `badge` (ej. nº mensajes)
- `.notifTime`: margin-left auto, Mono 10px muted — `notifTimeAgo(date)`

Debajo:
- `.notifTitle`: Poppins 600 14px ls -0.015em lh 1.3 primary — `title`
- `.notifText`: 13px secondary lh 1.45 — `body` (con `.quote` italic si empieza con `"`). **Oculto en densidad `compact`.**

### Acciones inline (`.notifRowActions`, margin-top 8px)

Si `action && !resolved`:
- `.notifBtnReject` (transparent + border-strong, hover rojo) — "Rechazar" / "Después"
- `.notifBtnAccept` (bg verde, color `#001712`, icon Check) — "Aceptar" / "Revisar"

Si solo `cta`:
- `.notifBtnGhost` (Mono 11px uppercase color `--rowColor`, icon Arrow) — "{cta} →"

### Hover affordances (`.notifHoverActions`, absolute top/right 10px, opacity 0 → 1 en hover)

- `.notifHoverBtn` "marcar leída" (icon Check) — solo si unread
- `.notifHoverBtn` "descartar" (icon X)

---

## `<ResolvedRow>` — confirmación post-acción

Al aceptar/rechazar, la fila se reemplaza ~1.8s por una versión resuelta (opacity 0.7):
- icono Check (verde) o X (gris) en `.notifIcon`
- título dinámico:
  - friend_request + accept → "Ahora sos amigo de {name}"
  - evento_pending + accept → "Abriendo revisión de inscripciones…"
  - mesa accept → "Aceptaste a {name} en {target}"
  - reject → "Listo, lo descartamos"

Luego se marca `resolved: true` + `unread: false` en el item.

---

## Panel lateral (`<SidePanel>`)

`position: sticky; top: 80px`, flex column gap 16px.

### Digest card (`.sideCard`)

- `.digestHead`: bg radial accent + gradient navy, border-bottom. Eyebrow "◆ Resumen · {fecha}" + título "Tu día en TurnoCero"
- `.digestStats`: grid 2×2 con 1px gap (se ve como líneas divisorias por el bg border). 4 stats:
  - Sin leer (`.red`) · Requieren acción (`.orange`) · Hoy (`.accent`) · Total activas (`.green`)
  - Cada uno: valor Poppins 800 1.7rem + label Mono 9px uppercase
- `.digestBreakdown`: barras por categoría. Cada `.breakdownRow` (grid `16px 1fr auto`): icono tintado + `.breakdownTrack` (6px bg-deep) con `.breakdownFill` (color `--bdColor`, width = `count/max * 100%`) + count. Ordenado desc por cantidad.

### Preferences card (`.sideCard.prefCard`)

- `.prefHead`: título "Preferencias" (icon Gear) + link "Ver todas"
- `.prefTableHead`: grid `1fr 44px 44px` — "Categoría / Push / Email"
- `.prefRow` (por dominio en `NOTIF_PREFS`): grid igual. Label con dot del color + nombre. Dos `.prefToggle` (push, email).
  - `.prefToggle`: 34×20 br 999px, knob 14×14. `.on` → bg accent-glow, border accent, knob desplazado a la derecha cyan.
- `.quietNote`: nota de horario tranquilo (icono luna violeta) — "Horario tranquilo activo · 23:00–08:00".

---

## Interacciones & comportamiento

### Acciones de bandeja
- **Marcar todas leídas** → `PUT /api/notifications/read-all` → `unread: false` en todas + reset badge global del `NotificationContext`
- **Marcar una leída** (hover Check) → `PUT /api/notifications/:id/read`
- **Descartar** (hover X) → `DELETE /api/notifications/:id` (remueve de la lista)
- **Filtros** → client-side sobre el set cargado (o server-side con `?filter=`)

### Acciones inline (las accionables)
- `mesa_request` accept → `POST /api/tables/:id/accept/:userId`; reject → `POST /api/tables/:id/reject/:userId`
- `friend_request` accept → `POST /api/friends/:id/accept` (dispara `notifyFriendAdded()`); reject → `POST /api/friends/:id/reject`
- `evento_pending` "Revisar" → navega a `/eventos/:id/inscripciones` (triage de inscripciones); "Después" → marca leída sin resolver
- Tras la acción: mostrar `ResolvedRow` ~1.8s, luego marcar resuelta. Optimistic update; rollback si falla.

### CTAs no-destructivos
Navegan al recurso:
- mesa → `/mesas/:id` (o `/mesas/:id` chat)
- evento → `/eventos/:id`
- torneo → `/torneos/:id`
- compartida → `/compartidas/:id`
- amigo → `/usuarios/:handle`
- noticia → `/noticias/:slug`
- bgwatch → `/bg-watch`

### Preferencias
- Toggle push/email por dominio → `PUT /api/notifications/preferences` con `{ type, channel, enabled }`
- "Ver todas" / "Preferencias" (hero) → `/configuracion/notificaciones`

### Animaciones
- `rowEnter`: `opacity 0 + translateY(8px) → opacity 1 + translateY(0)`, 0.4s, delay escalonado `i*40ms`
- `pulse` (live dot del hero): opacity 1 ↔ 0.35, 2s infinite
- ResolvedRow: fade-in al reemplazar

---

## Integración con `NotificationContext`

El contexto actual (`client/src/context/NotificationContext.jsx`) ya provee:
```js
const { unreadCount, adminChatUnread, setActiveTorneo, setActiveCompartida, notifyFriendAdded } = useNotifications();
```

Esta página debe:
1. **Consumir** `unreadCount` para el eyebrow del hero (en vez del mock `counts.unread`).
2. **Cargar** el listado real vía un nuevo endpoint/hook (`useQuery(['notifications', filter], fetchNotifications)`).
3. **Decrementar** el badge global al marcar leído/descartar (extender el contexto con
   `markRead(id)`, `markAllRead()`, `dismiss(id)` que actualicen `unreadCount`).
4. Reusar `notifyFriendAdded()` al aceptar `friend_request`.

Sugerencia: mover la lógica de fetch + mutaciones al `NotificationContext` o a un
hook `useNotificationsFeed()` para que la bell del Navbar/Sidebar y esta página
compartan estado.

---

## State management (prototipo)

```ts
const [filter, setFilter]     = useState('all');
const [items, setItems]       = useState(NOTIFS);     // → useQuery en prod
const [resolved, setResolved] = useState({});         // id -> 'accept'|'reject' (transitorio)
const [prefs, setPrefs]       = useState(NOTIF_PREFS);

// counts derivados con useMemo (all, unread, actionable, today, + por dominio)
// filtered con useMemo según filter
// groups con useMemo agrupando por notifBucket(date)
```

Tweaks expuestos: `density` (compact/comfy) y `accent` (azul/violeta/verde) — en
producción `density` puede ser una preferencia de usuario; `accent` es solo para
exploración de marca, no es necesario portarlo.

---

## Responsive

- **≤ 980px**: `.notifLayout` 1 col, `.notifSide` arriba (`order: -1`), `.prefCard` oculto
- **≤ 560px**: hero apila vertical, botones de acción full-width, `.notifTarget` max 110px, `.notifTime` sin margin-left auto

---

## Assets

- **Fuentes**: Poppins (500-800), Archivo (400-700), JetBrains Mono (400-600) vía Google Fonts
- **Sin imágenes**: avatares = iniciales sobre color; iconos = SVG inline en `notif-shared.jsx → NIcon` (Bell, Dice, Calendar, Trophy, Users, Heart, Comment, News, Chart, Megaphone, Check, X, Arrow, Dot, DoubleCheck, Gear, Inbox)
- **`color-mix`**: los tintes de fila usan `color-mix(in srgb, …)` — soportado en navegadores modernos. Fallback: precalcular los rgba por dominio si hay que soportar navegadores viejos.

---

## Files (referencia)

- `Notificaciones Reimagined.html` — entry HTML, carga React/ReactDOM/Babel + scripts
- `reimagined-styles.css` — tokens compartidos del sistema (tokens, switcher, `.page`, hero genérico)
- `notif-styles.css` — estilos específicos de notificaciones (hero, chips, rows, grouped avatars, side panel, prefs)
- `notif-shared.jsx` — helpers (`notifTimeAgo`, `notifBucket`), iconos (`NIcon`), registro de tipos (`NOTIF_TYPES`), filtros (`NOTIF_FILTERS`), buckets, mock (`NOTIFS`), preferencias (`NOTIF_PREFS`)
- `notif-app.jsx` — `NotifApp` (página completa) + `NotifRow` + `ResolvedRow` + `SidePanel` + integración con `useTweaks`

Codebase a crear/conectar:
- Nuevo `client/src/pages/notificaciones/Notificaciones.jsx` + `.module.css`
- Ruta `/notificaciones` (ya referenciada en `Navbar.jsx:73` y `Sidebar.jsx:333`)
- Extender `client/src/context/NotificationContext.jsx` con feed + mutaciones

---

## Checklist de implementación

- [ ] Página `Notificaciones.jsx` con layout 2 columnas (feed + side panel)
- [ ] `NotifRow` con las 3 variantes de visual izquierdo (grouped / system / actor+pip)
- [ ] Estados de fila: unread (barra acento), actionable (gradiente + border color)
- [ ] Acciones inline con `ResolvedRow` y optimistic update
- [ ] Hover affordances (marcar leída / descartar)
- [ ] Filtros + agrupación por tiempo
- [ ] Side panel: digest stats + breakdown bars + tabla de preferencias
- [ ] Conectar con `NotificationContext` real (unreadCount, mutaciones)
- [ ] Endpoints: list, read, read-all, dismiss, accept/reject por tipo, preferences
- [ ] Responsive 980 / 560
- [ ] Accesibilidad: foco visible, `aria-label` en toggles e icon-buttons, roles de lista
