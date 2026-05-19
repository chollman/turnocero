# Handoff: Sidebar reimaginado · TurnoCero

## Overview

Rediseño del sidebar principal de TurnoCero. Mantiene toda la funcionalidad del actual
(`client/src/components/layout/Sidebar.jsx`) pero aplica el sistema visual reimaginado
de la suite (motivo `◆`, eyebrows en mono uppercase con rule-line, ticket-stub
perforado, animaciones de entrada escalonadas, paleta navy + cyan).

Cambios clave respecto del actual:

- **Logo T0** (Concept F dark) — chip rounded navy con borde cyan, T blanca + anillo cyan con pip blanco.
- **Items agrupados en 3 secciones** con eyebrow `◆ Comunidad / ◆ Encuentros / ◆ Tuyo` (en vez de una lista plana).
- **Sección Admin** separada con tinte naranja, marcada como tooling estructural.
- **Active state** con barra cyan de 3px a la izquierda + fondo azul translúcido (`--accent-glow`) + ícono coloreado.
- **Badges** en JetBrains Mono: estado normal (gris), `live` (verde), `urgent` (rojo con pulso animado).
- **BG Watch promo** se renderiza con borde dashed violeta + pill "Nuevo".
- **Footer del usuario** ahora es un **mini ticket-stub** con perforación lateral (semicírculos), dot de estado verde, handle en mono, y botón logout.
- **Animación de entrada** escalonada por item al cargar el sidebar (`navIn` keyframes, delay `--i * 35ms`).
- **Modo collapsed** (76px) opcional, controlable desde Tweaks o por algún botón del header.

---

## About the Design Files

El archivo `Sidebar Reimagined.html` adjunto es una **referencia de diseño** construida en HTML/CSS vanilla — un prototipo que muestra el look final, los estados y la lógica de Tweaks. **No es código para copiar directo**.

La tarea es **recrear este diseño dentro del entorno actual de TurnoCero**: React + Vite + CSS Modules. Reemplazar el contenido de:

- `client/src/components/layout/Sidebar.jsx`
- `client/src/components/layout/Sidebar.module.css`

manteniendo intactas todas las integraciones con `useAuth`, `useNotifications`, `useSiteConfig`, el `Avatar` component y los hooks de routing (`useLocation`, `useNavigate`, `Link`).

---

## Fidelity

**Hi-fi pixel-accurate.** Los colores, tipografías, espacios, radios, sombras y animaciones del prototipo están finalizados. Recrear pixel-perfect usando los CSS Modules existentes del codebase.

---

## Componente único: `<Sidebar />`

### Estructura general

```
<aside class="sidebar">
  <div class="logoRow">               ← Logo T0 + texto + botón notificaciones
  <nav class="nav">                   ← scroll, 3-4 secciones agrupadas
    <section class="navSection">
      <span class="navLabel">         ← eyebrow mono uppercase con rule-line
      <a class="navItem">             ← icon + label + badge opcional
      …
    </section>
    …
  </nav>
  <div class="sidebarFooter">         ← ticket-stub del usuario + logout
</aside>
```

### Layout — desktop ≥ 960px

- Ancho fijo: **280px** (expanded) · **76px** (collapsed)
- `position: sticky; top: 0; height: 100vh;`
- Background: `var(--bg-card)` (`#151c28`)
- Border-right: `1px solid var(--border)` (`#1e2a3d`)
- Display: `flex; flex-direction: column`
- Padding: `18px 0 14px`
- Textura sutil: pattern de dots `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)` `background-size: 18px 18px`, vía `::before` con `pointer-events: none`

### Logo row

Padding: `0 18px 18px`. Border-bottom: `1px solid var(--border)`. Margin-bottom: `18px`. Flex con gap 12px.

#### Logo mark — chip 44×44

