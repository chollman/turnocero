# Handoff: Pantallas de error 404 / 500 reimaginadas · TurnoCero

## Overview

Rediseño de los **estados de error** de TurnoCero (404 página no encontrada, 500
error del servidor). Reemplaza los mensajes de error genéricos por pantallas
full-screen con **lenguaje de juego de mesa**, consistentes con el sistema visual
reimaginado.

Concepto:
- **404** → "Esta carta no está en el mazo" — un dado que cayó fuera del tablero
  mostrando un "?" en vez de pips. Ofrece **quick links** a las secciones principales
  para reorientar al usuario.
- **500** → "Se nos volcó el tablero" — pila de piezas/tiles volcados + un dado con
  una "X". Copy tranquilizador ("no es culpa tuya") + **código de incidente copiable**
  para soporte.

Ambos comparten: backdrop de piezas de juego flotando suavemente, monograma de
marca, código de error gigante con gradiente, y acciones claras de recuperación.

---

## About the Design Files

Referencias de diseño en HTML + JSX vanilla (Babel standalone). **No es código para
copiar directo** — recrear en el entorno actual: React + Vite + CSS Modules +
React Router.

En el prototipo, 404 y 500 viven en **un solo componente** con un tweak que togglea
entre ambos (para revisión). En producción son **dos componentes/rutas separados**:

- `client/src/pages/error/NotFound.jsx` (404) — montado como catch-all `path="*"` en el router
- `client/src/pages/error/ServerError.jsx` (500) — montado como `errorElement` del router (React Router) y/o renderizado por un Error Boundary global
- `Error.module.css` (compartido)

Comparten la mayoría de estilos: conviene un componente base `<ErrorScreen variant="404|500" />` con props de copy/ilustración/acciones, y dos thin-wrappers.

---

## Fidelity

**Hi-fi pixel-accurate.** Colores, tipografías, espacios, animaciones finalizados.

---

## Design tokens (de `reimagined-styles.css`)

```css
--bg-dark: #0a0d15;  --bg-card: #151c28;  --bg-elevated: #1d2532;

--accent: #1888ef;  --accent-light: #00aeff;  --accent-glow: rgba(24,136,239,0.18);
--red: #f31d77;  --orange: #f5a623;  --green: #00d984;  --purple: #b48cff;

--text-primary: #ffffff;  --text-secondary: #a8b4cc;  --text-muted: #5a6178;
--border: #1e2a3d;  --border-strong: #2a3a55;  --border-accent: rgba(24,136,239,0.4);

--font-display: 'Poppins', sans-serif;        /* código, título */
--font-body:    'Archivo', sans-serif;          /* texto */
--font-mono:    'JetBrains Mono', monospace;    /* eyebrow, links, incidente */

--t: 0.2s ease;
```

### Acento por variante
- **404** → acento **azul** (`--accent` / `--accent-light`). El fondo usa radiales azules.
- **500** → acento **rojo/naranja**. Se aplica con la clase `.is500` en `.errStage`,
  que reescribe el fondo (radiales rojo+naranja), el color del código, eyebrow (naranja),
  botón primario (rojo), borde del monograma, etc.

---

## Layout

```
.errStage (.is500?)            ← min-height 100vh, grid place-items center, fondo radial
├── .errBackdrop               ← piezas SVG flotando (decorativo, z-0, opacity 0.55)
│     .errPiece × 6            ← hex, dado, 3 meeples, carta — animación errFloat
└── .errCard (z-2, center, max 560px)
      .errBrand                ← monograma + "TurnoCero"
      <Hero404 /> | <Hero500 /> ← ilustración (200×160)
      .errCode                 ← "404" / "500" gigante con gradiente
      .errEyebrow              ← "Error 404 · página no encontrada"
      .errTitle                ← titular con <em> de color
      .errText                 ← descripción
      .errActions              ← 2 botones (primary + ghost)
      404: .errLinks           ← quick links a secciones
      500: .errIncident        ← código de incidente + copiar
```

Todo centrado vertical y horizontalmente. En ≤ 520px los botones se apilan
full-width y la ilustración se achica.

---

## Ilustraciones (SVG inline)

