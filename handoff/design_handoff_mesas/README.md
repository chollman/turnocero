# Handoff: Mesas reimaginadas · TurnoCero

## Overview

Rediseño completo del módulo **Mesas** de TurnoCero (lista, detalle, creación y
edición de una "mesa" — una convocatoria a jugar un juego de mesa con otra gente).
Reemplaza el flujo actual centrado en `client/src/pages/dashboard/` (Dashboard +
TableCard) y agrega vistas dedicadas para detalle y crear/editar.

Cambios clave respecto del actual:

- **Hero editorial** con eyebrow mono `◆ N mesas activas · fecha`, título display con `<em>` cyan ("Tirá los <em>dados.</em>"), y una **ilustración SVG de mesa felted vista cenital** con 6 sillas alrededor como decoración.
- **Lista agrupada por horizonte** en vez de cronológica plana: **Hoy → Mañana → Esta semana → Próximamente**. Cada sección con header de regla punteada.
- **Cartas tipo "carta de juego"** con banner mosaico geométrico generado deterministicamente del seed del juego (triángulos + círculos + rects sobre gradiente), `aspect-ratio: 16/7`, gradient overlay para legibilidad, fecha-chip flotante con dot pulsante, badges de estado.
- **Seat track** — barra de progreso de jugadores con divisores verticales (uno por cada silla) que muestra visualmente cuántos lugares quedan.
- **Vista cenital de la mesa** en el detalle — SVG con elipse felted, jugadores posicionados con trigonometría alrededor (radii + angle por seat), líneas conectoras del centro a cada silla, host con corona, "vos" con halo verde animado, sillas vacías punteadas.
- **Wizard de 4 pasos** para crear (Juego / Cuándo / Dónde / Detalles) con indicador de progreso superior, autocomplete de juegos populares, tag editor inline, pill selector para nº de jugadores, privacy radio cards.
- **Live preview** a la derecha del wizard — la carta de la mesa se va armando en vivo mientras el usuario completa los campos.
- **Ticket-stub sticky** en el detalle (estilo Eventos), con perforación lateral, CTA contextual según estado (idle → "Unirme" o "Solicitar lugar" según privacy; hosting → bloque admin con Editar/Cancelar; joined → "Estás dentro" + "Abandonar"; pending → "Solicitud enviada" + "Cancelar solicitud"; full → disabled).
- **Solicitudes pendientes** (host-only) — bloque dedicado en el detalle con mensaje del solicitante y botones Aceptar/Rechazar inline.
- **Chat de la mesa** — solo visible para host y jugadores confirmados, bubble UI con avatar + autor + texto + timestamp, input redondo en el footer.
- **Zona delicada** al final del form de edición — bloque rojo dashed para cancelar la mesa con copy explicativo sobre notificación a jugadores ya unidos.

---

## About the Design Files

Los archivos en este bundle son **referencias de diseño** construidas en HTML + JSX
vanilla (Babel standalone) — prototipos que muestran el look final, estados,
animaciones y lógica. **No es código para copiar directo**.

La tarea es **recrear estos diseños dentro del entorno actual de TurnoCero**:
React + Vite + CSS Modules + React Router. Reemplazar / extender:

- `client/src/pages/dashboard/Dashboard.jsx` → nueva `MesasListPage`
- `client/src/pages/dashboard/TableCard.jsx` → nueva `MesaCard` + `MesaRow`
- Crear `client/src/pages/mesas/MesaDetail.jsx`
- Crear `client/src/pages/mesas/MesaCreate.jsx` (re-usable para crear y editar)
- Mover stylesheets a CSS Modules (`MesaCard.module.css`, etc.)

Manteniendo las integraciones existentes con `axios`, `useAuth`, hooks de routing,
y el modelo de datos del backend (que define la entidad `Table` con campos como
`game`, `date`, `location`, `maxPlayers`, `players`, `host`, `privacy`).

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, radios, sombras y
animaciones del prototipo están finalizados. Recrear pixel-perfect usando los
patrones CSS-Module del codebase.

---

## Design tokens (importados desde el sistema reimagined)

Estos tokens vienen del sistema global (`reimagined-styles.css`). El archivo
`mesas-styles.css` los **redeclara y extiende**.

```css
/* Background scale */
--bg-dark:     #0a0d15;
--bg-card:     #151c28;
--bg-elevated: #1d2532;
--bg-deep:     #050810;
--bg-hover:    #232a3a;

/* Brand */
--accent:       #1888ef;
--accent-light: #00aeff;
--accent-dark:  #0076d1;
--accent-glow:  rgba(24, 136, 239, 0.18);

/* Text */
--text-primary:   #ffffff;
--text-secondary: #a8b4cc;
--text-muted:     #5a6178;
--text-faint:     #353d52;

/* Borders */
--border:        #1e2a3d;
--border-strong: #2a3a55;
--border-accent: rgba(24, 136, 239, 0.4);

/* Status palette + glows */
--red:    #f31d77;   --red-10:    rgba(243,29,119,0.10);  --red-25:    rgba(243,29,119,0.25);
--green:  #00d984;   --green-10:  rgba(0,217,132,0.10);   --green-25:  rgba(0,217,132,0.25);  --green-glow: rgba(0,217,132,0.18);
--orange: #f5a623;   --orange-10: rgba(245,166,35,0.10);  --orange-25: rgba(245,166,35,0.30);
--purple: #b48cff;   --purple-10: rgba(180,140,255,0.10); --purple-25: rgba(180,140,255,0.30);

/* Type families */
--font-display: 'Poppins', sans-serif;        /* headings, números grandes */
--font-body:    'Archivo', sans-serif;        /* body text */
--font-mono:    'JetBrains Mono', monospace;  /* eyebrows, labels, badges, timestamps */

/* Transition */
--t: 0.2s ease;
```

### Estados visuales por `userState` (estado del usuario respecto a la mesa)