- Container: `44×44`, `background: #0a0d15`, `border: 1.5px solid #00aeff`, `border-radius: 12px`, `box-shadow: 0 4px 14px rgba(24,136,239,0.18)`
- Display flex centrado, gap 3px
- Halo extra: `::after` con `inset: -1.5px`, gradient `linear-gradient(135deg, rgba(0,174,255,0.4), transparent 60%)`, opacity 0.4, z-index -1
- T glyph (16×20): construida con 2 rectángulos blancos
  - Arm: `width: 16; height: 3; border-radius: 1`
  - Stem: `position: absolute; left: 6.5; width: 3.5; height: 20; border-radius: 1`
- Ring (18×18): `border: 3px solid #00aeff; border-radius: 50%`
  - Pip central: `::after` 4×4 blanco circular centrado

#### Logo text (flex 1)

- `.logoName`: Poppins 800, 17px, letter-spacing `-0.035em`, color `#ffffff`, line-height 1.05, texto **"TurnoCero"**
- `.logoSub`: JetBrains Mono 500, 9px, letter-spacing `0.18em`, color `#5a6178`, uppercase, margin-top 2px, texto **"◆ board game meetups"**

#### Notification bell

- `36×36`, `border: 1px solid var(--border)`, `border-radius: 9px`
- Color `var(--text-secondary)` (`#a8b4cc`)
- Hover: color → `var(--accent-light)`, border → `var(--border-accent)`, background → `var(--accent-glow)`
- Badge: posición `top: -4; right: -4`, min-width 16px, padding `0 4px`, height 16px, background `var(--red)` (`#f31d77`), color `#fff`, border `1.5px solid var(--bg-card)`, font Poppins 800 10px, contenido `unreadCount > 9 ? "9+" : unreadCount`

### Nav

- `flex: 1`, `overflow-y: auto`, `padding: 0 12px`
- Display flex column, gap **22px** entre secciones
- Custom scrollbar: width 6px, thumb `var(--border-strong)`

#### Sección — `.navSection`

Display flex column, gap 2px.

##### Label — eyebrow con rule-line

```
<span class="navLabel">◆ Comunidad</span>
```

- JetBrains Mono 500, 10px, letter-spacing `0.18em`, color `var(--text-muted)`, uppercase
- Padding `0 6px 8px`
- `::after`: rule-line — `content: ''; flex: 1; height: 1px; background: var(--border)`

##### Item — `.navItem`

```
<a class="navItem" [data-active="true"]>
  <span class="navIcon">{icon}</span>
  <span class="navLabel">{label}</span>
  {badge && <span class="navBadge {variant}">{badge}</span>}
</a>
```

Display: `grid; grid-template-columns: 24px 1fr auto; gap: 12px; align-items: center`.
Padding `9px 12px`, border-radius 9px.
Color default `var(--text-secondary)`, Archivo 500 14px, letter-spacing `-0.005em`.

**Animación de entrada:**
```css
animation: navIn 0.35s ease both;
animation-delay: calc(var(--i, 0) * 35ms);
@keyframes navIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
```
Asignar `--i` a cada item según posición global.

**Hover:**
- Background `var(--bg-elevated)` (`#1d2532`)
- Color → `var(--text)` (`#ffffff`)

**Active:**
- Background `var(--accent-glow)` (`rgba(24,136,239,0.18)`)
- Color → `var(--accent-light)` (`#00aeff`)
- Ícono también recibe el color cyan
- Barra lateral via `::before`: `position: absolute; left: -12px; top: 50%; transform: translateY(-50%); width: 3px; height: 22px; background: var(--accent-light); border-radius: 0 2px 2px 0`

##### Variante promo — BG Watch CTA cuando user no tiene `bggUsername`

- Background `var(--purple-10)` (`rgba(180,140,255,0.1)`)
- Border: `1px dashed var(--purple-25)` (`rgba(180,140,255,0.3)`)
- Color `var(--purple)` (`#b48cff`)
- Hover background: `rgba(180,140,255,0.16)`
- Badge: variante "Nuevo" en uppercase, JetBrains Mono 10px