### Backdrop (`<Backdrop is500>`)
6 piezas de juego repartidas por los bordes con `position:absolute` (%), cada una con
`animation: errFloat` (sube/baja 14px + rota suave, 5.5–7.5s, delays escalonados):
- hexágono (tile), dado con 5 pips, 2 meeples (path silueta), una carta chica, un meeple extra
- Los colores cambian según variante (azul/cyan en 404; rojo/naranja en 500)
- `opacity: 0.55`, `pointer-events: none`, `z-index: 0` — puramente decorativo

### Hero404
Dado grande tilteado (-12°) con un **"?"** cyan en la cara (en vez de pips), una línea
punteada debajo (el "borde del tablero" del que se cayó), sombra elíptica, y ticks de
movimiento. Comunica "se salió de lo conocido".

### Hero500
**Pila de tiles volcados** (3 rects rotados en rojo/naranja/cyan) + un **dado con "X"**
cayendo, sombra, ticks de dispersión. Comunica "algo se desarmó".

> Las ilustraciones son SVG inline (cero imágenes externas) para que siempre
> rendericen, incluso si el error es por caída de assets/CDN. **Importante para el 500**:
> la página de error no debe depender de recursos que podrían ser justamente los que
> fallan. Inline todo (SVG + estilos críticos).

### Código gigante (`.errCode`)
`clamp(5rem, 16vw, 9rem)`, Poppins 800, gradiente vertical via `background-clip:text`.
404: blanco→muted. 500: blanco→rojo.

---

## Copy (2 tonos)

El prototipo expone un tweak `tone` (lúdico / directo). **Recomendación: usar el tono
lúdico** — es coherente con la marca (juegos de mesa) y baja la frustración. El tono
directo queda como fallback si se quiere algo más sobrio.

### 404
- Eyebrow: `Error 404 · página no encontrada`
- Título (lúdico): "Esta carta no está **en el mazo.**" · (directo): "Página **no encontrada.**"
- Texto (lúdico): "Buscamos en todas las cajas y no encontramos lo que pedías. Quizás la mesa se levantó, el link quedó viejo, o tipeaste un número de la suerte que no tocaba."
- Acciones: **Volver al inicio** (primary) · **Página anterior** (ghost)
- Quick links: Mesas · Eventos · Compartidas · Contacto

### 500
- Eyebrow: `Error 500 · algo se cayó de la mesa`
- Título (lúdico): "Se nos **volcó el tablero.**" · (directo): "Algo salió **mal.**"
- Texto (lúdico): "No es culpa tuya — un error de nuestro lado dio vuelta las piezas. Ya estamos levantando todo. Probá de nuevo en un toque y deberíamos estar jugando otra vez."
- Acciones: **Reintentar** (primary) · **Ir al inicio** (ghost)
- Incidente: `#TC-5093-A1 · {timestamp}` con botón "copiar"

---

## Interacciones & comportamiento

### 404
- **Volver al inicio** → `navigate('/')`
- **Página anterior** → `navigate(-1)` (con fallback a `/` si no hay historial)
- **Quick links** → navegan a `/mesas`, `/eventos`, `/compartidas`, `/contacto`
  (idealmente personalizables: mostrar las secciones más usadas o las habilitadas por feature-flags)
- Opcional: log del 404 (path intentado) a analytics para detectar links rotos

### 500
- **Reintentar** → re-ejecuta la acción fallida. Con React Router `errorElement`,
  usar `useRouteError()` + un botón que haga `navigate(0)` (reload) o re-trigger del loader.
  Con Error Boundary, exponer un `resetErrorBoundary()`.
- **Ir al inicio** → `navigate('/')` (full reload recomendado para limpiar estado corrupto)
- **Código de incidente**: generar/recibir del backend (correlation-id del request
  fallido). El botón "copiar" usa `navigator.clipboard.writeText(code)` → feedback "✓ copiado" ~1.5s.
  Mostrar timestamp local. Esto le da a soporte algo accionable.
- Reportar el error a Sentry/monitoring con el mismo correlation-id

### Animación
- `errFloat`: piezas del backdrop suben 14px y rotan +4° en loop (5.5–7.5s, ease-in-out,
  delays negativos escalonados para que no estén sincronizadas)
- `pulse` (dot del incidente 500): opacity 1↔0.35, 2s
- Respetar `prefers-reduced-motion`: **desactivar `errFloat` y `pulse`** (agregar media query)

---

## Integración con el router (React Router)