| userState  | Acento visual                        | Border de card                  | CTA                                                    |
| ---------- | ------------------------------------ | ------------------------------- | ------------------------------------------------------ |
| `idle`     | neutro                               | `var(--border)`                 | `Unirme` (público) o `Solicitar →` (privado)           |
| `hosting`  | naranja (`--orange`)                 | `var(--orange-25)`              | `Administrar →` (ghost naranja)                        |
| `joined`   | verde (`--green`)                    | `var(--green-25)`               | `✓ Unido` (ghost verde)                                |
| `pending`  | violeta (`--purple`)                 | `var(--purple-25)`              | `Solicitud enviada` (ghost violeta)                    |
| `full`     | rojo (`--red`) en seat track + `Llena` chip | igual al base, `opacity: 0.85`   | `Mesa llena` (disabled)                                |

---

## Modelo de datos (mock — ver `mesas-shared.jsx`)

```ts
type Mesa = {
  _id: string;
  game: string;                    // "Catan", "Terraforming Mars"…
  gameSeed: number;                // determina el mosaico — hash del nombre
  date: string;                    // ISO datetime
  location: string;                // "Café Rivas · Palermo"
  maxPlayers: number;              // 2..8 (incluye host)
  privacy: 'public' | 'private';
  description: string;
  rules: string;
  tags: string[];                  // ["Estrategia", "Largo", "120-180min"]
  host: {
    name: string; handle: string;
    initial: string; color: string;
    rating: number; games: number;
  };
  players: Array<{                 // sin contar el host
    name: string; handle?: string;
    initial: string; color: string;
    isYou?: boolean;
  }>;
  pending: Array<{                 // solicitudes que esperan aprobación (host-only)
    name: string; handle: string;
    initial: string; color: string;
    message: string;
  }>;
  userState: 'idle' | 'hosting' | 'joined' | 'pending' | 'full';
  chat: Array<{
    from: { name: string; initial: string; color: string; isYou?: boolean };
    text: string;
    time: string;
  }>;
};
```

`filled = players.length + 1` (host se cuenta como ocupado).
`open = maxPlayers - filled`.
`isFull = open <= 0`.

---

## Pantalla 1 — Lista (`MesasListPage`)

### Layout general

```
<page max-width: 1200px; padding: 32px 28px 80px>
  <MesaHero>                       ← editorial, 1.4fr / 1fr
  <MesaControls>                   ← chips + search + view toggle + new btn
  <HorizonGroup horizon="today">
    <HorizonHeader />
    <MesaGrid | MesaList />
  </HorizonGroup>
  …
</page>
```

### `<MesaHero>`

Grid 2 cols (`1.4fr 1fr`), gap 36px, border-bottom 1px + padding-bottom 32px + margin-bottom 32px.

**Left** — flex column gap 14px, justify-content center:
- Eyebrow: mono 11px / 0.18em / `var(--accent-light)` con rule-line `::before` de 28×1px. Texto: `◆ {N} mesas activas · {fecha actual}`
- H1: Poppins 700, `clamp(2.6rem, 5vw, 4.2rem)`, letter-spacing -0.05em, line-height 0.9, balance. **"Tirá los <em>dados.</em>"** (`<em>` con `font-style: normal; color: var(--accent-light)`)
- Sub: 0.95rem, color secondary, max-width 480px, line-height 1.5

**Right** — `.feltedTablePreview` aspect-ratio 1.4, max-width 380px, margin-inline auto. SVG con:
- `<ellipse>` cx=50 cy=45 rx=42 ry=28 fill `radialGradient(#1d3a2a → #162a1f → #0a1410)`, stroke `rgba(24,136,239,0.3)` 0.3px
- Pattern overlay de dots `rgba(255,255,255,0.04)`
- Anillo interno punteado `rgba(255,255,255,0.05)`
- Dado en el centro: rect 8×8 transparente con stroke cyan + 2 pips
- 6 sillas posicionadas en `{ x: 50/86/86/50/14/14, y: 6/25/65/84/65/25 }`, cada una circle r=6.5 con iniciales coloreadas

### `<MesaControls>`

Flex wrap, gap 14px, justify-content space-between, margin-bottom 28px.

#### Filter chips (existing `.chip` style)

`var(--bg-card)` transparent / `var(--border)` / Mono 11px 0.06em uppercase / padding 7×13px / border-radius 999px. Active: bg `var(--accent)`, border `var(--accent)`, color `#fff`. Cada chip muestra `{label} · {count}` con count opacity 0.6.

Filtros:
- `all` — Todas
- `mine` — Mis mesas (hosting OR joined OR pending)
- `host` — Hosting
- `joined` — Jugando
- `open` — Con lugar (open > 0)
- `public` — Públicas

#### Search (existing `.search` style)

Background search-icon SVG inline, width 240px, padding `9px 13px 9px 36px`. Filtra por `game`, `location`, `host.name` (case-insensitive).

#### View toggle

2 botones (`Grid` / `List` icons), border + padding 3px, active bg `var(--bg-elevated)` color `var(--accent-light)`.

#### New mesa button (`.newBtn`)

Background `var(--accent)`, padding `9px 16px`, border-radius 8px, Poppins 700 13px, shadow `0 4px 16px var(--accent-glow)`. Icon `Plus` + texto **"Crear mesa"**.

### `<HorizonGroup>`

4 categorías derivadas de la fecha (ver `mesasHorizon()` helper):
- **`today`** — diff < 1 día → label "Hoy" en cyan (`var(--accent-light)`)
- **`tomorrow`** — diff = 1 día → "Mañana"
- **`thisWeek`** — diff ≤ 7 días → "Esta semana"
- **`later`** — diff > 7 días → "Próximamente"

Solo renderizar grupos con `items.length > 0`. Ordenar items dentro del grupo por `date` ascendente.

#### `<HorizonHeader>`

Flex baseline, gap 16px, margin-bottom 14px, padding-bottom 10px, border-bottom 1px dashed `var(--border)`.

