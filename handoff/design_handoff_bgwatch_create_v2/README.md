# Handoff: Registrar partida (BG Watch) · Desktop + Mobile · TurnoCero

Versión actualizada del creador de partidas de BG Watch, alineada al `PlayForm.jsx`
real, con las dos plataformas: **desktop** (React, scoresheet + scorecard en vivo) y
**mobile** (390×820, interactivo).

> Reemplaza el handoff anterior `design_handoff_bgwatch_create`. Este incorpora: orden
> de secciones real, 3 modos (versus/coop/equipos), steppers de puntaje, win-toggle,
> @usuario/anónimo/✨Nuevo, expansiones/variante por **picker**, jugadores por
> **picker** (no chips), incompleta/no-stats, sección 5 "Compartí", "Usar última
> juntada" y "Jugué en solitario" como pills compartidas.

---

## About the Design Files

Referencias de diseño (HTML + JSX vanilla / Babel; mobile en HTML+JS vanilla). **No es
código para copiar** — recrear en React + Vite + CSS Modules. El componente canónico
del repo es `PlayForm.jsx` (ya existe); este handoff documenta cómo debe **verse y
comportarse** en ambas plataformas.

Archivos:
- `Registrar Partida (desktop).html` — entry desktop (abrir, pestaña "Registrar partida")
- `bgwatch-create.jsx` — `CreatePlayScreen` (desktop, React) + pickers
- `bgwatch-create.css` — estilos del form desktop
- `BG Watch Mobile.html` — 4 phones; el **phone 4** es el creador interactivo (JS vanilla al final del archivo)
- `bgwatch-app.jsx` / `bgwatch-styles.css` / `tc-shared.jsx` / `tc-design.css` — shell, tokens, helpers

---

## Fidelity

**Hi-fi, interactivo y verificado.** Ranking, win-toggle, modos, pickers, share y los
helper-pills funcionan en ambas plataformas.

---

## Tokens (de `tc-design.css`)

```
--bg-dark #0a0d15  --bg-card #151c28  --bg-paper #18202f  --bg-elevated #1d2532
--accent #1888ef  --accent-light #00aeff  --accent-glow rgba(24,136,239,.18)
--purple #b48cff (acento de sección BG Watch)  --green #00d984  --gold #ffd700  --red #f31d77
--font-display Poppins  --font-body Archivo  --font-mono JetBrains Mono
--font-script Caveat  --font-serif Lora italic
```
BG Watch usa **púrpura** como acento de sección (kicker, progreso, bordes); el azul
queda para thumbnails de juego y focus de inputs.

---

## Estructura (5 secciones, progreso /3)

Orden **real** (idéntico en desktop y mobile):

1. **¿Qué jugaron?** — picker de colección (buscador + tiles con thumbnail 2-letras +
   nº de partidas). Juego seleccionado → chip con "Cambiar". Debajo: **expansiones
   jugadas** y **variante/tablero** vía **pickers popover** (no inline):
   - "+ Expansión jugada" abre popover con las expansiones del juego (toggle ✓), o
     mensaje vacío si no tiene.
   - "+ Variante/tablero" abre popover con input + sugerencias.
   - Lo elegido aparece como chips removibles (✕).