```jsx
// 404 — catch-all
{ path: '*', element: <NotFound /> }

// 500 — errorElement a nivel raíz (captura throws de loaders/acciones/render)
{
  path: '/',
  element: <RootLayout />,
  errorElement: <ServerError />,
  children: [ /* … */ ]
}
```

Además, envolver la app en un **Error Boundary** de React para errores de render que
el router no captura, que renderice `<ServerError />`.

**Chrome de la app**: estas pantallas son **full-screen sin navbar/sidebar** (el 500
sobre todo, porque el chrome podría ser parte de lo que falló). El 404 puede opcionalmente
mantener el navbar si se monta dentro del layout; el prototipo asume full-screen para
ambos. Decisión de implementación: el 500 SIEMPRE full-screen y auto-contenido.

---

## State (prototipo)

```ts
const [copied, setCopied] = useState(false);   // feedback del botón copiar (500)
// Tweaks (solo revisión, no portar):
//   screen: '404' | '500'   → en prod son rutas/componentes separados
//   tone:   'playful' | 'plain'  → fijar en 'playful' salvo decisión de producto
```

---

## Responsive

- **≤ 520px**: `.errActions` en columna, botones full-width, `.errHero` 160×130
- El backdrop se mantiene pero las piezas quedan cerca de los bordes (algunas pueden
  recortarse — es intencional y decorativo)

---

## Accesibilidad

- La página debe setear el **status HTTP correcto** server-side (404 / 500) — no solo
  el visual. Para SPA, el SSR/edge debe responder con el código real.
- `<h1>` = código de error; el título descriptivo como `<h2>` (o usar `aria-label` combinado)
- Botones con foco visible; "copiar" con `aria-live` para anunciar "copiado"
- Backdrop SVG con `aria-hidden="true"` (decorativo)
- `prefers-reduced-motion`: desactivar animaciones flotantes
- Contraste: el texto principal sobre el fondo oscuro cumple AA; los links mono 11.5px
  están sobre `--bg-card` con suficiente contraste

---

## Assets

- **Sin imágenes externas** — toda la ilustración es SVG inline (`Backdrop`, `Hero404`,
  `Hero500`, helper `meeple()`) + iconos SVG inline en `error-app.jsx → EIcon`
  (Home, Back, Retry, Dice, Calendar, Heart, Mail)
- Monograma de marca = CSS puro (`.errBrandMark`)
- **Fuentes**: Poppins (500-800), Archivo (400-700), JetBrains Mono (400-600).
  Para el 500, considerar **inline/system-font fallback** por si las fuentes no cargan.

---

## Files (referencia)

- `Errores Reimagined.html` — entry HTML (React/ReactDOM/Babel + scripts)
- `reimagined-styles.css` — tokens compartidos del sistema
- `error-styles.css` — estilos de las pantallas (stage, backdrop, card, code, acciones, links, incidente, `.is500`)
- `error-app.jsx` — `ErrorApp` (404+500 con toggle) + `Hero404` + `Hero500` + `Backdrop` + `EIcon` + helper `meeple()`

Codebase a crear:
- `client/src/pages/error/NotFound.jsx` (404, ruta `*`)
- `client/src/pages/error/ServerError.jsx` (500, `errorElement` + Error Boundary)
- `Error.module.css` compartido (o componente base `<ErrorScreen variant>`)

---

## Checklist de implementación

- [ ] Componente base `<ErrorScreen variant="404|500">` + wrappers NotFound / ServerError
- [ ] Ilustraciones SVG inline (backdrop + hero por variante)
- [ ] Código gigante con gradiente + tematización `.is500`
- [ ] 404: quick links a secciones (idealmente configurables)
- [ ] 500: código de incidente (correlation-id real) + copiar al portapapeles
- [ ] Acciones: navigate('/'), navigate(-1), retry/reset boundary
- [ ] Montaje en router: catch-all `*` + `errorElement` + Error Boundary global
- [ ] Status HTTP correcto server-side (404/500), no solo visual
- [ ] `prefers-reduced-motion`: desactivar animaciones
- [ ] 500 auto-contenido (estilos/SVG inline, sin depender de assets que podrían fallar)
- [ ] Reporte a monitoring (Sentry) con correlation-id
- [ ] Responsive ≤ 520px (botones apilados)
- [ ] Accesibilidad: jerarquía de headings, foco, aria-live en copiar, aria-hidden en backdrop