- `.hLabel`: Mono 10px 0.18em uppercase `var(--text-muted)` — "Horizonte"
- `.hName`: Poppins 700, 1.6rem, ls -0.03em. Color base `var(--text-primary)`; en `today` cambia a `var(--accent-light)`
- `.hSub`: Mono 11px `var(--text-muted)` — "a punto de empezar" / "24 horas" / "próximos 7 días" / "más adelante"
- `.hRule`: flex 1, height 1px, `var(--border)`
- `.hCount`: Mono 10px 0.12em uppercase — `{N} mesa{s}`

---

## Componente: `<MesaCard>` (grid view)

### Estructura

```
.mesaCard
  .mesaBanner (aspect 16/7)
    <MesaTile> (SVG mosaic)
    .mesaBannerGradient (overlay)
    .mesaBannerTop
      .mesaDateChip
      .mesaBannerBadges (host / joined / pending / lock)
  .mesaCardBody
    h3.mesaCardGame
    .mesaCardLoc
    .mesaTags
    .seatSection
      .seatHead (label + count)
      .seatTrack (.seatFill + dividers)
    .mesaCardFoot
      .mesaHostBlock
      .mesaCta
```

### Card container

- `background: var(--bg-card)`, `border: 1px solid var(--border)`, `border-radius: 14px`, `overflow: hidden`
- Cursor pointer, animation `rowEnter 0.4s ease both` con delay `calc(var(--i) * 50ms)`
- Hover: `translateY(-3px)`, border `var(--border-accent)`, shadow `0 16px 40px rgba(0,0,0,0.4)`
- Si `userState === 'hosting'` → border `var(--orange-25)`; `joined` → `var(--green-25)`; `pending` → `var(--purple-25)`; `full` → opacity 0.85
- Si `privacy === 'private'` → `::after` con repeating-linear-gradient 45° de violeta `rgba(180,140,255,0.04)`, z-index 0, pointer-events none

### Banner (`<MesaTile>`)

Componente SVG determinista que genera un mosaico desde `seed`:
- `viewBox="0 0 100 67"`, `preserveAspectRatio="xMidYMid slice"`
- Paleta: array de 6 trios `[primary, dark, light]`. Index = `seed % 6`:
  - `[#1888ef, #0076d1, #00aeff]` — azul
  - `[#b48cff, #7a4dff, #d4baff]` — violeta
  - `[#f5a623, #d48800, #ffcd6b]` — naranja
  - `[#00d984, #00a565, #5dffbe]` — verde
  - `[#f31d77, #b50054, #ff6cb0]` — rosa
  - `[#00aeff, #1888ef, #9ad3ff]` — cyan
- Background: `linearGradient` 135° de `colors[1]` a `#0a0d15`
- Grid 6×4 cells. PRNG simple sembrado por `seed`. Para cada celda:
  - rand > 0.7 → triángulo (polygon) coloreado `colors[colorIdx]`, opacity 0.7-1
  - rand > 0.45 → círculo r=min(w,h)*0.35 centrado, opacity 0.6-0.95
  - rand > 0.25 → rect interno (15% padding), rx 2, opacity 0.5-0.9
  - rand ≤ 0.25 → vacío (transparente)

Ver implementación exacta en `mesas-shared.jsx` → `MesaTile()`.

### `.mesaBannerGradient`

`position: absolute; inset: 0; z-index: 1`. Linear-gradient `180deg, rgba(0,0,0,0) 30%, rgba(18,24,38,0.7) 75%, var(--bg-card) 100%`. Esto funde el banner con el body de la card.

### `.mesaBannerTop`

Flex space-between, gap 6px, padding 10px (top/left/right), z-index 2.

#### `.mesaDateChip`

- Inline-flex gap 6px, padding `5px 10px`, border-radius 999px
- Background `rgba(10,13,21,0.78)` + backdrop-filter blur 8px
- Border `1px solid var(--border-strong)`
- Mono 10.5px 700 0.06em uppercase, color `var(--text-primary)`
- `::before` dot 5×5 `var(--accent-light)` con `pulse 2s ease-in-out infinite`
- Variantes: `.urgent` → dot rojo; `.past` → dot muted sin animar
- Contenido: `{weekday} · {day} {month} · {time}` → ej "MAR · 19 MAY · 19:30"

#### `.mesaBannerBadges`

Flex wrap gap 4px, justify-content flex-end.

`.mesaBadge` base: Mono 9.5px 700 0.1em uppercase, padding `3px 7px`, border-radius 4px, backdrop-filter blur 8px.

Variantes:
- `.host` → bg `rgba(245,166,35,0.85)`, color `#1a1208`, border naranja — texto "Host"
- `.joined` → bg `rgba(0,217,132,0.85)`, color `#00201a`, border verde — "Unido"
- `.pending` → bg `rgba(180,140,255,0.85)`, color `#1a0a30`, border violeta — "Pendiente"
- `.lock` → bg `rgba(10,13,21,0.78)`, border strong, color secondary, padding `3px 6px` (más chico), icono Lock 10×10

### `.mesaCardBody`

Padding `12px 14px 14px`, flex column gap 8px, z-index 2.

- `h3.mesaCardGame`: Poppins 700, 1.25rem, ls -0.025em, line-height 1.15, balance, color primary, margin 0
- `.mesaCardLoc`: flex gap 6px, font 12.5px, color secondary. Icon `Pin` 12×12 muted
- `.mesaTags`: flex wrap gap 4px, margin-top 2px
  - `.mesaTag`: bg `var(--bg-elevated)`, border `var(--border)`, color muted, padding `2px 7px`, br 4px, Mono 9.5px 0.04em
- `.seatSection`: ver abajo
- `.mesaCardFoot`: ver abajo

### `.seatSection` (componente clave — barra de progreso de lugares)

Margin-top 4px, flex column gap 5px.

#### `.seatHead`

Flex space-between baseline.
- Left: Mono 9.5px 0.12em uppercase muted — "Lugares"
- Right: Poppins 700 12px ls -0.02em color primary — `{filled}/{maxPlayers}` ej "2/4"

#### `.seatTrack`

