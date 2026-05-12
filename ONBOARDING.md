# Turnocero — Onboarding

## ¿Qué es esto?

Turnocero es una app web para organizar partidas de juegos de mesa. Los usuarios crean *mesas* (sesiones), otros se unen, y la app gestiona toda la coordinación: chat, fotos, notificaciones, solicitudes de ingreso, etc. La UI está en español rioplatense.

---

## Setup inicial

### Requisitos
- Node.js 18+
- MongoDB corriendo localmente (o una URI de Atlas)
- Una cuenta de Cloudinary (para subida de imágenes/avatares)

### Pasos

```bash
# 1. Instalar dependencias de cliente y servidor
npm run install:all

# 2. Configurar variables de entorno del servidor
cp server/.env.example server/.env
# Editar server/.env con tus valores

# 3. Configurar variable de entorno del cliente
echo "VITE_API_URL=http://localhost:4000" > client/.env.local

# 4. Levantar ambos servidores (en terminales separadas)
npm run dev:server   # backend en :4000
npm run dev:client   # frontend en :3000
```

### Variables de entorno (server/.env)

| Variable | Descripción |
|---|---|
| `MONGODB_URI` | URI de MongoDB (default: `mongodb://localhost:27017/turnocero`) |
| `JWT_SECRET` | Cualquier string secreto |
| `PORT` | Puerto del servidor (usar `4000` para coincidir con el proxy de Vite) |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud de Cloudinary |
| `CLOUDINARY_API_KEY` | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary |
| `CORS_ORIGIN` | `http://localhost:3000` en desarrollo |

---

## Estructura del proyecto

```
turnocero/
├── client/          # React 18 + Vite
│   └── src/
│       ├── context/ # AuthContext, NotificationContext
│       ├── pages/   # Una página por ruta
│       └── components/
├── server/          # Express + Mongoose + Socket.IO
│   ├── models/      # User, Table, Message, Comment, Rating
│   ├── routes/      # Un archivo por recurso
│   └── middleware/  # auth.js (protect)
└── docs/            # Documentación adicional
```

Vite proxea `/api/*` → `http://localhost:4000/api`. Todos los calls de Axios en el cliente usan rutas relativas `/api/...`.

---

## Conceptos clave

### Mesas (Tables)
El modelo central. Tienen:
- `status`: `open` / `full` (auto por pre-save hook) / `cancelled`
- `privacy`: `public` (join directo) o `private` (requiere aprobación del host)
- `pendingRequests`: usuarios que solicitaron unirse a una mesa privada
- `reactions`, `followers`, `images`: features sociales

### Auth
JWT de 7 días guardado en `localStorage`. `AuthContext` lo inyecta como header `Authorization` en Axios. Al cargar la app se re-valida con `GET /api/auth/me`.

### Real-time (Socket.IO)
El servidor expone el objeto `io` via `app.set('io', io)` y las rutas lo usan directamente para emitir eventos. Cada usuario conectado entra automáticamente al room `user:<userId>`. Al abrir una mesa, el cliente emite `join:table <tableId>`.

Eventos principales: `chat:message`, `chat:notification`, `join:request`, `join:accepted`, `table:comment`, `table:image`, `table:spot-opened`.

### Notificaciones
`NotificationContext` escucha los eventos Socket.IO y persiste las notificaciones en `localStorage`. `setActiveTable(tableId)` suprime y limpia las notificaciones de la mesa actualmente abierta.

---

## Convenciones

- **CSS**: Módulos por componente (`.module.css`). Variables globales de color/tema en `client/src/index.css` (`--amber`, `--bg-dark`, etc.)
- **Validación**: `express-validator` en todas las rutas de escritura
- **Commits**: siempre en inglés
- **Idioma de UI**: español rioplatense en todo texto visible para el usuario

---

## Rutas importantes

| Ruta frontend | Descripción |
|---|---|
| `/` | Dashboard (todas las mesas / mis mesas) |
| `/tables/:id` | Detalle de mesa: chat, comentarios, imágenes, requests |
| `/tables/new` | Crear mesa |
| `/tables/:id/edit` | Editar mesa (solo host) |
| `/notifications` | Lista de notificaciones |
| `/profile` | Perfil propio |
| `/users/:id` | Perfil público de otro usuario |
| `/users` | Lista de la comunidad |

---

## Limitaciones conocidas

- **Sin integración BGG**: Se intentó integrar la API de BoardGameGeek pero fue revertida por problemas de CORS irresolubles. No reintegrar sin una solución concreta.
- **Chat limitado**: El historial de chat se carga con un máximo de 200 mensajes.
- **Ratings**: El modelo y las rutas existen pero la UI no está implementada todavía.
- **Sin tests**: No hay suite de tests configurada.
