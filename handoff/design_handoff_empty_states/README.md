# Handoff: Sistema de Empty States · TurnoCero

## Overview

Patrón **reutilizable** para todos los estados vacíos de la plataforma. Reemplaza el
empty state actual (un emoji `🎲`/`📰`/`📋` + una línea de texto centrada, que se ve
pobre y deja mucho espacio muerto) por un componente único con:

1. **Ilustración SVG** del universo de juego de mesa (consistente con las pantallas de
   error y el showcase del login) — nunca emoji.
2. **Ghost previews** detrás del prompt: cards/filas/polaroids "fantasma" de lo que va
   a contener la sección, desvanecidas con una máscara radial. Llenan el espacio vacío
   de forma significativa y enseñan qué va a aparecer ahí.
3. **Prompt central** con eyebrow + título + copy + acción(es) claras.

Cubre **2 modos** que NO deben confundirse:

- **`first`** (primera vez / sin datos) — ilustración grande, copy que invita a crear,
  **CTA primario** ("Crear la primera mesa"), ghost previews detrás, hint opcional.
- **`filtered`** (búsqueda/filtro sin resultados) — compacto, ilustración de lupa,
  copy de "sin coincidencias", **chips de sugerencia** + botón "Limpiar filtros". SIN
  ghosts (no hay nada que previsualizar).

El archivo de diseño es un **showcase** con switcher (6 entidades × 2 modos) solo para
revisión. En producción es **un componente `<EmptyState>`** que cada sección monta con
su config.

---

## About the Design Files

Referencias de diseño en HTML + JSX vanilla (Babel standalone). **No es código para
copiar directo** — recrear en el entorno actual: React + Vite + CSS Modules.

Crear:
- `client/src/components/shared/EmptyState.jsx` — componente reutilizable
- `EmptyState.module.css`
- Un módulo de **ilustraciones** (`EmptyArt.jsx`) con los SVG por entidad
- Opcional: `EmptyGhosts.jsx` con los skeletons por tipo de layout

Reemplazar los empty states actuales en:
- `client/src/pages/dashboard/Dashboard.jsx` (mesas)
- `client/src/pages/eventos/Eventos.jsx` + `EventoInscripciones.jsx`
- `client/src/pages/torneos/Torneos.jsx`
- `client/src/pages/compartidas/Compartidas.jsx` + `CompartidasSidebar.jsx`
- `client/src/pages/comunidad/Comunidad.jsx`
- `client/src/pages/noticias/Noticias.jsx`
- `client/src/pages/notificaciones/Notificaciones.jsx` (ya tiene una versión propia — unificar)

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, animaciones finalizados.

---

## Design tokens (de `reimagined-styles.css`)

```css
--bg-dark: #0a0d15;  --bg-card: #151c28;  --bg-elevated: #1d2532;  --bg-deep: #050810;
--accent: #1888ef;  --accent-light: #00aeff;  --accent-glow: rgba(24,136,239,0.18);
--text-primary: #ffffff;  --text-secondary: #a8b4cc;  --text-muted: #5a6178;
--border: #1e2a3d;  --border-strong: #2a3a55;
--red: #f31d77;  --green: #00d984;  --orange: #f5a623;  --purple: #b48cff;
--font-display: 'Poppins';  --font-body: 'Archivo';  --font-mono: 'JetBrains Mono';
--t: 0.2s ease;
```

---

## API del componente

```tsx
<EmptyState
  variant="first | filtered"      // default 'first'
  art={<ArtMesa />}               // ReactNode — ilustración SVG (ver set)
  ghost={<GhostMesa />}           // ReactNode | null — previews fantasma (solo 'first')
  eyebrow="◆ Ninguna mesa abierta"
  title='La mesa está <em>servida.</em>'   // permite <em> (acento cyan)
  text="Copy de apoyo…"
  primary={{ label, icon, onClick }}        // CTA principal (omitir en 'filtered' salvo casos)
  secondary={{ label, icon, onClick }}      // acción ghost
  chips={['Con lugar', 'Públicas', …]}      // sugerencias (solo 'filtered')
  hint='Texto con <button>acción</button>'  // línea de ayuda opcional
  compact={false}                            // true en 'filtered'
/>
```

> El `title` y `hint` usan HTML embebido (`<em>`, `<strong>`, `<button>`). En React,
> sanitizar y preferir componer con JSX en vez de `dangerouslySetInnerHTML` (el proto
> lo usa por brevedad). Mantener `<em>` = acento cyan, `<strong>` = `--text-secondary`.

---

