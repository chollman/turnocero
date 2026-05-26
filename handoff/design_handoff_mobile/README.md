# Handoff: Mobile reimaginado · TurnoCero

## Overview

Rediseño de las dos piezas de navegación mobile de TurnoCero: la **Navbar superior**
(`client/src/components/layout/Navbar.jsx`) y la **BottomNav inferior**
(`client/src/components/layout/BottomNav.jsx`).

Aplica el vocabulario del **Sidebar reimaginado** al formato mobile. Si todavía no se
implementó el sidebar, ver `design_handoff_sidebar/` primero — comparten tokens,
animaciones y patrones.

### Cambios respecto del actual

**Navbar (top, ≤ 960px):**

- **Logo T0** chip mini (38×38) reemplaza el cuadrado azul con "T" del actual.
- **Sub-eyebrow** `◆ board game meetups` en JetBrains Mono uppercase debajo del wordmark.
- **Icon buttons** con border + radius unificados (chat, notif, logout) — antes eran botones planos.
- **Badges** sobre los iconos con variantes (rojo default, verde live).
- **Confirmación de logout** mantiene el patrón inline existente.

**BottomNav (≤ 960px, fixed):**

- **Pill flotante** con `position: absolute; left/right: 12px; bottom: 12px`, en vez de barra full-width.
- **Backdrop blur** (`backdrop-filter: blur(20px)`, bg `rgba(21, 28, 40, 0.94)`).
- **Active state** con bg `--accent-glow` + barrita cyan de 2px debajo del label (en vez del dot del actual).
- **Paginación de 3 ítems** con chevrons laterales + **pager dots** debajo del nav (visual feedback de la página actual).
- **Badges** en iconos individuales (live verde para counts no leídos, rojo para urgentes).
- **Estado promo** (BG Watch CTA): bg violeta, border dashed, pill "NEW" rotado encima.
- **Labels** en JetBrains Mono uppercase 9.5px (en vez de Archivo regular).
- **Iconografía** mantenida del BottomNav actual.

---

## About the Design Files

El archivo `Mobile Reimagined.html` adjunto es una **referencia de diseño** construida en HTML/CSS vanilla — un prototipo que muestra dos teléfonos con estados distintos del navbar + bottomnav. **No es código para copiar directo**.

La tarea es **recrear este diseño dentro del entorno actual**: React + Vite + CSS Modules. Reemplazar el contenido de:

- `client/src/components/layout/Navbar.jsx`
- `client/src/components/layout/Navbar.module.css`
- `client/src/components/layout/BottomNav.jsx`
- `client/src/components/layout/BottomNav.module.css`

manteniendo intactas todas las integraciones con `useAuth`, `useNotifications`, `useChat`, `useSiteConfig`, los hooks de routing (`useLocation`, `useNavigate`, `Link`) y la lógica actual del scroll/paginación.

---

## Fidelity

**Hi-fi pixel-accurate.** Tokens, fuentes, espacios, badges y animaciones del prototipo son finales.

---

## Componente 1 — `<Navbar />` (top)

### Layout

- Position: `sticky` o `fixed; top: 0; left: 0; right: 0;`
- Background: `var(--bg-card)` (`#151c28`)
- Border-bottom: `1px solid var(--border)` (`#1e2a3d`)
- Padding: `18px 18px 12px`
- Display: `flex; align-items: center; gap: 8px`
- Z-index 100 (sobre el contenido)
- Solo visible en `< 960px` (oculto en desktop donde está el sidebar)

### Brand (flex 1)

```
<Link to="/" class="brand">
  <div class="brandMark">
    <div class="t"><div class="arm"/><div class="stem"/></div>
    <div class="ring"/>
  </div>
  <div class="brandText">
    <span class="brandName">TurnoCero</span>
    <span class="brandSub">◆ board game meetups</span>
  </div>
</Link>
```

**`.brandMark` — chip 38×38:**

- Background: `var(--bg-dark)` (`#0a0d15`)
- Border: `1.5px solid var(--accent-light)` (`#00aeff`)
- Border-radius: 11px
- Box-shadow: `0 3px 12px var(--accent-glow)` (`rgba(24,136,239,0.18)`)
- Flex centrado, gap 2.5px

**T glyph (dentro del chip — 13×17):**

- Position relative, gap 2.5px del ring
- Arm: `absolute; top: 0; left: 0; width: 13px; height: 2.5px; background: #fff; border-radius: 1px`
- Stem: `absolute; top: 0; left: 5.5px; width: 3px; height: 17px; background: #fff; border-radius: 1px`