##### Badges — `.navBadge`

JetBrains Mono 600, 10px, letter-spacing `0.02em`, padding `2px 7px`, min-width 22px, border-radius 999px, border `1px solid var(--border)`, background `var(--bg-elevated)`, color `var(--text-muted)`, text-align center.

Variantes:
- **`.live`** (verde): color `var(--green)`, background `var(--green-10)`, border `var(--green-25)`
- **`.urgent`** (rojo, anima): color `var(--red)`, background `rgba(243,29,119,0.1)`, border `rgba(243,29,119,0.25)`, animation `pulseBadge 1.5s ease infinite` (`@keyframes pulseBadge { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`)

Cuando el item está active, el badge cambia a fondo `var(--accent-glow)`, border `var(--border-accent)`, color `var(--accent-light)`.

#### Sección Admin

Visible solo si `isActuallyAdmin && !viewAsUser`. Aplica modifier `.admin` al `.navSection`:

- El `.navLabel` cambia color a `var(--orange)` (`#f5a623`)
- Hover de items: background `var(--orange-10)`, color `var(--orange)`, ícono también naranja

### Grupos de nav items

```js
const SECTIONS = [
  {
    label: 'Comunidad',
    items: [
      { id: 'compartidas', label: 'Compartite', to: '/compartidas', section: 'compartidas', badge: { variant: 'live', getValue: ctx => ctx.newComparticasCount } },
      { id: 'noticias',    label: 'Noticias',   to: '/noticias',    section: 'noticias' },
      { id: 'users',       label: 'Comunidad',  to: '/usuarios',    section: 'comunidad' },
    ],
  },
  {
    label: 'Encuentros',
    items: [
      { id: 'dash',     label: 'Mesas',    to: '/mesas',    section: 'mesas',    badge: { variant: 'default', getValue: ctx => ctx.activeTablesCount } },
      { id: 'eventos',  label: 'Eventos',  to: '/eventos',  section: 'eventos',  badge: { variant: 'urgent',  getValue: ctx => ctx.upcomingEventsCount } },
      { id: 'torneos',  label: 'Torneos',  to: '/torneos',  section: 'torneos' },
    ],
  },
  {
    label: 'Tuyo',
    items: [
      { id: 'feed',    label: 'Mi feed',  to: '/mi' },
      { id: 'bgwatch', label: 'BG Watch', to: ctx => `/bg-watch/${ctx.user.bggUsername}`, gatedBy: ctx => Boolean(ctx.user?.bggUsername), badge: { getValue: ctx => ctx.bgwPlaysCount } },
      // CTA when user has no bggUsername yet:
      { id: 'bgwatchCta', label: 'Activá BG Watch', to: '/bg-watch', variant: 'promo', gatedBy: ctx => !ctx.user?.bggUsername, badge: { value: 'Nuevo' } },
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { id: 'panel',     label: 'Panel admin',   to: '/panel-admin' },
      { id: 'db',        label: 'Base de datos', to: '/base-de-datos' },
      { id: 'adminChat', label: 'Chat admin',    to: '/mensajes-admin', badge: { variant: 'urgent', getValue: ctx => ctx.adminChatUnread } },
    ],
  },
];
```

Filtrar items por `isSectionEnabled(item.section)`, `item.adminOnly`, y `gatedBy(ctx)`. Mostrar sección Admin solo si `isActuallyAdmin && !viewAsUser`.

Mantener los íconos del Sidebar.jsx actual (todos están bien) — solo cambian las clases CSS.

### Footer — `.sidebarFooter`

Margin-top 14px, padding `0 12px`.

#### User ticket — `.userTicket`

```
<Link to="/perfil" className="userTicket">
  <div class="userAvatar">{initial}</div>
  <div class="userInfo">
    <span class="userName">{user.displayName || user.username}</span>
    <span class="userMeta">
      <span class="statusDot" />
      @{user.username} · activo
    </span>
  </div>
  <button class="logoutBtn" onClick={onLogout}>{logoutIcon}</button>
</Link>
```