- Position relative, height 6px, bg `var(--bg-deep)`, border-radius 999px, overflow hidden
- Border `1px solid var(--border)`
- `.seatFill`: position absolute inset auto-0-0-0, linear-gradient 90° `var(--accent) → var(--accent-light)`, shadow `0 0 10px var(--accent-glow)`, transition width 0.4s
  - Variante `.full` → bg `var(--red)`, shadow rojo
- `.seatDivider`: rect 1×100% vertical (`background: rgba(10,13,21,0.85)`, z-index 1) posicionado en cada `(i+1)/maxPlayers * 100%` para visualmente separar las "sillas"

### `.mesaCardFoot`

Flex gap 10px, margin-top 8px, padding-top 10px, border-top `1px dashed var(--border)`.

#### `.mesaHostBlock`

Flex gap 9px, flex 1, min-width 0.

- **Avatar**: 32×32 cuadrado redondeado br 10px, bg `host.color`, Poppins 800 13px blanco centrado — `host.initial`
- `.mesaHostInfo`: flex column min-width 0
  - `.mesaHostLabel`: Mono 9px 0.12em uppercase muted — "Host"
  - `.mesaHostName`: Poppins 600 12.5px ls -0.015em primary, ellipsis — `host.name`
  - `.mesaStatusChip`: Mono 9px, color verde (o rojo si `.full`), `::before` dot 5×5 — `"{N} libre(s)"` o `"Llena"`

#### `.mesaCta`

Background `var(--accent)`, padding `7px 13px`, br 7px, Poppins 700 11.5px 0.02em, shadow `0 4px 12px var(--accent-glow)`, white-space nowrap, flex-shrink 0.

Variantes (ver tabla de userState arriba):
- `.ghost` → transparent, border strong, color primary — para "Administrar →"
- `.host` → bg orange-10, color orange, border orange-25
- `.joined-cta` → bg green-10, color green, border green-25, con Check icon
- `.pending-cta` → bg purple-10, color purple, border purple-25
- `.disabled` → bg deep, color muted, border muted, cursor not-allowed

---

## Componente: `<MesaRow>` (list view)

Mismo dato, layout horizontal. Grid `60px 1fr auto auto`, gap 18px, padding `12px 14px`, bg `var(--bg-card)`, border `1px solid var(--border)`, border-radius 12px.

- **Date block** (60px): Poppins 800 2rem día, Mono 9.5px cyan mes, Mono 10px muted hora
- **Body**: game name (Poppins 700 1.1rem) + meta line con `Pin`, `Users`, `Lock`, host
- **Seats** (min-width 100px, align flex-end): seat count (Poppins 700 14px) + seat track 90×4px
- **CTA**: idem grid card

Mobile (≤ 980px): `grid-template-columns: 60px 1fr`, seats salta a full-width abajo.

---

## Pantalla 2 — Detalle (`MesaDetail`)

### Layout

```
<page>
  <button.detailBack>             ← "← Volver al listado"
  <.mesaDetailLayout>             ← grid 1fr 360px gap 36
    <main.mesaDetailMain>
      <.detailBanner>             ← banner mosaico 21/8
      <.detailMetaRow>            ← 4 cells (Cuándo, Dónde, Jugadores, Privacidad)
      <section.detailSec>         ← Descripción
      <section.detailSec>         ← Reglas
      <section.detailSec>         ← Alrededor de la mesa ⭐
      <section.detailSec>         ← Solicitudes pendientes (host-only)
      <section.detailSec>         ← Chat (host/joined-only)
    </main>
    <aside>
      <.mesaStub>                 ← sticky ticket-stub
    </aside>
  </.mesaDetailLayout>
</page>
```

### `.detailBanner`

Aspect-ratio 21/8, border-radius 18px, overflow hidden, margin-bottom 24px, border 1px.
- SVG mosaic full-bleed (mismo `MesaTile` que la card)
- `.detailBannerOverlay`: linear-gradient 180deg `rgba(0,0,0,0.1) 0% → rgba(10,13,21,0.4) 60% → rgba(10,13,21,0.95) 100%`
- `.detailBannerContent`: position absolute bottom 24px, left/right 28px, flex space-between gap 16px
  - **Left**: eyebrow cyan + h1 (`clamp(2rem, 4vw, 3.2rem)` Poppins 800 -0.045em blanco con `text-shadow: 0 2px 16px rgba(0,0,0,0.6)`) + tags
  - **Right**: date chip — Mono 12px 600 uppercase blanco, `rgba(10,13,21,0.7)` blur 8px, padding `6px 12px`, br 999px

### `.detailMetaRow`

Flex, padding 14px 0, border-top + border-bottom 1px `var(--border)`, margin-bottom 28px.

4 `.cell` con `flex: 1 1 0`, padding `0 20px`, border-right 1px (excepto última). Cada cell:
- `.label`: Mono 10px 0.15em uppercase muted
- `.value`: Poppins 600 14px ls -0.01em primary
- `.value.accent`: cyan, Mono 13px 500 — para subvalores tipo "17:00 hs", "mesa llena", etc.

Celdas: **Cuándo** (weekday + day + month + time) · **Dónde** (location) · **Jugadores** (filled/total + libre/llena) · **Privacidad** (Pública/Privada + sub).

### `.detailSec` (sección genérica)

Margin-bottom 40px.

`.detailSecHead`: flex baseline gap 12px, margin-bottom 14px.
- `.lbl`: Mono 10px 0.18em uppercase muted — "◆ Sobre la partida"
- `.rule`: flex 1 height 1px `var(--border)`
- `.count` (opcional): Mono 10px 0.12em uppercase muted

`.detailText`: 14.5px line-height 1.65 color secondary, margin 0.

### ⭐ Sección "Alrededor de la mesa" — round-table top-down view

#### `.tableMapWrap`

Container: bg radial cyan + `var(--bg-card)`, border 1px, br 16px, padding 24px, flex column gap 14px.

#### `.tableMapLegend`

Flex gap 16px, Mono 10px 0.06em uppercase muted.
4 entries: Host (dot orange) · Jugador (dot accent) · Vos (dot green con halo) · Libre (dot transparent dashed muted).

#### `.tableMap` — SVG (lo más diferenciador del módulo)