**Ring 0 (14×14):**

- Border: `2.5px solid var(--accent-light)`
- Border-radius: 50%, `box-sizing: border-box`
- Pip via `::after`: `4px (wait, 3px)` blanco centrado absolute con `transform: translate(-50%, -50%)`

**`.brandName`:**

- Poppins 800, 16px, letter-spacing `-0.035em`, color `var(--text)` (`#fff`), line-height 1.05

**`.brandSub`:**

- JetBrains Mono 500, 8.5px, letter-spacing `0.16em`, color `var(--text-muted)` (`#5a6178`), uppercase
- Margin-top 1px
- Texto: **"◆ board game meetups"**

### Nav actions (flex, gap 6px, flex-shrink 0)

3 `.iconBtn` consecutivos:

1. Chat (sólo si `dmsEnabled`)
2. Bell de notificaciones
3. Logout (con confirmación inline)

**`.iconBtn`:**

- 36×36
- Background transparente
- Border: `1px solid var(--border)`
- Border-radius: 9px
- Color `var(--text-secondary)` (`#a8b4cc`)
- Position relative
- Transición `all 0.2s ease`
- Hover: color `var(--accent-light)`, border `var(--border-accent)`, background `var(--accent-glow)`
- Active (mientras se presiona): `transform: scale(0.95)`
- SVG icon: 16×16 (sin cambios respecto al actual)

**`.iconBtn .badge`:**

- Position absolute, top `-3px`, right `-3px`
- Min-width 16px, height 16px, padding `0 4px`
- Background `var(--red)` (`#f31d77`) — variante default
- Variant `.live`: background `var(--green)` (`#00d984`)
- Color `#fff`
- Border: `1.5px solid var(--bg-card)` (para halo)
- Border-radius: 999px
- Poppins 800, 9.5px, letter-spacing `-0.02em`
- Display grid, place-items center
- Contenido: `count > 9 ? '9+' : count`

### Logout confirmation

Mantener el patrón inline existente. Cuando `confirming === true`:

```
<div class="logoutConfirm">
  <span>¿Salir?</span>
  <button class="confirmYes">Sí</button>
  <button class="confirmNo">No</button>
</div>
```

Layout:

- Background `var(--bg-elevated)` (`#1d2532`)
- Border `1px solid var(--border)`
- Border-radius: 9px
- Padding `4px 8px`
- Display flex, gap 6px, align center

Botones `Sí`/`No`:

- 26×26 mínimo (touch target — aumentar de los 22-24 actuales)
- Poppins 600, 11px
- `.confirmYes`: bg `var(--red)`, color `#fff`, border-radius 6px
- `.confirmNo`: bg transparente, border `var(--border)`, color `var(--text-secondary)`

---

## Componente 2 — `<BottomNav />` (bottom)

### Layout — pill flotante

- Position: `fixed` o `absolute` según el shell
- `left: 12px; right: 12px; bottom: 12px;`
- Background: `rgba(21, 28, 40, 0.94)` (`--bg-card` con alpha)
- `backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px)`
- Border: `1px solid var(--border-strong)` (`#2a3a55`)
- Border-radius: 22px
- Padding: `8px 6px`
- Display: `flex; align-items: center; gap: 4px`
- Box-shadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.5)`
- Z-index 50

### Estructura

```
<nav class="bottomnav">
  <button class="bnArrow" disabled?>◀</button>
  <div class="bnItems">
    <a class="bnItem" data-active="true">...</a>
    <a class="bnItem">...</a>
    <a class="bnItem">...</a>
  </div>
  <button class="bnArrow" disabled?>▶</button>
  <div class="bnPager">
    <span class="dot active"/>
    <span class="dot"/>
    <span class="dot"/>
  </div>
</nav>
```

### Items container — grid 3 cols

- `.bnItems`: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; overflow: hidden; flex: 1`
- `VISIBLE = 3` como en el actual, paginación con `startIndex` igual a la implementación actual.

### Item

```
<a class="bnItem [active] [promo]" href={to}>
  <span class="bnIcon">{Icon}{badge && <span class="bnBadge {variant}">{badge}</span>}</span>
  <span class="bnLabel">{label}</span>
  {variant === 'promo' && <span class="promoTag">NEW</span>}
</a>
```

