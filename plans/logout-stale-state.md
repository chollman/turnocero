# Plan: Corregir estado stale en logout/login

## Context

El bug reportado en `/mensajes` (ChatContext no reseteaba `conversations` al desloguearse) reveló un patrón más amplio: componentes que cargan estado basado en el usuario autenticado pero no lo limpian cuando `user` se vuelve `null`. Cuando un segundo usuario inicia sesión en la misma pestaña, ve brevemente datos del usuario anterior.

Se analizaron todos los contextos, componentes de shell y páginas. ChatContext y ChatLauncher ya fueron corregidos. Quedan dos casos con el mismo problema.

---

## Casos encontrados

### 1. `NotificationContext.jsx` — CRÍTICO

**Problema:**
- `useState(loadFromStorage)` inicializa el estado con notificaciones de la sesión anterior (desde `localStorage`)
- El `useEffect([user])` no limpia el estado cuando `user` pasa a `null`
- Flujo del bug: Usuario A login → notificaciones cargadas y guardadas en localStorage → logout → Usuario B login en la misma pestaña → `useState(loadFromStorage)` carga las notificaciones de A → flash visible hasta que llega la respuesta del servidor

**Fix:** En el `useEffect([user])`, agregar rama `if (!user)` que resetea `notifications`, `toasts`, y `adminChatUnread`.

### 2. `CompartidasSidebar.jsx` — MEDIO

**Problema:**
- `useEffect([], [])` (sin dependencias) solo corre al montar
- Llama a `/api/tables/mine` (datos privados del usuario) sin saber qué usuario está activo
- Si la ruta padre sobrevive a un cambio de usuario sin desmontar, muestra las mesas del usuario anterior
- Actualmente se renderiza dentro de `Compartidas.jsx` y `CompartidaPost.jsx` (rutas privadas que desmontan al hacer logout), por lo que el riesgo práctico es bajo pero el diseño es frágil

**Fix:** Agregar `useAuth`, convertir el `useEffect` para que dependa de `[user]`, limpiar `tables` cuando `user` es null.

> Nota: `topGames` viene de `/api/tables/top-games` (endpoint público, no user-specific) — no necesita limpiarse.

### Componentes descartados (sin bug)

| Componente | Motivo |
|---|---|
| `MeFeed.jsx` | Ruta privada, desmonta en logout. `useEffect([uid])` ya guarda con `if (!uid) return` |
| `Messages.jsx` | Ruta privada, desmonta en logout. `friends` se recarga en cada mount |
| `Sidebar`, `Navbar`, `BottomNav` | Sin estado user-dependiente |
| Layout shell | Sin estado user-dependiente |

---

## Implementación

### Archivo 1: `client/src/context/NotificationContext.jsx`

En el `useEffect` de carga de notificaciones (línea ~32), agregar rama de limpieza en logout:

```js
useEffect(() => {
  if (!user) {
    setNotifications([]);
    setToasts([]);
    setAdminChatUnread(0);
    return;
  }
  axios.get('/api/notifications')
    .then(({ data }) => setNotifications(data))
    .catch(() => {});
}, [user]);
```

El `useEffect` que sincroniza con localStorage (`useEffect(() => { localStorage.setItem... }, [notifications])`) automáticamente persiste `[]` cuando se limpie, borrando los datos del usuario anterior.

### Archivo 2: `client/src/pages/compartidas/CompartidasSidebar.jsx`

1. Agregar import de `useAuth`
2. Obtener `user` del contexto
3. Cambiar `useEffect(fn, [])` por `useEffect(fn, [user])` con limpieza de `tables` cuando `user` es null:

```js
import { useAuth } from '../../context/AuthContext'

// dentro del componente:
const { user } = useAuth()
const [tables, setTables] = useState([])
const [topGames, setTopGames] = useState([])

useEffect(() => {
  if (!user) {
    setTables([])
    return
  }
  axios.get('/api/tables/mine', { params: { limit: 4 } })
    .then(({ data }) => { ... setTables(upcoming) })
    .catch(() => {})

  axios.get('/api/tables/top-games')
    .then(({ data }) => setTopGames(data))
    .catch(() => {})
}, [user])
```

---

## Archivos a modificar

- `client/src/context/NotificationContext.jsx` — línea ~32 (`useEffect` de carga de notificaciones)
- `client/src/pages/compartidas/CompartidasSidebar.jsx` — línea ~21 (`useEffect` sin dependencias)

---

## Verificación

1. Iniciar sesión como Usuario A → verificar que notificaciones y mesas en CompartidasSidebar corresponden a A
2. Cerrar sesión → navegar a login
3. Iniciar sesión como Usuario B → verificar que no aparece ningún dato de A:
   - Notificaciones: deben ser las de B (o vacías si no tiene)
   - CompartidasSidebar en `/compartidas`: mesas de B
4. Repetir en sentido inverso (B → A)