Container: width 100%, aspect-ratio 1, max-width 480px, margin auto.

**SVG viewBox `0 0 100 100`**. Centro `(50, 50)`. Construir un array `seats` con todos los espacios:
```js
seats = [
  { kind: 'host',   user: mesa.host },
  ...mesa.players.map(p => ({ kind: p.isYou ? 'you' : 'player', user: p })),
  ...range(open).map(() => ({ kind: 'empty', user: null }))
];
```

Posicionar cada seat alrededor de una elipse rx=32 ry=30, con un offset extra hacia afuera de 12:
```js
seats.forEach((s, i) => {
  const angle = (i / totalSeats) * 2π - π/2;  // empieza arriba
  s.x = cx + (rx + seatOffset) * cos(angle);
  s.y = cy + (ry + seatOffset) * sin(angle);
  s.lx = cx + (rx + seatOffset + 6) * cos(angle);  // label position
  s.ly = cy + (ry + seatOffset + 6) * sin(angle);
});
```

Renderizar capas:
1. **Wood ring** (mesa): `<ellipse cx=50 cy=50 rx=36 ry=33 fill="#2a1f15" stroke="#1a1108" stroke-width=0.4>`
2. **Felt surface**: `<ellipse cx=50 cy=50 rx=32 ry=30 fill="url(#feltGrad)" stroke="rgba(24,136,239,0.2)" stroke-width=0.3>`
   - `feltGrad`: radial 50% 50% 60%, stops `#1d3a2a → #162a1f → #0e1a14`
3. **Pattern overlay**: dots `rgba(255,255,255,0.05)` r=0.3 cada 2.5px
4. **Inner decoration ring**: `<ellipse rx=26 ry=25 fill="none" stroke="rgba(255,255,255,0.06)" stroke-dasharray="1.5 1.5">`
5. **Center game tile**: rect 18×12 `rgba(10,13,21,0.5)` con stroke cyan + text "{game}" (Poppins 700 2.4px `rgba(255,255,255,0.4)`) + sub "◆ MESA" cyan
6. **Para cada seat**:
   - **Connection line** desde `seat.{x,y}` a `(cx + rx*cos(angle), cy + ry*sin(angle))`, stroke `user.color` (o muted si empty), width 0.4, dashed si empty, opacity 0.5-0.7
   - Si **`isYou`** → halo extra: `<circle r={seatRadius+1.5} fill="none" stroke="var(--green)" stroke-width=0.8 stroke-dasharray="1 1">` con `<animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite">`
   - **Seat circle**: r=7, fill `user.color` (transparent si empty), stroke `rgba(10,13,21,0.9)` (dasharray "0.8 0.8" si empty), shadow via filter `seatShadow` (feDropShadow dy=0.6 stdDev=0.5)
   - **Initial**: Poppins 800 5.5px blanco centrado (opacity 0.4 si empty con "?")
   - **Host crown** (kind host only): text "♦ HOST" Mono 2.4px naranja 700 0.06em, posicionado encima del seat
   - **Name label** (en posición `lx, ly`): Mono 2.6px, color según kind (orange host / green you / muted+italic empty / secondary player), texto `@{handle}` o `name`

#### `.playersList` (debajo del mapa SVG)

Flex column gap 8px, margin-top 12px. Cada `.playerRow` es bg `var(--bg-elevated)`, border 1px, br 10px, padding `10px 14px`:
- Avatar 36×36 br 10px Poppins 800 13px
- Info: name (Poppins 600 14px) + handle (Mono 11px muted)
- Role chip: Mono 9.5px 0.1em uppercase, padding `3px 8px`, border 1px br 4px — variantes "Host" (naranja), "Vos" (verde), "Jugador" (neutral)
- Rows variant: `.host` border orange-25 + gradient sutil; `.you` border green-25

`.emptySeatRow` (lugar vacío):
- Border `1.5px dashed var(--border-strong)`, color muted
- Icon container 36×36 br 10px bg deep
- Label: Mono 12px 0.04em — "Lugar libre · esperando jugador"

### Solicitudes pendientes (`isHost && pending.length > 0`)

Section con header en violeta (`var(--purple)` en lbl + count).

`.pendingReq`: flex gap 12px, padding `12px 14px`, bg card + linear-gradient violeta sutil, border 1px purple-25, br 11px.
- Avatar 36×36
- Body: name + handle + `.pendingReqMsg` (12.5px italic secondary, o muted "Sin mensaje adjunto" si vacío)
- Actions: `.pendingBtnReject` (transparent + border-strong, hover rojo) y `.pendingBtnAccept` (bg verde, color `#001712`)

### Chat (`isHost || isJoined`)

`.chatPreview`: bg card, border 1px, br 14px, padding 14px, flex column gap 10px.

`.chatRow`: flex gap 10px align-items flex-start. Variante `.own` → flex-direction row-reverse.

- `.chatAv`: 28×28 br 9px Poppins 800 11px
- `.chatBubble`: bg `var(--bg-elevated)`, border 1px, br 12px, padding `8px 12px`, max-width 78%
  - En `.own`: bg `var(--accent-glow)`, border `var(--border-accent)`
  - Author (Poppins 600 11px primary), text (13px secondary), time (Mono 9px muted, align-self flex-end)
- `.chatForm` (input + submit): padding-top 10px border-top dashed
  - `.chatInput`: bg elevated, border 1px, br 999px, padding `8px 14px`, focus border-accent
  - `.chatSubmit`: 34×34 bg accent, br 999px, shadow accent-glow, icon Send 13×13

### `.mesaStub` (sticky aside, 360px width)

Position sticky top 80px. Estilo idéntico al `ticketStub` de Eventos pero renombrado.