## Anatomía (`.empty`)

```
.empty (.compact?)              ← min-height 440px (300 compact), grid place-items center, overflow hidden
├── .emptyGhosts (.rows?)       ← z-0, absolute inset-0, flex center, mask radial fade, opacity 0.5
│     [ghost cards / rows / polaroids]
└── .emptyCore                  ← z-2, flex column center, max-width 460px
      .emptyArt                 ← 150×120 (96×80 compact) — SVG ilustración
      .emptyEyebrow (.muted?)   ← mono uppercase cyan (muted en filtered)
      .emptyTitle               ← Poppins 700 clamp(1.5–2rem), <em> cyan
      .emptyText                ← secondary 14.5px, max-width 400px
      .emptyActions             ← .emptyBtn (primary) + .emptyBtn.ghost
      .emptyChips               ← (filtered) chips de sugerencia
      .emptyHint                ← (opcional) línea mono con link/acción
```

### Ghost previews (`.emptyGhosts`) — la clave del relleno
- `position: absolute; inset: 0; z-index: 0; opacity: 0.5`
- **Máscara radial** que vuelve transparente el centro para que el prompt respire:
  ```css
  mask-image: radial-gradient(ellipse 70% 80% at 50% 45%, transparent 30%, #000 78%);
  ```
- `flex` horizontal por defecto (cards), o `.rows` vertical (filas tipo timeline)
- Los ghosts son **skeletons** del card real de cada entidad (`filter: saturate(0.5)`),
  con `.ghostLine` / `.ghostPill` / `.ghostTrack` / `.ghostAvatar` etc. como bloques grises
- `pointer-events: none` — puramente decorativos

### Animación de entrada — ⚠️ nota crítica
`.emptyCore` tiene una entrada `esRise` **solo bajo `prefers-reduced-motion: no-preference`**
y la keyframe anima **únicamente `transform` (translateY 10→0), nunca `opacity`**.

> **Por qué importa**: una primera versión animaba `opacity 0→1` con `fill-mode: both`.
> En contextos donde la animación se congela (tab en background, captura headless,
> motor de render sin rAF), el elemento quedaba pegado en el frame 0 → **invisible**.
> Regla general del sistema: **el end-state visible debe ser el estilo base**; animar
> solo *desde* un estado oculto bajo condiciones seguras, nunca dejar opacity:0 como
> estado por defecto/fill. Respetar `prefers-reduced-motion`.

---

## Set de ilustraciones (SVG inline, sin imágenes)

| Entidad | Ilustración | Concepto |
|---|---|---|
| **Mesas** | `ArtMesa` | Mesa felteada vacía con 6 sillas punteadas alrededor + dado central tenue |
| **Eventos** | `ArtEvento` | Ticket/calendario con perforación, fecha "??" / "SIN FECHA" |
| **Torneos** | `ArtTorneo` | Bracket vacío (slots punteados) + trofeo central con "?" |
| **Compartidas** | `ArtCompartida` | Polaroid con ícono de cámara + caption Caveat "tu primera foto" + cinta |
| **Comunidad** | `ArtComunidad` | Meeples (siluetas) + sombra elíptica |
| **Notificaciones** | `ArtNotif` | Campana verde + badge check "al día" |
| **Filtered (todas)** | `ArtSearch` | Lupa cyan sobre un dado con "?" |

Todas son SVG inline (`viewBox 0 0 150 120`). El helper `meeple(x,y,s,fill,op)` dibuja
la silueta de meeple reutilizable. Paleta = tokens de marca.

### Ghost skeletons por layout
- `GhostMesa` — 4 cards (banner + líneas + track + avatar/pill) → para grids de cards
- `GhostRows` — 4 filas (fecha + líneas + pill) → para timelines/listas (Eventos, Torneos)
- `GhostPolaroids` — 5 polaroids rotadas → Compartidas
- `GhostMembers` — 4 carnets (franja color + avatar redondo + stats) → Comunidad

---

## Copy por entidad (modo `first`)

| Entidad | Eyebrow | Título | CTA primario |
|---|---|---|---|
| Mesas | ◆ Ninguna mesa abierta | La mesa está **servida.** | Crear la primera mesa |
| Eventos | ◆ Agenda despejada | Nada en la **agenda** todavía. | Crear evento |
| Torneos | ◆ Cuadro vacío | Que empiece la **competencia.** | Armar torneo |
| Compartidas | ◆ Diario en blanco | Contá tu **última partida.** | Compartir una partida |
| Comunidad | ◆ Roster vacío | Sé el **primero** en sentarte. | Invitar jugadores |
| Notificaciones | ◆ Bandeja al día | Estás **al día.** | (sin primario — solo "Explorar mesas") |

