# 🎲 Turnocero

Aplicación para organizar mesas de juegos de mesa. Los usuarios pueden registrarse, crear mesas para una partida (con fecha, juego y cantidad de lugares) y unirse a mesas de otros jugadores.

---

## Stack

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Base de datos:** MongoDB (con Mongoose)
- **Auth:** JWT + bcrypt

---

## Requisitos previos

- Node.js 18+
- MongoDB corriendo localmente (o una URL de MongoDB Atlas)

---

## Instalación

### 1. Clonar / abrir el proyecto

```bash
cd "Table Creator"
```

### 2. Instalar dependencias del servidor

```bash
cd server
npm install
```

### 3. Configurar variables de entorno del servidor

```bash
cp .env.example .env
```

Editá `server/.env`:

```
MONGODB_URI=mongodb://localhost:27017/turnocero
JWT_SECRET=cambia_esto_por_algo_seguro
PORT=5000
```

### 4. Instalar dependencias del cliente

```bash
cd ../client
npm install
```

---

## Correr en desarrollo

Necesitás **dos terminales**:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Servidor en http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# App en http://localhost:3000
```

---

## Estructura del proyecto

```
Table Creator/
├── server/
│   ├── models/
│   │   ├── User.js          # Modelo de usuario
│   │   └── Table.js         # Modelo de mesa
│   ├── routes/
│   │   ├── auth.js          # POST /api/auth/register, /login, GET /me
│   │   └── tables.js        # CRUD de mesas + join/leave
│   ├── middleware/
│   │   └── auth.js          # Middleware JWT
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── client/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.jsx   # Auth global (login, register, logout)
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   └── TableCard.jsx     # Tarjeta de mesa con acciones
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx     # Lista de mesas
    │   │   └── CreateTable.jsx   # Formulario crear mesa
    │   ├── App.jsx
    │   └── index.css             # Variables de tema Turnocero
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## API Endpoints

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Obtener usuario actual |

### Mesas (requieren token JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tables` | Listar todas las mesas activas |
| GET | `/api/tables/mine` | Listar mis mesas (host o jugador) |
| POST | `/api/tables` | Crear una mesa |
| POST | `/api/tables/:id/join` | Unirse a una mesa |
| POST | `/api/tables/:id/leave` | Abandonar una mesa |
| DELETE | `/api/tables/:id` | Cancelar una mesa (solo host) |

---

## Funcionalidades

- ✅ Registro e inicio de sesión con JWT
- ✅ Crear mesas (juego, fecha/hora, lugares disponibles, ubicación, descripción)
- ✅ Unirse / abandonar mesas
- ✅ El creador es el **host** y puede cancelar la mesa
- ✅ Estado automático: mesa abierta / completa
- ✅ Filtro por nombre de juego o host
- ✅ Vista "Mis mesas"
- ✅ Diseño oscuro estilo tablero de juego