```
.mesaStubTop (radial accent + linear navy)
  .mesaStubLabel "◆ Esta mesa"
  .mesaStubDateRow
    .mesaStubDay (Poppins 800 4.2rem)
    .mesaStubMonth (.m Poppins 700 1.15rem, .w Mono uppercase muted)
  .mesaStubTime "⏱ {time} hs"
  .mesaStubCountdown (chip pulsante: accent normal, urgent rojo, soon naranja)

.mesaStubTear (perforación: 14px height, 2 semicírculos laterales + dashed line)

.mesaStubBottom
  .mesaStubRow x4 (Juego, Lugar, Jugadores, Acceso)
  .seatTrack 6px (compartido con la card)
  .mesaStubCtaBlock (CTA según userState)
  .mesaStubHostActions (solo si hosting — bloque naranja dashed con Editar / Cancelar)
```

CTAs por estado (todos width 100%):
- `idle` → `.mesaStubCta` bg accent — "Unirme a la mesa" o "Solicitar lugar" (si privada)
- `hosting` → `.mesaStubCtaState.hosting` (bg orange-10) con crown icon + "Sos el host" + sub "{N} solicitud(es) para revisar" o "Mesa al día" + bloque admin
- `joined` → `.mesaStubCtaState.joined` (bg green-10) + Check icon + "Estás dentro" + `.mesaStubGhost` "Abandonar mesa"
- `pending` → `.mesaStubCtaState.pending` (bg purple-10) + Clock icon + "Solicitud enviada" + ghost "Cancelar solicitud"
- `full` → `.mesaStubGhost` disabled "Mesa llena"

---

## Pantalla 3 — Crear (`MesaCreate`)

### Layout

```
<page>
  <button.detailBack>             ← "Cancelar y volver"
  <.editorialHero>                ← H1 "Armá la convocatoria." + step counter
  <.createLayout>                 ← grid 1fr 360px gap 36
    <main.createForm>
      <.createSteps>              ← stepper 4 dots
      <.createSection>            ← Paso 1: Juego (game name + tags)
      <.createSection>            ← Paso 2: Cuándo (date + time)
      <.createSection>            ← Paso 3: Dónde (location)
      <.createSection>            ← Paso 4: Detalles (maxPlayers + privacy + desc + rules)
      <.createFooter>             ← Cancelar / Borrador / Publicar
    </main>
    <aside.previewWrap>           ← sticky live preview card
  </.createLayout>
</page>
```

### Stepper (`.createSteps`)

Flex, gap 0, position relative, padding `0 4px`, margin-bottom 24px.
- `::before` line absolute `left 22px / right 22px / top 14px / height 1px / bg border`
- Cada `.createStep` (flex 1, flex column align center gap 8px):
  - `.createStepDot` (28×28 br 50%) — bg elevated, border 1.5px border, color muted, Poppins 700 12px
  - Active: bg accent, border accent, color `#fff`, box-shadow `0 0 0 4px var(--accent-glow)`
  - Done: bg green, border green, color `#001712`, contenido = Check icon
  - `.createStepLabel`: Mono 10px 0.1em uppercase, muted base, cyan active, green done

Lógica `activeStep`: primer índice donde `!stepDone[key]`.
- `stepDone.juego` = `!!game.trim()`
- `stepDone.cuando` = `!!date && !!time`
- `stepDone.donde` = `!!location.trim()`
- `stepDone.detalles` = `maxPlayers && privacy`

### `.createSection`

Bg `var(--bg-card)`, border 1px, br 14px, padding `22px 24px`, margin-bottom 18px.

`.createSectionHead`: margin-bottom 18px, padding-bottom 12px, border-bottom dashed.
- `.createSectionLabel`: Mono 10px 0.18em uppercase cyan — "◆ Paso N"
- `.createSectionTitle`: Poppins 700 1.2rem ls -0.025em primary

### `.createField` (block)

Flex column gap 7px, margin-bottom 20px.
- `label`: Mono 10px 0.15em uppercase muted, `.req` span con color rojo para asteriscos
- `.createInput`, `.createTextarea`, `.createSelect`: bg card, border 1px, br 9px, padding `11px 13px`, font 14px
  - Focus: border accent, box-shadow `0 0 0 3px var(--accent-glow)`
- `.createTextarea`: resize vertical, min-height 88px, line-height 1.5
- `.createFieldHelp`: Mono 10px muted 0.04em (texto de ayuda debajo)

### Paso 1 · Juego

#### Autocomplete

Lista popover absolute bajo el input, bg elevated + border strong, br 10px, padding 6px, shadow drop. Items: button block ancho completo, padding `8px 10px`, hover bg card. Prefix "◆ " cyan.

Lista de juegos populares para sugerir (`POPULAR_GAMES`):
```
Catan, Terraforming Mars, Wingspan, Gloomhaven, Brass: Birmingham,
Spirit Island, Root, Ark Nova, Carcassonne, 7 Wonders Duel,
Azul, Twilight Imperium, Scythe, Concordia, Dune: Imperium
```

#### Tag editor

`.tagEditor`: flex wrap gap 5px, padding 9px, bg card + border 1px, br 9px, min-height 42px.
- `.tagChip`: inline-flex gap 4px, bg accent-glow, border border-accent, color accent-light, padding `3px 9px`, br 4px, Mono 11px 0.04em. Con botón × (transparent, opacity 0.7).
- `input` interno: flex 1 min-width 100px, transparent, padding `4px 0`, font 13px.

Lógica:
- Enter agrega tag (si no duplicado, max 5)
- Backspace en input vacío borra última tag

### Paso 2 · Cuándo

`.createFieldRow`: grid 2 cols gap 14px → fecha (input type="date") + hora (input type="time").

### Paso 3 · Dónde

Input simple para location.

### Paso 4 · Detalles

#### Pill selector — Jugadores totales

```
<.pillGroup>
  <button.pillBtn>2</button>
  …
  <button.pillBtn.active>4</button>
  …
  <button.pillBtn>8</button>
</.pillGroup>
```

`.pillBtn`: bg elevated, border 1px, color secondary, padding `9px 16px`, br 999px, Mono 12px 0.04em, min-width 48px. Active: bg accent, border accent, color `#fff`.

Help text dinámico: `"{maxPlayers - 1} lugares libres para convocar"`.

#### Privacy radio cards