Layout:
- Background `var(--bg-paper)` (`#18202f`)
- Border `1px solid var(--border)`, border-radius 12px
- Padding `10px 12px`
- Flex con gap 11px, align center
- Position relative, overflow hidden

**Perforación lateral (ticket-stub):**
```css
.userTicket::before,
.userTicket::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--bg-card);  /* matches sidebar bg to "cut" the corners */
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%);
}
.userTicket::before { left: -5px; }
.userTicket::after  { right: -5px; }
```

**Avatar (`.userAvatar`):**
- 32×32, border-radius 10px, background `var(--accent)`, color `#fff`
- Poppins 800 13px, letter-spacing `-0.04em`

**Info (`.userInfo`):**
- `.userName`: Poppins 700 13px, letter-spacing `-0.015em`, color `var(--text)`, line-height 1.15, ellipsis si overflow
- `.userMeta`: JetBrains Mono 10px, letter-spacing `0.04em`, color `var(--accent-light)`, margin-top 1px, flex con gap 4px

**Status dot (`.statusDot`):**
- 6×6, border-radius 50%, background `var(--green)`, box-shadow `0 0 6px var(--green)`

**Logout button (`.logoutBtn`):**
- 32×32, background transparente, border none, border-radius 8px
- Color `var(--text-muted)`
- Hover: color `var(--red)`, background `rgba(243,29,119,0.1)`
- Importante: usar `stopPropagation` en `onClick` para no disparar el Link del Avatar.

#### Confirmación de logout

Mantener el patrón existente: cuando se clickea logout, mostrar inline confirmación "¿Cerrar sesión? · Sí · No" en lugar del ticket. Usar variant `.logoutConfirm` con bg `var(--bg-paper)`, padding 10px 12px, border-radius 12px, flex column gap 6px.

### Modo collapsed (76px)

Toggle controlado por algún botón del header. Aplica clase `.sidebar.collapsed`:

- Ancho 76px
- Oculta: `.logoText`, `.navLabel`, `.navItem .label`, `.navBadge`, `.userInfo`, `.logoutBtn`, rule-line del eyebrow
- `.navItem`: cambia a `grid-template-columns: 1fr; place-items: center; padding: 11px`
- `.logoRow`: padding `0 14px 18px`, justify-content center, oculta el bell
- `.userTicket`: padding 6px, justify-center, sin perforación
- App shell: `grid-template-columns` ajusta a `76px 1fr`

Tooltip en cada item al hacer hover en collapsed mode — usar el atributo `title` o un tooltip custom según convención del codebase.

### Mobile (≤ 880px)

El sidebar se oculta completamente. Mantener el `BottomNav.jsx` actual para mobile (no se reimagina aquí).

---

## State Management

### Context dependencies (sin cambios)

```js
const { user, isActuallyAdmin, viewAsUser, logout } = useAuth();
const { unreadCount, adminChatUnread, ...moreCounts } = useNotifications();
const { isSectionEnabled } = useSiteConfig();
```

Si querés alimentar los badges nuevos (`activeTablesCount`, `upcomingEventsCount`, `bgwPlaysCount`), agregar esos counters al `NotificationContext` o crear un `useSidebarCounters()` hook que haga las queries necesarias con caché razonable (5-30 min).

### Local state

```js
const [collapsed, setCollapsed] = useState(() => loadFromStorage('sidebarCollapsed', false));
const [confirmingLogout, setConfirmingLogout] = useState(false);
```

Persistir `collapsed` en localStorage para que sobreviva refreshes.

---

## Design tokens