- Display: `flex; flex-direction: column; align-items: center; gap: 3px`
- Padding: `6px 4px 5px`
- Border-radius: 14px
- Color: `var(--text-muted)`
- Position relative
- Transición `all 0.2s ease`
- Active al presionar: `transform: scale(0.94)`

**`.bnIcon`:**

- 30×30, grid centered
- SVG 22×22 (los del componente actual, sin cambios)
- Position relative para badge

**`.bnLabel`:**

- JetBrains Mono 600, 9.5px, letter-spacing `0.04em`, uppercase
- Line-height 1
- White-space nowrap + ellipsis si excede

**Active state (`.bnItem.active`):**

- Background `var(--accent-glow)` (`rgba(24,136,239,0.18)`)
- Color `var(--accent-light)` (`#00aeff`)
- `::after` indicator debajo del label:
  ```css
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 2px;
  background: var(--accent-light);
  border-radius: 1px;
  ```

### Badge sobre icono — `.bnBadge`

- Position absolute, top `-2px`, right `-4px`
- Min-width 16px, height 16px, padding `0 4px`
- Background `var(--red)` (default) o `var(--green)` (con `.live`)
- Color `#fff`
- Border `1.5px solid var(--bg-card)` (halo de contraste)
- Border-radius 999px
- Poppins 800, 9px, letter-spacing `-0.02em`
- Display grid, place-items center

Counters que poblamos hoy:

- `Compartite`: badge `live` con count de nuevas compartidas no leídas (puede venir de `useNotifications`)
- `Eventos`: badge default con count de eventos próximos urgentes (`< 7 días`)
- `Chat Admin`: badge `urgent` con `adminChatUnread`

### Estado promo — BG Watch CTA cuando user sin `bggUsername`

- Background `var(--purple-10)` (`rgba(180,140,255,0.1)`)
- Border `1px dashed var(--purple-25)` (`rgba(180,140,255,0.3)`)
- Color `var(--purple)` (`#b48cff`)
- `.bnLabel` también color violeta
- **No** muestra el indicator cyan del active (`::after` display none)
- **`.promoTag`:** posición absolute top `-6px`, right `-2px`. Bg `var(--purple)`, color `#fff`, JetBrains Mono 700 7.5px, letter-spacing `0.06em`, padding `2px 5px`, border-radius 4px, uppercase. Texto: **"NEW"**

### Arrows — `.bnArrow`

- 26×44
- Background transparente, sin borde
- Color `var(--text-muted)`
- Display grid centrado
- SVG 16×16 (chevron izquierda/derecha)
- Hover: color `var(--accent-light)`
- Cuando no se puede navegar más: `visibility: hidden` (mantiene espacio reservado)

### Pager dots — `.bnPager`

- Position absolute, bottom `-16px` (debajo del pill flotante)
- Left 50%, transform translateX(-50%)
- Display flex, gap 4px

**`.dot`:**

- 5×5, background `var(--text-faint)` (`#353d52`)
- Border-radius 50%
- Transición `all 0.2s ease`

**`.dot.active`:**

- Background `var(--accent-light)`
- Width 14px, border-radius 3px (pill alargado)

Cantidad de dots = `Math.ceil(items.length / VISIBLE)`. El active es `Math.floor(startIndex / VISIBLE)`.

### Touch / swipe

Mantener exactamente la lógica actual de `handleTouchStart` / `handleTouchEnd` con delta de 50px.

### Mantener: el divider entre sección regular y admin

En el actual hay un `__divider__` entre los items regulares y los admin. En la versión nueva, mejor reemplazarlo por una transición visual: cuando el `startIndex` cruza el límite admin/regular, el background del pill ganaría un tinte naranja sutil (`box-shadow: 0 0 0 1px rgba(245,166,35,0.25)`) o cambiar el `pager dots` activo a naranja. Detalle a definir con el equipo.

---

## State Management

### Context dependencies (sin cambios)

```js
// Navbar
const { logout } = useAuth();
const { unreadCount } = useNotifications();
const { dmUnreadTotal } = useChat();
const { isSectionEnabled } = useSiteConfig();

// BottomNav
const { user, isActuallyAdmin } = useAuth();
const { isSectionEnabled } = useSiteConfig();
const location = useLocation();
const active = getActiveNavId(location.pathname);
```

### Local state (sin cambios)

```js
const [startIndex, setStartIndex] = useState(0);
const [slideDir, setSlideDir] = useState(null);
const touchStartX = useRef(null);
```

La lógica de scroll / paginación / `useEffect` que mantiene el active visible es **idéntica a la actual** — solo cambian los estilos.