`.privacyOptions`: grid 2 cols gap 12px.

`.privacyCard`: flex gap 12px, padding 14px, bg elevated, border `1.5px solid var(--border)`, br 12px, cursor pointer, text-align left.
- Icon (Globe / Lock) 20×20 cyan, flex-shrink 0
- Body: title (Poppins 700 14px primary) + sub (12px muted)
- Active: border accent, bg accent-glow

Mobile: grid 1 col.

#### Description + Rules

Dos `.createTextarea` con placeholders descriptivos:
- Description: "¿Qué tipo de partida es? ¿Apto principiantes? ¿Tono competitivo o relajado?"
- Rules: "Llegar 10 min antes. Cada uno trae algo para picar. Sin alianzas. Apagamos celulares."

### `.createFooter`

Flex space-between gap 14px, margin-top 24px, padding-top 22px, border-top 1px.

- `.btnDraft` (left): "Cancelar" (transparent + border-strong + secondary, Poppins 600 13px)
- `.createFooterRight` (right): flex gap 10px
  - `.btnDraft` "Guardar borrador"
  - `.btnPublish` "Publicar mesa →" (bg accent, shadow accent-glow, Poppins 700 13px)
  - `.btnPublish:disabled` cuando faltan juego/cuándo/dónde

### `.previewWrap` (live preview sticky)

```
<aside.previewWrap (position sticky top 80px, flex column gap 12px)>
  <.previewLabel>            ← "◆ Tu carta · vista previa en vivo" con rule-line cyan
  <MesaCard mesa={previewMesa} />   ← misma card del listado, animation: none
  <.previewNote>             ← "Así se ve tu mesa en el listado de la comunidad"
</aside>
```

`previewMesa` se computa con `useMemo` desde los campos del form:
```js
{
  _id: 'preview',
  game: game || 'Tu juego',
  gameSeed: hashStr(game || 'preview'),
  date: `${date}T${time}:00`,
  location: location || 'Por confirmar',
  maxPlayers, privacy, description, rules, tags,
  host: { name: 'Vos', handle: 'voslohaces', initial: 'V', color: '#1888ef' },
  players: [],
  userState: 'hosting',
}
```

`hashStr`: hash simple (`h = (h * 31 + charCode) >>> 0`) modulo 20 — para que el mosaico cambie en vivo conforme el usuario tipea.

---

## Pantalla 4 — Editar (`MesaCreate` con `editMode={true}`)

**Mismo componente** que Crear. Diferencias:

- Recibe `mesaToEdit` y pre-rellena todos los campos desde ahí
- Back button: "Cancelar edición"
- H1: "Ajustá tu **convocatoria**." (en vez de "Armá la convocatoria.")
- Sub: "Los cambios se notifican a quienes ya están unidos. La carta de la derecha se actualiza en vivo."
- Footer: no muestra "Guardar borrador"; el publish button dice "Guardar cambios →"
- **Danger zone al final**:

```html
<div class="dangerZone">
  <div class="dangerZoneLabel">◆ Zona delicada</div>
  <div class="dangerZoneTitle">Cancelar la mesa</div>
  <p class="dangerZoneSub">
    Esta acción no se puede deshacer. Los {N} jugadores que ya se sumaron van a
    recibir una notificación con tu motivo.
  </p>
  <button class="dangerBtn">
    <Trash icon /> Cancelar mesa
  </button>
</div>
```

`.dangerZone`: bg `var(--red-10)`, border 1px dashed `var(--red-25)`, br 14px, padding `20px 22px`, margin-top 24px.
`.dangerBtn`: transparent, color rojo, border red-25, padding `9px 16px`, br 8px, Poppins 700 12px 0.03em uppercase. Hover: bg rojo, color blanco.

---

## Interacciones & comportamiento

### Lista
- Click en card / row → navega a detail (`/mesas/{id}`)
- Click en "Crear mesa" / FAB → `/mesas/crear`
- Search: filtro client-side debounced por `game | location | host.name`
- Filter chips: filtra MESAS según `countFor(mesa) => boolean`
- View toggle: grid ↔ list (persistir en localStorage como `mesasViewMode`)
- Hover card: `translateY(-3px)` 200ms, border + shadow cambian
- Entrada de cada card: `rowEnter 0.4s` con delay escalonado `i * 50ms`

### Detail
- Back → `/mesas`
- Botones "Editar" (host) → `/mesas/{id}/editar`
- Aceptar solicitud → POST `/api/tables/{id}/accept/{userId}` → remueve del array `pending`
- Rechazar → POST `/api/tables/{id}/reject/{userId}` → idem
- "Abandonar mesa" → confirmation dialog → DELETE `/api/tables/{id}/players/me` → vuelve a lista con toast
- "Cancelar solicitud" (pending) → DELETE `/api/tables/{id}/pending/me`
- "Unirme" (público) → POST `/api/tables/{id}/join`
- "Solicitar lugar" (privado) → modal con campo "message" → POST `/api/tables/{id}/request` con body `{ message }`
- Chat submit: POST `/api/tables/{id}/chat` con body `{ text }` → optimistic update
- Click en seat del SVG: pop-out con info del jugador o, si es vacío y mesa pública, CTA inline para unirse

### Create / Edit
- Active step se calcula automáticamente del primer `stepDone` que sea falso
- Cada `useState` actualiza `previewMesa` vía `useMemo` → carta se redibuja instantáneamente
- Autocomplete de juego: case-insensitive `.includes()`, max 5 resultados, oculta cuando blur+150ms (para dar tiempo al click)
- Tag editor: Enter agrega (validando no duplicado y < 5), Backspace borra última si input vacío
- Pill selector: click cambia `maxPlayers`
- Privacy cards: click cambia `privacy`
- "Publicar mesa" disabled hasta que `juego && cuando && donde` estén completos
- Submit:
  - Crear → POST `/api/tables` con todos los fields → redirect a `/mesas/{newId}`
  - Editar → PUT `/api/tables/{id}` → redirect a `/mesas/{id}` con toast
