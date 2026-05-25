# Plan: Página Utilidades + Selector de Dedos

## Context

Se necesita una nueva sección "Utilidades" con mini-apps para usar desde el celular durante partidas de mesa. La primera mini-app es un selector aleatorio de jugadores basado en detección de dedos en pantalla (estilo Chwazi).

---

## Archivos a crear

```
client/src/pages/utilidades/
  Utilidades.jsx           — página principal con grilla 3×3 de cards
  Utilidades.module.css
  UtilCard.jsx             — card reutilizable para cada utilidad
  UtilCard.module.css
  FingerSelector.jsx       — mini-app fullscreen
  FingerSelector.module.css
```

## Archivos a modificar

| Archivo                                      | Cambio                        |
| -------------------------------------------- | ----------------------------- |
| `client/src/App.jsx`                         | 2 rutas nuevas + imports      |
| `client/src/components/layout/Sidebar.jsx`   | item "Utilidades" + SVG ícono |
| `client/src/components/layout/BottomNav.jsx` | item "Utilidades" + SVG ícono |

---

## 1. Rutas — `App.jsx`

```jsx
<Route path="/utilidades" element={<Utilidades />} />
<Route path="/utilidades/selector-de-dedos" element={<FingerSelector />} />
```

Ambas rutas son **públicas** (sin `PrivateRoute`) — accesibles sin login.

Imports al tope junto con los demás lazy-imports o imports directos.

---

## 2. Navegación

### Sidebar.jsx

Agregar al array `NAV` (antes de `db`):

```js
{ id: 'utilidades', label: 'Utilidades', to: '/utilidades' }
```

Agregar SVG `UtilidadesIcon` (ícono de llave inglesa o apps-grid) al bloque de íconos custom inline.
Actualizar `getActiveId()` para que `/utilidades` devuelva `'utilidades'`.

### BottomNav.jsx

Agregar al array `NAV` (antes de `db`):

```js
{ id: 'utilidades', label: 'Utilidades', Icon: UtilidadesIcon, to: '/utilidades' }
```

Agregar SVG `UtilidadesIcon` al bloque de íconos al tope del archivo.

---

## 3. `Utilidades.jsx` — Grilla de mini-apps

Estructura:

```jsx
<div className={styles.page}>
  <div className={styles.inner}>
    <h1>Utilidades</h1>
    <p className={styles.subtitle}>Mini-apps para la mesa</p>
    <div className={styles.grid}>
      <UtilCard
        icon="👆"
        title="Selector de dedos"
        description="Elegí al azar quién empieza"
        to="/utilidades/selector-de-dedos"
      />
      {/* 8 cards "Próximamente" griseadas */}
      {Array(8)
        .fill(null)
        .map((_, i) => (
          <UtilCard key={i} comingSoon />
        ))}
    </div>
  </div>
</div>
```

CSS: grilla `grid-template-columns: repeat(3, 1fr)`, gap 16px. En mobile (< 600px): 2 columnas.

---

## 4. `UtilCard.jsx`

Props: `icon`, `title`, `description`, `to`, `comingSoon`.

- Si `comingSoon`: card griseada, no clickeable, badge "Próximamente"
- Si tiene `to`: usar `<Link>` de react-router-dom
- Hover lift: `translateY(-2px)` + `--shadow-amber` (igual que `TableCard`)

---

## 5. `FingerSelector.jsx` — La mini-app

### Layout

`position: fixed; inset: 0; z-index: 9999` — cubre todo el viewport incluyendo navbars. Fondo negro. Botón "←" arriba a la izquierda para volver a `/utilidades`.

### Fases (state machine)

```
idle → waiting → selecting → result
```

| Fase        | UI                                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| `idle`      | Mensaje "Pongan los dedos en la pantalla" centrado                            |
| `waiting`   | Dots de colores en posición de cada dedo + countdown circular (3→0) en centro |
| `selecting` | Dots no ganadores se encogen/desvanecen (300ms)                               |
| `result`    | Ganador pulsa con glow + texto "¡Empezás vos!" + botón "Jugar de nuevo"       |

### Colores por dedo (hasta 10)

```js
const FINGER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#ffffff",
];
```

### Touch tracking

```js
const touchMapRef = useRef(new Map()); // identifier → { x, y, color, colorIndex }
const [dots, setDots] = useState([]); // array para render
const [phase, setPhase] = useState("idle");
const [countdown, setCountdown] = useState(3);
const [winnerId, setWinnerId] = useState(null);
const timerRef = useRef(null);
const intervalRef = useRef(null);
```

Escuchar eventos con `useEffect` usando `addEventListener` con `{ passive: false }` en el contenedor ref para poder llamar `e.preventDefault()` (evita scroll/zoom del browser mientras hay dedos).

```
touchstart  → asignar color a identifier nuevo, agregar al Map, sync dots
touchmove   → actualizar x,y en el Map, sync dots
touchend / touchcancel → eliminar del Map, sync dots; si fingers < 2 resetear countdown
```

### Countdown logic

- Al pasar a >= 2 dedos: iniciar interval de 1 seg que decrementa countdown 3→2→1
- Al llegar a 0: elegir ganador aleatorio de las entradas activas del Map → `selecting` → (300ms) → `result`
- Si fingers bajan a < 2 antes de llegar a 0: limpiar interval, resetear countdown=3, fase=`waiting` (o `idle` si 0 dedos)

### Animaciones CSS

```css
.dot {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(1);
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.dot.loser {
  transform: translate(-50%, -50%) scale(0);
  opacity: 0;
}
.dot.winner {
  animation: winnerPulse 0.6s ease infinite alternate;
}

@keyframes winnerPulse {
  from {
    transform: translate(-50%, -50%) scale(1.2);
  }
  to {
    transform: translate(-50%, -50%) scale(1.6);
    filter: brightness(1.3);
  }
}
```

El countdown circular se implementa con un `<svg>` + `stroke-dashoffset` para el progress ring.

---

## Verificación

1. `npm run dev:client` + `npm run dev:server`
2. Login → ver "Utilidades" en Sidebar (desktop) y en BottomNav (mobile, scrollear si hace falta)
3. Navegar a `/utilidades` → grilla con 1 card activa + 8 "Próximamente"
4. Click "Selector de dedos" → pantalla fullscreen negra
5. Simular multi-touch en DevTools (toggle device toolbar + "touch" cursor) con 2+ puntos
6. Verificar: dots aparecen en colores distintos, countdown inicia, al llegar a 0 queda un ganador
7. "Jugar de nuevo" → vuelve a `idle`
8. Botón "←" → navega a `/utilidades`