---

## Design tokens

Idénticos al handoff del sidebar (ver `design_handoff_sidebar/README.md` para la lista completa). Reuso de:

```css
--bg-dark: #0a0d15;
--bg-card: #151c28;
--bg-paper: #18202f;
--bg-elevated: #1d2532;
--accent: #1888ef;
--accent-light: #00aeff;
--accent-glow: rgba(24, 136, 239, 0.18);
--text: #ffffff;
--text-secondary: #a8b4cc;
--text-muted: #5a6178;
--text-faint: #353d52;
--border: #1e2a3d;
--border-strong: #2a3a55;
--border-accent: rgba(24, 136, 239, 0.4);
--red: #f31d77;
--green: #00d984;
--orange: #f5a623;
--purple: #b48cff;
--purple-10: rgba(180, 140, 255, 0.1);
--purple-25: rgba(180, 140, 255, 0.3);
--t: 0.2s ease;
```

### Typography

- Display: `'Poppins', sans-serif` (500, 600, 700, 800)
- Body: `'Archivo', sans-serif`
- Mono: `'JetBrains Mono', ui-monospace, monospace` (400, 500, 600)

---

## Spacing reference

| Token                               | Valor                      |
| ----------------------------------- | -------------------------- |
| Navbar padding                      | `18px 18px 12px`           |
| Navbar action gap                   | 6px                        |
| BottomNav padding                   | `8px 6px`                  |
| BottomNav inset (left/right/bottom) | 12px                       |
| BottomNav border-radius             | 22px                       |
| Item padding                        | `6px 4px 5px`              |
| Item gap (icon→label)               | 3px                        |
| Item border-radius                  | 14px                       |
| Icon size                           | 22×22 SVG, 30×30 container |
| Badge size                          | 16×16 min                  |

---

## Assets

El logo T0 chip se construye **inline desde primitivas CSS** — sin SVG externo. Ver el bloque `.brandMark` arriba. Los SVG de íconos del bottomnav son los mismos del componente actual; no requieren cambios.

---

## Files

- **`Mobile Reimagined.html`** — prototipo de referencia con dos teléfonos (compartidas activo + eventos con bottomnav paginado).
- **`Sidebar Reimagined.html`** — incluido también, para contexto / vocabulario compartido.

El código de los prototipos es **vanilla HTML/CSS/JS** — re-implementar en React + CSS Modules.

---

## Checklist de implementación

### Navbar

- [ ] Reemplazar el `T` cuadrado por el chip T0 (38×38) con T+anillo CSS-primitives
- [ ] Cambiar `.logoSub` del actual a `◆ board game meetups` mono uppercase 8.5px
- [ ] Convertir `.bellBtn` actual al patrón unificado `.iconBtn` (36×36, border 1px, radius 9)
- [ ] Aplicar `.iconBtn:hover` con color cyan + bg `var(--accent-glow)`
- [ ] Aplicar variant `.live` (verde) al badge de mensajes
- [ ] Aumentar tamaño de touch targets a ≥ 44px efectivos (con padding/margin)

### BottomNav

- [ ] Convertir la barra full-width en pill flotante con inset 12px
- [ ] Agregar `backdrop-filter: blur(20px)`
- [ ] Background `rgba(21,28,40,0.94)` + border-radius 22
- [ ] Cambiar labels a JetBrains Mono uppercase 9.5px
- [ ] Active state: bg `var(--accent-glow)` + `::after` con barrita cyan
- [ ] Implementar badges sobre iconos con variantes default/live
- [ ] Implementar estado promo (BG Watch CTA): bg violeta dashed + pill "NEW"
- [ ] Agregar pager dots debajo del pill, con dot activo elongado
- [ ] Verificar que el shell del app tenga `padding-bottom: 100px` para no tapar contenido
- [ ] Verificar safe-area en iOS (`bottom: max(12px, env(safe-area-inset-bottom))`)
- [ ] Mantener intacta la lógica de swipe + paginación + auto-scroll al active

### Global

- [ ] Asegurar que los tokens (`--accent-glow`, etc.) estén en `index.css` (ya están si el sidebar fue implementado)
- [ ] Probar accesibilidad: focus visible en iconBtn/bnItem, aria-current="page" en active
- [ ] Probar contraste WCAG AA: mono labels 9.5px sobre `--accent-glow` (active state)
- [ ] Verificar en iOS Safari que el backdrop-filter funcione (fallback opcional con bg más opaco)
