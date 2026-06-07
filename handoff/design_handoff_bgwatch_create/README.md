# Handoff: Registrar partida (BG Watch) · TurnoCero

## Overview

Pantalla **creadora de partidas** para BG Watch — el flujo que faltaba en la sección.
Hoy el botón "Nueva partida" del perfil no lleva a ningún lado; esta es la pantalla
para **registrar una partida jugada** en el almanaque personal.

Concepto: una **libreta de puntajes / scoresheet**, coherente con la metáfora de BG
Watch como "almanaque de partidas". El usuario completa 4 secciones cortas a la
izquierda y ve una **carta de puntaje (scorecard) en vivo** a la derecha que se arma
con cada campo.

Características clave:
- **Picker de juego** desde la colección sincronizada (BGG), con buscador, tiles con
  thumbnail y nº de partidas previas. Permite registrar un juego fuera de colección.
- **Scoring inteligente**: en modo competitivo cada jugador tiene su puntaje, y la
  pantalla **auto-rankea en vivo** (#1/#2/#3), corona al líder y deriva el resultado
  ("¿Ganaste?") sin que el usuario lo marque.
- **Modo cooperativo**: alterna a un resultado de equipo (Ganamos / Perdimos), sin
  puntajes individuales.
- **Jugadores** desde compañeros frecuentes (un toque) o invitados ad-hoc.
- **Scorecard en vivo** que replica el estilo de la partida ya registrada.

---

## About the Design Files

Referencias de diseño en HTML + JSX vanilla (Babel standalone). **No es código para
copiar directo** — recrear en React + Vite + CSS Modules.

Crear:
- `client/src/pages/bg-watch/CreatePlay.jsx` (o `LogPlay.jsx`)
- `CreatePlay.module.css`
- Sub-componentes sugeridos: `GamePicker.jsx`, `ScoreRow.jsx`, `Scorecard.jsx` (preview)

Esta pantalla se monta como **ruta** (`/bg-watch/registrar` o `/bg-watch/nueva-partida`)
o como **panel/modal** desde el perfil. El prototipo la integra como screen `create`
en el shell de BG Watch, navegable desde el botón "Nueva partida" (`PlayerHeader`) y
desde el switcher.

> En el prototipo, `CreatePlayScreen` vive en `bgwatch-create.jsx` (script babel
> separado) y reusa datos (`P`, `COLL`) expuestos por `bgwatch-app.jsx` vía
> `window`. En producción esos datos vienen del backend (ver Modelo de datos).

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, animaciones finalizados.
Toda la lógica de ranking/resultado está implementada y verificada.

---

## Design tokens (de `tc-design.css`, importado por `bgwatch-styles.css`)

```css
--bg-dark: #0a0d15;  --bg-card: #151c28;  --bg-paper: #18202f;  --bg-elevated: #1d2532;
--accent: #1888ef;  --accent-light: #00aeff;  --accent-dark: #0076d1;  --accent-glow: rgba(24,136,239,0.18);
--purple: #b48cff;  --purple-10/-25;   /* acento de marca de BG Watch */
--green: #00d984;  --green-10/-25;     /* victoria */
--red: #f31d77;  --red-10/-25;          /* derrota / quitar */
--gold: #ffd700;                         /* líder / #1 */
--text-primary/-secondary/-muted/-faint;
--border / --border-strong / --border-accent;

--font-display: 'Poppins';        /* títulos, puntajes, números */
--font-body:    'Archivo';        /* inputs, texto */
--font-mono:    'JetBrains Mono'; /* labels, kickers, meta */
--font-script:  'Caveat';         /* acentos manuscritos en títulos (em) */
--font-serif:   'Lora' italic;    /* notas de la partida */
```

> **BG Watch usa púrpura como acento de sección** (lo diferencia de Mesas/Eventos que
> van en azul). Los botones de progreso, kickers y el borde del scorecard usan púrpura;
> el azul queda para los thumbnails de juego y focus de inputs.

---

## Modelo de datos

### Input — lo que la pantalla necesita cargar
```ts
// Colección del usuario (de BGG, ya sincronizada en el perfil)
type CollectionGame = { id: string; name: string; year: number; numPlays: number; owned: boolean };

// Compañeros frecuentes (amigos / co-jugadores recientes)
type Partner = { handle: string; name: string; initial: string; color: string };
```

### Output — el "play" que se guarda
```ts
type PlayDraft = {
  gameId: string | null;       // id de colección, o null si es custom
  gameName: string;            // nombre (permite juego fuera de colección)
  date: string;                // ISO (YYYY-MM-DD)
  durationMin: number;
  location: string;
  mode: 'versus' | 'coop';
  players: Array<{
    handle: string;            // 'vos' = usuario actual; 'guestXXX' = invitado
    name: string;
    guest?: boolean;
    score: number | null;      // null en coop
  }>;
  coopWin?: boolean;           // solo mode='coop'
  notes?: string;
  // Derivados al guardar (no los pone el usuario):
  // outcome: 'win' | 'loss'  → mode versus: leader===vos ; coop: coopWin
  // initial: 2 letras del juego para el thumbnail
};
```

`gameInitials(name)` deriva las 2 letras del thumbnail: iniciales de las 2 primeras
palabras, o las 2 primeras letras si es una sola palabra.

---

## Layout

```
.page
  .backBtn                         ← "Cancelar y volver"
  .createPlayHead                  ← kicker + título "Anotá la partida." + progreso N/3
  .createPlayLayout (grid 1fr 340px)
    .createPlayForm
      .cpSection  #1 ¿Qué jugaron?      ← game picker
      .cpSection  #2 ¿Cuándo y dónde?   ← fecha + duración + lugar
      .cpSection  #3 ¿Quiénes jugaron?  ← modo + scoring + add players
      .cpSection  #4 Notas              ← textarea serif
      .cpFooter                          ← Descartar / Guardar y cargar otra / Guardar partida
    .cpPreview (sticky)             ← scorecard en vivo
```

Cada sección tiene un `.cpSectionNum` (1–4) que pasa a check verde (`.done`) cuando
está completa. El header muestra `doneCount/3` (la sección 4, Notas, es opcional y no
cuenta).

---

## Sección 1 · Game picker

- **Estado seleccionado** (`.gamePickerSelected`): thumbnail 2-letras + nombre + meta
  ("2019 · 14× jugado" o "Juego nuevo · fuera de colección") + botón "Cambiar".
- **Estado abierto**: `.searchInput` + `.gameTileGrid` (tiles scrollables). Cada
  `.gameTile`: thumbnail rayado con las 2 letras + badge de partidas (`14×` / `nuevo`),
  nombre, año. Ordenados por `numPlays` desc.
- **Juego custom**: si la búsqueda no matchea, ofrece "Registrar '{X}' igual →"
  (juego fuera de colección, `gameId: null`).

> En prod: la grilla viene de `GET /api/bgg/collection` (ya sincronizada). El buscador
> filtra client-side, o server-side con `?q=` si la colección es grande.

---

## Sección 2 · Cuándo y dónde

- **Fecha**: `<input type=date>` + quick chips "Hoy" / "Ayer"
- **Duración**: `<input type=number>` (min) + presets 30/60/90/120
- **Lugar**: texto libre. Sección marca `done` cuando hay fecha **y** lugar.

---

## Sección 3 · Quiénes jugaron (el corazón)

### Toggle de modo (`.cpModeToggle`)
- **Competitiva** — cada uno con su puntaje
- **Cooperativa** — ganan o pierden juntos

### Modo competitivo (`.scoreList`)
Cada `.scoreRow` (grid `28px auto 1fr auto auto`):
- **Rank** (#1/#2/#3) — calculado en vivo desde los puntajes (ver Lógica)
- Avatar + nombre; "vos" lleva pill `.scorePlayerYou` + la fila tiene acento izquierdo (`.you`)
- **Corona dorada** en el líder (`.scoreCrown`), y la fila se tiñe (`.leader`)
- `.scoreInput` numérico (centrado, grande)
- Botón quitar (excepto "vos")

### Modo cooperativo (`.coopResult`)
- Dos botones grandes **Ganamos / Perdimos** (`.coopBtn.win/.loss`)
- Lista de jugadores sin puntaje (todos "equipo")

### Agregar jugadores (`.addPlayerWrap`)
- Chips de compañeros frecuentes (avatar + nombre); se deshabilitan si ya están
- Botón punteado "+ Invitado" (agrega un jugador ad-hoc "Invitado N")

---

## Lógica de ranking & resultado (implementada)

```js
// Ranking en vivo (modo versus):
// 1. parsear scores a número (vacío/"-" => null)
// 2. ordenar desc por score
// 3. asignar rank con empates: mismo score => mismo rank; salto tras empate
// 4. leader = el único con rank 1 (si hay empate en 1°, no hay líder único → sin corona)
const leaderHandle = (únic@ con rank===1) ?? null;

// Resultado del usuario:
const youWin = mode === 'versus' ? (leaderHandle === 'vos') : coopWin;
```

- Empates manejados: dos jugadores con el mismo puntaje comparten rank y **no** se
  corona a nadie (no hay ganador único).
- El scorecard de la derecha refleja el ranking ordenado y el banner de resultado.
- **Verificado**: scores 92/76/81 → Vos #1 (corona) · Pancho #2 · Cami #3 · banner "¡Ganaste!".

---

## Sección 4 · Notas
Textarea con `--font-serif` itálica (mismo estilo que las notas en el detalle de
partida). Opcional.

---

## Scorecard en vivo (`.cpPreview`, sticky)

Replica visualmente una partida registrada (estilo ticket perforado, borde púrpura):
- **Top**: kicker + thumbnail/nombre del juego (placeholder "Elegí un juego" si vacío)
  + meta (fecha, lugar, duración, nº jugadores) con iconos
- **Banner de resultado**: "¡Ganaste!" (verde) / "Perdiste" (gris) / "Cargá los
  puntajes…" (vacío). En coop: "¡Ganaron!/Perdieron".
- **Lista de jugadores** ordenada por rank (versus) o como equipo (coop), con líder
  dorado y "vos" en cyan
- **Notas** al pie si hay
- Se actualiza con cada cambio del formulario (estado controlado en React)

---

## Comportamiento & guardado

- **Guardar partida** (`canSave` = juego + fecha presentes) → `POST /api/plays` con el
  `PlayDraft`. El backend calcula `outcome` y persiste. Redirige al perfil (o al
  detalle de la partida recién creada).
- **Guardar y cargar otra** → guarda y resetea el form (manteniendo fecha/lugar para
  registrar varias partidas de una misma junta rápido).
- **Descartar / Cancelar** → vuelve sin guardar (idealmente con confirmación si hay
  cambios).
- **Validación**: juego + fecha obligatorios; en versus, idealmente todos con puntaje
  antes de guardar (el prototipo lo marca en `steps.players` pero no bloquea el guardado
  salvo juego+fecha — definir regla de negocio).
- Si el juego es de colección, incrementar `numPlays` localmente al guardar.

---

## Integración con el codebase

- **Botón de entrada**: el "Nueva partida" del perfil (`PlayerHeader`) navega acá. Ya
  está cableado en el proto (`onNewPlay`).
- **Colección**: reusa la data ya sincronizada de BGG que alimenta la pestaña Colección.
- **Compañeros frecuentes**: derivar de amigos + co-jugadores de partidas recientes.
- **Post-guardado**: la nueva partida aparece en el log (`PartidasPanel`), actualiza
  stats (total, win-rate, heatmap, top games) y puede disparar una Compartida opcional.

---

## Responsive

- **≤ 880px**: una columna; el scorecard pasa arriba (`order: -1`, `position: static`);
  el header de progreso se alinea horizontal
- **≤ 580px**: `cpFieldRow` a 1 columna; `scoreRow` colapsa la columna de quitar

---

## Accesibilidad

- Inputs con `<label>` asociado; `aria-label` en botones de quitar/iconos
- El scorecard es un reflejo visual — marcar `aria-hidden` o exponerlo como resumen
  con `aria-live="polite"` para anunciar el resultado al cambiar puntajes
- Foco visible en tiles, chips y inputs; el game picker navegable por teclado
- Inputs numéricos con `inputMode="numeric"`
- Respetar `prefers-reduced-motion` si se agregan transiciones de entrada

---

## Assets

- **Sin imágenes**: thumbnails = 2 letras sobre gradiente; avatares = inicial + color;
  iconos = SVG inline (`Icon` de `tc-shared.jsx`: Dice, Calendar, Pin, Clock, Users,
  Crown, Trophy, Check, X, Plus, ArrowLeft, External…)
- **Fuentes**: Poppins, Archivo, JetBrains Mono, Caveat (script), Lora (serif italic)

---

## Files (referencia)

- `BG Watch Reimagined.html` — entry (carga React/Babel + scripts; orden: `tc-shared`, `bgwatch-app`, `bgwatch-create`)
- `tc-design.css` — tokens base
- `bgwatch-styles.css` — estilos de BG Watch (perfil, plays, colección, detalle)
- `bgwatch-create.css` — estilos de la pantalla de registro (secciones, game picker, scoring, scorecard)
- `bgwatch-create.jsx` — **`CreatePlayScreen`** + helper `gameInitials()`
- `bgwatch-app.jsx` — shell de BG Watch; expone `P`/`COLL`/`PLAYS` y rutea a `create`
- `tc-shared.jsx` — Icon / Avatar / Switcher / helpers de fecha

Codebase a crear:
- `client/src/pages/bg-watch/CreatePlay.jsx` + `.module.css` + sub-componentes
- Ruta o modal de registro; endpoint `POST /api/plays`

---

## Checklist de implementación

- [ ] Pantalla/ruta de registro accesible desde "Nueva partida"
- [ ] Game picker: buscador + grid de colección + selección + juego custom
- [ ] Fecha (quick Hoy/Ayer) + duración (presets) + lugar
- [ ] Toggle competitiva/cooperativa
- [ ] Scoring con auto-ranking en vivo, corona al líder, manejo de empates
- [ ] Resultado derivado (no manual) para "vos"
- [ ] Add players (frecuentes + invitado), quitar
- [ ] Notas (serif)
- [ ] Scorecard en vivo sincronizado
- [ ] Guardar (`POST /api/plays`) + "guardar y cargar otra" + descartar
- [ ] Actualizar stats/log/colección post-guardado
- [ ] Validación (juego+fecha; regla para puntajes completos)
- [ ] Responsive 880 / 580
- [ ] Accesibilidad: labels, aria-live en scorecard, teclado en picker