Modo `filtered`: eyebrow "Sin coincidencias", título "Ningún {entidad} con **esos
filtros**", chips de las categorías que SÍ tienen datos, botón "Limpiar filtros".

> Tono lúdico on-brand. El copy completo está en `ENTITIES` (`empty-states-app.jsx`).

---

## Comportamiento por modo

### `first` (sin datos)
- **CTA primario** dispara la acción de creación de la entidad (abrir form/modal o navegar a `/crear`)
- **CTA secundario** = exploración alternativa (otras zonas, ver pasados, cómo funciona)
- **Permisos**: si el usuario no puede crear (ej. eventos/torneos solo admin/host), el
  primario se omite o se reemplaza por uno informativo. El empty state actual de
  Noticias ya gatea el botón con `isAdmin` — mantener ese patrón.
- **hint** opcional con dato útil (ej. "las mesas suelen aparecer jueves y viernes")

### `filtered` (con filtros activos, 0 resultados)
- Detectar este caso vs. `first`: si hay **filtros/búsqueda activos** → `filtered`; si el
  dataset base está vacío → `first`
- **chips** = filtros sugeridos que devuelven resultados (idealmente con count real > 0)
- **"Limpiar filtros"** resetea filtros + búsqueda al estado default
- `compact` → menos altura, sin ghosts

---

## Responsive

- **≤ 640px**: `.emptyGhosts { display: none }` — en mobile se ocultan los ghosts para
  dar foco total al prompt (el espacio horizontal no alcanza para que aporten)
- `.empty` baja a `min-height: 380px`
- Botones de `.emptyActions` hacen wrap y se centran

---

## Accesibilidad

- Ilustración SVG decorativa → `aria-hidden="true"`
- El empty state debería anunciarse: contenedor con `role="status"` / `aria-live="polite"`
  para que lectores de pantalla informen "sin resultados" al filtrar
- CTAs son `<button>`/`<a>` reales con foco visible
- Respetar `prefers-reduced-motion` (ya contemplado: la entrada se desactiva)
- Contraste AA del texto sobre fondo oscuro

---

## Integración

- Reemplazar cada bloque `.empty` actual por `<EmptyState variant=… {...config} />`
- Centralizar las configs por entidad (objeto `ENTITIES`) o co-ubicarlas en cada página
- Las acciones (`onClick`) conectan con los flujos existentes: crear mesa
  (`/mesas/crear`), crear evento, etc.
- Para `filtered`, pasar el handler de "limpiar filtros" de cada página
- **Skeletons de carga** (loading) son un caso aparte — no confundir con empty. El
  empty se muestra cuando la carga terminó y `items.length === 0`.

---

## Files (referencia)

- `Empty States Reimagined.html` — showcase (switcher 6 entidades × 2 modos)
- `reimagined-styles.css` — tokens del sistema
- `empty-states.css` — estilos del patrón (`.empty`, `.emptyGhosts` + máscara, `.emptyCore`, art, ghosts, chips, responsive)
- `empty-states-app.jsx` — `EmptyState` + ilustraciones (`ArtMesa`/`ArtEvento`/…) + ghosts (`GhostMesa`/`GhostRows`/…) + `meeple()` helper + configs `ENTITIES`

Codebase a crear:
- `client/src/components/shared/EmptyState.jsx` + `.module.css` + `EmptyArt.jsx`

---

## Checklist de implementación

- [ ] `<EmptyState>` reutilizable con props (variant, art, ghost, eyebrow, title, text, primary, secondary, chips, hint, compact)
- [ ] Set de ilustraciones SVG por entidad + `ArtSearch` para filtered
- [ ] Ghost skeletons por layout (cards / rows / polaroids / members) con máscara radial
- [ ] Entrada `esRise` solo-transform + `prefers-reduced-motion` (nunca opacity:0 de base)
- [ ] Distinguir `first` vs `filtered` según filtros activos
- [ ] Gatear CTA primario por permisos (admin/host donde aplique)
- [ ] "Limpiar filtros" + chips con counts reales en `filtered`
- [ ] Reemplazar los `.empty` actuales en las 7 secciones (unificar el de Notificaciones)
- [ ] Responsive ≤ 640px (ocultar ghosts)
- [ ] Accesibilidad: `role=status`/`aria-live`, `aria-hidden` en SVG, foco en CTAs
- [ ] No confundir con loading skeleton (caso separado)