```css
/* Backgrounds */
--bg-dark:     #0a0d15;
--bg-card:     #151c28;
--bg-elevated: #1d2532;
--bg-paper:    #18202f;
--bg-deep:     #050810;

/* Accent (cyan) */
--accent:        #1888ef;
--accent-light:  #00aeff;
--accent-dark:   #0076d1;
--accent-glow:   rgba(24,136,239,0.18);
--border-accent: rgba(24,136,239,0.4);

/* Text */
--text:           #ffffff;
--text-secondary: #a8b4cc;
--text-muted:     #5a6178;
--text-faint:     #353d52;

/* Borders */
--border:        #1e2a3d;
--border-strong: #2a3a55;

/* Status */
--red:    #f31d77;   --red-10: rgba(243,29,119,0.1);   --red-25: rgba(243,29,119,0.25);
--green:  #00d984;   --green-10: rgba(0,217,132,0.1);  --green-25: rgba(0,217,132,0.25);
--orange: #f5a623;   --orange-10: rgba(245,166,35,0.1); --orange-25: rgba(245,166,35,0.3);
--purple: #b48cff;   --purple-10: rgba(180,140,255,0.1); --purple-25: rgba(180,140,255,0.3);

/* Transition */
--t: 0.2s ease;
```

### Typography stack

- Display: `'Poppins', sans-serif` (weights 500, 600, 700, 800)
- Body: `'Archivo', sans-serif` (400, 500, 600, 700)
- Mono: `'JetBrains Mono', ui-monospace, monospace` (400, 500, 600)

Todas se cargan vía Google Fonts en el `<head>` del index.html del cliente (ya están).

### Spacing

| Token         | Valor |
|---------------|-------|
| Section gap   | 22px  |
| Item padding  | 9px 12px |
| Item gap (icon→label→badge) | 12px |
| Sidebar padding (top/bottom) | 18px / 14px |
| Sidebar padding (left/right) | 12px (nav), 18px (logoRow) |
| Border radius (item) | 9px |
| Border radius (logoMark, userTicket) | 12px |
| Border radius (logoMark inner T+ring) | as drawn |

### Animations

- `navIn`: items enter staggered, 350ms ease, `--i * 35ms` delay
- `pulseBadge`: urgent badges pulse, 1.5s ease infinite, opacity 1 ↔ 0.6
- All hover transitions: `transition: all 0.2s ease`

---

## Assets

El logo T0 (Concept F dark) se construye **inline desde primitivas CSS** (sin necesitar SVG externo) — ver el bloque `.logoMark` arriba. Si preferís SVG, el archivo `assets/logo-t0-mark-dark.svg` del proyecto (entregado en el handoff previo) está disponible.

Todos los íconos del nav son inline SVG copiados del `Sidebar.jsx` actual — no requieren cambios.

---

## Files

- **`Sidebar Reimagined.html`** — prototipo de referencia con el sidebar completo + fake content + Tweaks. Inspeccionar para colores, hover states, animaciones, layout exacto.

El código del prototipo es **vanilla HTML/CSS/JS** — re-implementar en React + CSS Modules del codebase actual.

---

## Checklist de implementación

- [ ] Actualizar `Sidebar.jsx` con la nueva estructura de secciones
- [ ] Actualizar `Sidebar.module.css` con los nuevos estilos
- [ ] Agregar logo T0 inline (T + ring construidos con CSS primitives)
- [ ] Implementar sub-eyebrow `◆ board game meetups` en mono
- [ ] Agrupar items en `Comunidad / Encuentros / Tuyo / Admin`
- [ ] Agregar `data-i` attribute para staggered animation
- [ ] Implementar badges (default / live / urgent) con variants
- [ ] Implementar variante `promo` para BG Watch CTA
- [ ] Convertir el user chip del footer en mini ticket-stub con perforación
- [ ] Agregar `statusDot` verde con glow
- [ ] Persistir collapsed mode en localStorage
- [ ] Tooltip en items cuando está collapsed
- [ ] Probar en mobile (sidebar oculto, BottomNav activo)
- [ ] Verificar accesibilidad (focus states con outline visible, aria-current="page" en active)
- [ ] Verificar que badges respondan correctamente a `useNotifications` real
