# Turnocero

Aplicación para organizar mesas de juegos de mesa. Los usuarios pueden registrarse, crear mesas para una partida (con fecha, juego y cantidad de lugares) y unirse a mesas de otros jugadores.

---

## Stack

- **Frontend:** React 18 + Vite + React Router (HashRouter)
- **Backend:** Node.js + Express + Socket.io
- **Base de datos:** MongoDB (con Mongoose)
- **Auth:** JWT + bcrypt (token en cookie httpOnly + localStorage)
- **Mapa:** Leaflet + OpenStreetMap / Nominatim

---

## Requisitos previos

- Node.js 18+
- MongoDB corriendo localmente (o una URL de MongoDB Atlas)

---

## Instalación

### 1. Instalar todas las dependencias (desde la raíz)

```bash
npm run install:all
```

O manualmente:

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configurar variables de entorno del servidor

```bash
cp server/.env.example server/.env
```

Editá `server/.env`:

```
MONGODB_URI=mongodb://localhost:27017/turnocero
JWT_SECRET=cambia_esto_por_algo_seguro
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

---

## Correr en desarrollo

Necesitás **dos terminales** (o usá los scripts desde la raíz):

```bash
# Desde la raíz
npm run dev:server    # Backend en http://localhost:4000
npm run dev:client    # Frontend en http://localhost:3000
```

El servidor de Vite hace proxy de `/api/*` hacia `http://localhost:4000/api`.

---

## Estructura del proyecto

```
turnocero/
├── server/
│   ├── models/
│   │   ├── User.js          # Usuario con perfil completo, isAdmin
│   │   ├── Table.js         # Mesa de juego
│   │   └── Message.js       # Mensajes de chat por mesa
│   ├── routes/
│   │   ├── auth.js          # POST /register, /login, GET /me, PATCH /profile
│   │   ├── tables.js        # CRUD de mesas + join/leave + edit
│   │   ├── messages.js      # Chat por mesa (GET/POST)
│   │   ├── users.js         # Listado y perfil público de usuarios
│   │   └── admin.js         # Visor de DB y toggle de admin (solo admins)
│   ├── middleware/
│   │   └── auth.js          # Middleware JWT + requireAdmin
│   ├── utils/
│   │   └── logger.js        # Logger centralizado
│   ├── server.js            # Express + Socket.io + rutas
│   ├── .env.example
│   └── package.json
│
└── client/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.jsx       # Auth global (login, register, logout, updateProfile)
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── TableCard.jsx         # Tarjeta de mesa con acciones
    │   │   ├── AuthLogo.jsx
    │   │   ├── BoardGameBackground.jsx
    │   │   └── PasswordInput.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx         # Lista de mesas + búsqueda + tabs
    │   │   ├── CreateTable.jsx       # Formulario crear mesa
    │   │   ├── EditTable.jsx         # Editar mesa propia
    │   │   ├── TableDetail.jsx       # Detalle de mesa + chat en tiempo real
    │   │   ├── UserProfile.jsx       # Editar perfil propio con mapa
    │   │   ├── UserProfilePublic.jsx # Perfil público de otro usuario + estadísticas
    │   │   ├── UsersList.jsx         # Comunidad: listado de todos los jugadores
    │   │   └── DatabaseViewer.jsx    # Visor de colecciones (solo admins)
    │   ├── App.jsx
    │   └── index.css                 # Variables de tema Turnocero
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## API Endpoints

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario (rate-limited) |
| POST | `/api/auth/login` | Iniciar sesión (rate-limited) |
| GET | `/api/auth/me` | Obtener usuario actual |
| PATCH | `/api/auth/profile` | Actualizar perfil propio |

### Mesas (requieren token JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tables` | Listar todas las mesas activas |
| GET | `/api/tables/mine` | Listar mis mesas (host o jugador) |
| GET | `/api/tables/:id` | Detalle de una mesa |
| POST | `/api/tables` | Crear una mesa |
| PUT | `/api/tables/:id` | Editar una mesa (solo host) |
| POST | `/api/tables/:id/join` | Unirse a una mesa |
| POST | `/api/tables/:id/leave` | Abandonar una mesa |
| DELETE | `/api/tables/:id` | Cancelar una mesa (solo host) |

### Chat (solo participantes)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tables/:id/messages` | Historial de mensajes |
| POST | `/api/tables/:id/messages` | Enviar mensaje (emite por WebSocket) |

### Usuarios (requieren token JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users` | Listado de usuarios con búsqueda y filtros |
| GET | `/api/users/:id` | Perfil público + estadísticas de un usuario |

### Admin (requieren token JWT + isAdmin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/collections` | Listar colecciones de MongoDB |
| GET | `/api/admin/collections/:name` | Ver documentos de una colección (paginado) |
| PATCH | `/api/admin/users/:id/admin` | Toggle de admin de un usuario |

### Salud
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor |

---

## WebSockets (Socket.io)

El servidor usa Socket.io con autenticación JWT por handshake. Los clientes emiten:

- `join:table` — entrar a la sala de una mesa
- `leave:table` — salir de la sala

El servidor emite:

- `chat:message` — nuevo mensaje de chat a todos los participantes en la sala

---

## Funcionalidades

- Registro e inicio de sesión con JWT (cookie httpOnly + localStorage) y rate limiting
- Contraseña con validación: mínimo 8 caracteres, una mayúscula, un número
- Crear, editar y cancelar mesas (juego, fecha/hora, lugares, ubicación, descripción)
- Unirse / abandonar mesas
- Estado automático de mesa: abierta / completa / cancelada
- Chat en tiempo real por mesa (solo visible para host y jugadores)
- Perfil de usuario editable: nombre, apellido, display name, Telegram, celular, dirección con mapa interactivo (Leaflet + Nominatim)
- Pantalla de comunidad: listado de jugadores con búsqueda, ordenamiento por actividad/fecha, filtro de solo activos
- Perfil público de cada usuario con estadísticas: mesas creadas, jugadas, juegos favoritos, última actividad
- Visor de base de datos para admins (colecciones paginadas, toggle de admin)
- Fondo animado estilo tablero de juego
- Diseño oscuro con tema ámbar/dorado
