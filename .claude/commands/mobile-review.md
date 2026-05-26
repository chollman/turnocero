Revisá todos los archivos de UI modificados en `client/src/` para detectar y corregir problemas de responsividad mobile.

## Pasos

1. Corré `git diff --name-only HEAD` para encontrar archivos modificados. Si no hay cambios sin commitear, usá `git diff --name-only HEAD~1 HEAD` para obtener el último commit.
2. Filtrá archivos bajo `client/src/` con extensión `.jsx`, `.js`, o `.module.css`.
3. Leé cada archivo modificado y revisá los problemas listados abajo.
4. Para cada problema real encontrado, aplicá el fix directamente. **No hagas cambios especulativos.**
5. Reportá un resumen conciso: lista de archivos cambiados, una línea por fix aplicado.

## Qué revisar

### En archivos CSS Module (`.module.css`)

**Anchos y altos fijos**

- Propiedades `width`, `height`, `min-width`, `min-height` con valores en `px` que puedan cortar contenido en pantallas pequeñas — reemplazalos con `%`, `vw/vh`, `min()`, `max()`, o `clamp()` según corresponda
- Contenedores con `width: Xpx` superiores a 320px sin un fallback responsive

**Overflow y scroll**

- Contenedores horizontales sin `overflow-x: hidden` o `overflow-x: auto` que puedan romper el layout en mobile
- Texto largo sin `word-break: break-word` o `overflow-wrap: break-word`

**Media queries**

- Componentes con layout complejo (flexbox multi-columna, grid) sin ninguna media query `@media (max-width: ...)` — agregá al menos un breakpoint en `768px`
- Propiedades que se ven bien en desktop pero rompen en mobile (ej: `flex-direction: row` sin wrap, columnas de grid fijas)

**Tipografía**

- `font-size` en `px` menores a 14px (difícil de leer en mobile) — convertí a `rem` o usá `clamp()`
- Line-height fijo en `px` que no escala con el texto

**Touch targets**

- Botones, links e íconos interactivos con `height` o `padding` tan pequeños que el área táctil quede bajo 44px — agregá `min-height: 44px` o padding suficiente

**Espaciado**

- Márgenes o paddings grandes en `px` (ej: `padding: 48px`) sin reducción en mobile — agregá versión mobile con valor menor

**Variables globales**

- Siempre usá las variables CSS del proyecto (`--bg-dark`, `--amber`, `--green`, `--red`, `--text-primary`, etc.) en lugar de valores hardcodeados

### En archivos JSX (`.jsx` / `.js`)

**Imágenes**

- `<img>` sin `style={{ maxWidth: '100%' }}` o clase CSS equivalente — pueden desbordar el viewport
- Imágenes de Cloudinary: verificá que usen transformaciones responsive (parámetro `w_auto` o ancho acotado)

**Tablas y listas horizontales**

- `<table>` sin un wrapper con `overflow-x: auto` — en mobile las tablas anchas rompen el layout
- Listas horizontales renderizadas con `.map()` sin clase CSS que gestione el wrapping

**Inputs y formularios**

- `<input>`, `<textarea>`, `<select>` sin `width: 100%` en su CSS module — en mobile los campos angostos son difíciles de usar
- Formularios en columna doble sin colapsar a una sola columna en mobile

**Modales y overlays**

- Modales con ancho fijo en `px` que puedan salir de pantalla en mobile — verificá que tengan `max-width: 90vw` o similar

## Breakpoints del proyecto

Usá estos breakpoints como referencia:

- Mobile: `max-width: 600px`
- Tablet: `max-width: 900px`