2. **¿Quiénes jugaron?** — el corazón (ver abajo).
3. **¿Cuándo y dónde?** — fecha (quick Hoy/Ayer), duración (presets + "usar tiempo de
   caja"), lugar, y checkboxes **Incompleta** + **No contar para estadísticas**.
4. **Notas** — textarea serif, opcional.
5. **Compartí esta partida** (solo crear) — colapsable (desktop) / toggle que despliega
   (mobile): privacidad, comunidad, título, crónica, drop de fotos. Publica una juntada
   en Compartidas y adjunta el scorecard automáticamente.

Progreso **doneCount/3** (juego · jugadores · cuándo). Notas y Compartir no cuentan.
`canSave` = juego + jugadores + fecha.

---

## Sección 2 · ¿Quiénes jugaron? (detalle)

### Toggle de modo (3)
- **Competitiva** (versus) — cada uno con su puntaje
- **Cooperativa** (coop) — Ganamos / Perdimos (resultado de equipo)
- **Equipos** — 2–4 equipos (+/− equipo), selector de equipo ganador, A/B/C/D por jugador

### Helper-pills (cuando hay 1 solo jugador)
Dos pills que **comparten estilo** (`.cpHelperRow` / `.cpHelperPill`), lado a lado, gap 8px:
- **Jugué en solitario** — checkbox custom (se llena de acento + check al activar). Sin
  esto, el paso "jugadores" no se completa con solo "Vos".
- **Usar última juntada** — ↺ + hint ("3 jug. · Casa de Cami"); precarga jugadores +
  ubicación de la última partida. Solo al crear. Ambos desaparecen al sumar un 2º jugador.

### Filas de jugador (`.scoreRow`)
- Rank (#1/#2 en versus; corona/equipo en otros), avatar (o 👤 fantasma para anónimos)
- Nombre + **@usuario** (si es miembro TC) / **anónimo** / pill **vos** / corona líder / **✨ Nuevo** (autodetectado)
- **Versus**: stepper de puntaje (− input +) + **win-toggle (trofeo)** — el ganador NO
  es siempre el mayor puntaje; al tocar el trofeo, `winsManual` y la elección manda.
- **Equipos**: stepper + selector A/B/C/D por jugador; gana el equipo, no el score.
- **Coop**: tag "equipo", sin puntajes.
- Botón quitar (✕) — excepto "Vos" (siempre juega).

### Agregar jugadores — **picker** (no chips)
- "Agregar jugador" abre **popover** con buscador + compañeros frecuentes (avatar,
  @usuario, ✨ para nuevos). En mobile el popover **abre hacia arriba** para no quedar
  cortado por el borde del teléfono.
- "Anónimo" agrega un asiento fantasma.
- "Ordenar por puntaje" cuando hay puntajes cargados.

### Lógica de ranking/resultado (implementada y verificada)
```
versus: rank por score desc con empates; líder único = corona; winner = winsManual ? flag : topScore
equipos: ganadores = los del equipo elegido
coop: todos ganan/pierden juntos
youWin = (versus: winner===vos) | (equipos: team(vos)===teamWin) | (coop: coopWin)
```

---

## Scorecard en vivo (desktop, sticky)

Replica una partida registrada (ticket perforado, borde púrpura): juego + expansiones,
meta (fecha/lugar/duración/nº jug./incompleta), banner de resultado contextual
(¡Ganaste! / Ganó tu equipo (A) / ¡Ganaron!), tabla ordenada con corona, y notas.
Se actualiza con cada cambio. En mobile el equivalente es el detalle de partida (phone 3).

---

## Diferencias por plataforma

| | Desktop | Mobile (phone 4) |
|---|---|---|
| Layout | 2 columnas: form + scorecard sticky | 1 columna, cards apiladas, **sticky save bar** abajo |
| Pickers | popover bajo el control | popover **hacia arriba** (anti-clip) |
| Compartir | sección colapsable | card con toggle que despliega el cuerpo |
| Progreso | "N/3 secciones listas" | stepper de 3 puntos |

Responsive desktop: ≤880px una columna (scorecard arriba); ≤580px campos a 1 col.

---

## Comportamiento & guardado (producción)

- **Guardar** → `POST /api/plays` con `{ objectid, playdate, length, location, quantity,
  comments, variant, incomplete, nowinstats, players[] }`. `players[]` lleva
  `{name, username, position, score, color('Equipo X'), win, new}`.
- "Guardar y cargar otra" → guarda + resetea (mantiene fecha/lugar).
- Edición: mismo form + **zona de peligro** (eliminar, borra también en BGG).
- Autodetección "Nuevo": `POST /api/bgg/nuevos/:user/:game` con el roster.
- Duración sugerida: `playingtime` de BGG. Pickers de jugador/ubicación/variante con
  histórico del usuario.
- "Compartí": crea juntada en Compartidas con `playResult` (snapshot del scorecard).

Integración: el botón "Nueva partida" del perfil navega acá; reusa colección BGG,
amigos/compañeros, y al guardar actualiza log + stats + colección.

---

## Checklist

- [ ] 5 secciones en orden: Juego → Quiénes → Cuándo/dónde → Notas → Compartir
- [ ] 3 modos (versus/coop/equipos) con su resultado
- [ ] Steppers (− input +) + win-toggle (ganador ≠ top score)
- [ ] @usuario / anónimo (👤) / ✨ Nuevo / corona líder
- [ ] Picker de jugadores (buscador + frecuentes), anti-clip en mobile
- [ ] Pickers de expansión y variante
- [ ] Incompleta + No contar para estadísticas + "usar tiempo de caja"
- [ ] Helper-pills "Jugué en solitario" + "Usar última juntada" (estilo compartido, gap consistente)
- [ ] Sección 5 "Compartí esta partida" (colapsable / toggle)
- [ ] Scorecard en vivo (desktop) / detalle (mobile)
- [ ] Guardar/editar/eliminar + endpoints; progreso /3; responsive; accesibilidad (labels, aria-live, teclado)