- "Guardar borrador" → POST `/api/tables/draft` (status: 'draft') → toast → quedarse en form
- Danger zone "Cancelar mesa" → confirmation dialog → POST `/api/tables/{id}/cancel` con motivo → redirect a `/mesas` con toast

### Animaciones globales
- `rowEnter` (cards/rows): `from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) }`, 0.4s ease both
- `pulse` (dots de countdown / date chips): `0%, 100% { opacity: 1 } 50% { opacity: 0.35 }`, 2s ease-in-out infinite
- Halo de "vos" en SVG table map: `animate` SVG nativo, opacity 0.5↔1, 2s repeatCount indefinite

---

## State management

### List
```ts
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');   // persist localStorage
const [filter, setFilter]     = useState<FilterKey>('all');
const [search, setSearch]     = useState('');
const { data: mesas } = useQuery(['mesas', filter], fetchMesas);
```

### Detail
```ts
const { id } = useParams();
const { data: mesa } = useQuery(['mesa', id], () => fetchMesa(id));
const [chatText, setChatText] = useState('');
const acceptPending = useMutation(acceptPendingFn, { onSuccess: invalidateMesa });
const rejectPending = useMutation(rejectPendingFn, { onSuccess: invalidateMesa });
const joinMesa      = useMutation(joinMesaFn,      { onSuccess: invalidateMesa });
const leaveMesa     = useMutation(leaveMesaFn,     { onSuccess: navigateBack });
```

### Create / Edit
```ts
const [game, setGame]                 = useState(initial.game || '');
const [date, setDate]                 = useState(initial.date?.slice(0, 10) || '');
const [time, setTime]                 = useState(initial.date?.slice(11, 16) || '');
const [location, setLocation]         = useState(initial.location || '');
const [maxPlayers, setMaxPlayers]     = useState(initial.maxPlayers || 4);
const [privacy, setPrivacy]           = useState(initial.privacy || 'public');
const [description, setDescription]   = useState(initial.description || '');
const [rules, setRules]               = useState(initial.rules || '');
const [tags, setTags]                 = useState(initial.tags || []);

const stepDone = { juego: !!game.trim(), cuando: !!date && !!time, donde: !!location.trim(), detalles: maxPlayers && privacy };
const activeStep = Object.values(stepDone).findIndex(v => !v);  // -1 = all done = step 3 (last) o publish
const previewMesa = useMemo(() => ({...}), [game, date, time, location, maxPlayers, privacy, description, rules, tags]);

const publishMutation = useMutation(editMode ? updateMesa : createMesa, { onSuccess: (m) => navigate(`/mesas/${m._id}`) });
```

---

## Responsive

Breakpoint principal: **≤ 980px** (en `mesas-styles.css`).

- `.mesaHero` → 1 col, gap 24px, hero illustration max-width 320px centrada
- `.mesaDetailLayout` → 1 col gap 28px, `.mesaStub` `position: static`
- `.createLayout` → 1 col gap 28px, `.previewWrap` `position: static`
- `.mesaListRow` → grid `60px 1fr`, seats column salta a full-width abajo
- `.detailMetaRow` → flex-wrap, cells `flex: 1 1 50%`, border-right none, padding compacto
- `.createFieldRow` → 1 col (fecha + hora se apilan)
- `.privacyOptions` → 1 col

Hero también colapsa a 1 col a **≤ 820px** (override más específico para la ilustración).

---

## Assets

- **Fuentes**: Poppins (500/600/700/800), Archivo (400/500/600/700), JetBrains Mono (400/500/600) vía Google Fonts
- **Sin imágenes externas**: el banner de cada mesa se genera 100% en SVG a partir del seed del juego (`MesaTile`). El game name actúa como prompt visual via hash + paleta indexada.
- **Iconos**: SVG inline en `mesas-shared.jsx → MesaIcon` (Pin, Users, Clock, Lock, Globe, Dice, Arrow, ArrowLeft, Plus, Check, X, Edit, Trash, Search, Grid, List, Send, Crown, Chair). Stroke-width 2 (1.6-1.8 para variantes), strokeLinecap/Join round.

---

## Files (referencia)

Todos en este bundle:

- `Mesas Reimagined.html` — entry HTML, carga React/ReactDOM/Babel + scripts JSX
- `reimagined-styles.css` — design tokens compartidos del sistema completo (tokens, switcher, hero editorial genérico, filter chips, search, view toggle, ticket-stub base, etc.)
- `mesas-styles.css` — estilos específicos del módulo Mesas (cards, banner, seat track, table map, wizard, danger zone)
- `mesas-shared.jsx` — helpers (`mesasDateParts`, `mesasCountdown`, `mesasHorizon`), iconos (`MesaIcon`), componente `MesaTile` (SVG mosaic), datos mock (`MESAS` array), constantes (`MESAS_HORIZONS`, meses, días)
- `mesas-list.jsx` — `MesasListScreen` + `MesaCard` + `MesaRow` + `FeltedTableHero` + filtros + agrupación por horizonte
- `mesas-detail.jsx` — `MesasDetailScreen` + `TableTopDown` (SVG cenital con trig)
- `mesas-create.jsx` — `MesasCreateScreen` (sirve para crear y editar con prop `editMode`)
- `mesas-app.jsx` — entry point React + switcher de pantallas + integración con `useTweaks`

Codebase actual a reemplazar:

- `client/src/pages/dashboard/Dashboard.jsx` (lista)
- `client/src/pages/dashboard/Dashboard.module.css`
- `client/src/pages/dashboard/TableCard.jsx` (card individual)
- `client/src/pages/dashboard/TableCard.module.css`
- `client/src/pages/dashboard/TableCardSkeleton.jsx` (loading state)
- Crear nuevos: `client/src/pages/mesas/MesaDetail.jsx` + `MesaCreate.jsx`

Rutas a configurar en React Router:
```
/mesas               → MesasListPage (rename de Dashboard)
/mesas/crear         → MesaCreatePage (editMode=false)
/mesas/:id           → MesaDetailPage
/mesas/:id/editar    → MesaCreatePage (editMode=true)
```
