# Plan: Sistema de Mensajes Directos + Chat Admin (Facebook-style)

## Context

Turnocero no tiene mensajería directa. El chat actual solo existe dentro de las mesas. Se necesita:

1. **DMs entre amigos** — como Facebook Messenger: chat windows flotantes que persisten al navegar, inbox en `/mensajes`
2. **Chat grupal de admins** — sala privada solo para admins

**Modelo de UX:**

- **Desktop (≥960px):** ventanas flotantes en el bottom-right de la pantalla (máx 3 abiertas a la vez), minimizables. El usuario puede chatear mientras navega a cualquier página.
- **Mobile (<960px):** al abrir un chat navega a `/mensajes/:userId` (pantalla completa). El inbox está en `/mensajes`.

---

## Archivos críticos

### Server (nuevos)

- `server/models/DirectMessage.js`
- `server/models/AdminMessage.js`
- `server/routes/dm.js`
- `server/routes/adminChat.js`

### Server (modificar)

- `server/server.js` — registrar rutas; en `io.on('connection')`, si el usuario es admin → `socket.join('admin:room')`
- `server/utils/saveNotification.js` — agregar `'dm'` al set AGGREGATING

### Client (nuevos)

- `client/src/context/ChatContext.jsx` — estado global de conversaciones abiertas + socket DMs
- `client/src/components/chat/ChatWindow.jsx` — ventana flotante individual
- `client/src/components/chat/ChatWindow.module.css`
- `client/src/components/chat/ChatWindowManager.jsx` — renderiza hasta 3 ventanas flotantes
- `client/src/pages/messages/Messages.jsx` — inbox `/mensajes` (lista de conversaciones)
- `client/src/pages/messages/Messages.module.css`
- `client/src/pages/messages/DirectChat.jsx` — chat mobile `/mensajes/:userId`
- `client/src/pages/messages/DirectChat.module.css`
- `client/src/pages/messages/AdminChat.jsx` — chat admin `/mensajes-admin`
- `client/src/pages/messages/AdminChat.module.css`

### Client (modificar)

- `client/src/App.jsx` — agregar rutas; renderizar `<ChatWindowManager />` dentro del shell autenticado
- `client/src/components/layout/Sidebar.jsx` — agregar "Mensajes" con badge unread + "Chat Admin" (adminOnly)
- `client/src/components/layout/BottomNav.jsx` — agregar "Mensajes"
- `client/src/context/NotificationContext.jsx` — delegar eventos `dm:message` al ChatContext

---

## Paso 1 — Modelos Mongoose

### `DirectMessage`

```js
{ from: ObjectId (ref User, required),
  to: ObjectId (ref User, required),
  content: String (max 1000, required),
  readByRecipient: Boolean (default false),
  timestamps: true }
// Índices: { from, to, createdAt } y { to, from, createdAt }
```

### `AdminMessage`

```js
{ from: ObjectId (ref User, required),
  content: String (max 2000, required),
  timestamps: true }
```

---

## Paso 2 — Rutas DM (`/api/dm`)

Todas requieren `protect`. Solo entre amigos (validar `req.user.friends.includes(userId)`).

| Método | Path                   | Descripción                                                                                           |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/api/dm`              | Lista de conversaciones — aggregation: última msg por contacto + unreadCount                          |
| GET    | `/api/dm/:userId`      | Historial paginado (`?page`, `?limit=40`), ordenado ASC                                               |
| POST   | `/api/dm/:userId`      | Enviar mensaje. Verifica amistad. Emite `dm:message`. Guarda notificación tipo `dm`.                  |
| PATCH  | `/api/dm/:userId/read` | Marca `readByRecipient=true` donde `to=currentUser, from=userId`. Llama `markRead` en notificaciones. |

---

## Paso 3 — Rutas Admin Chat (`/api/admin-chat`)

Requieren `protect` + `requireAdmin`.

| Método | Path              | Descripción                                          |
| ------ | ----------------- | ---------------------------------------------------- |
| GET    | `/api/admin-chat` | Últimos 100 mensajes, ASC                            |
| POST   | `/api/admin-chat` | Crear mensaje. Emite `admin:message` a `admin:room`. |

---

## Paso 4 — Socket.IO (server.js)

En `io.on('connection')`, después del join a `user:{userId}`:

```js
const user = await User.findById(socket.userId).select("isAdmin");
if (user?.isAdmin) socket.join("admin:room");
```

Eventos emitidos desde rutas:

- `dm:message` → `io.to('user:{recipientId}').emit('dm:message', populatedMessage)`
- `admin:message` → `io.to('admin:room').emit('admin:message', populatedMessage)`

---

## Paso 5 — ChatContext

Estado global que vive en el App shell (debajo de AuthProvider):

```js
{
  conversations: Map<userId, { messages[], unread, user, minimized }>,
  openChat(user),      // abre o trae al frente una ventana
  closeChat(userId),
  minimizeChat(userId),
  sendMessage(userId, content),
  dmUnreadTotal,       // suma total para el badge del nav
}
```

- Al montar: llama `GET /api/dm` para cargar las conversaciones previas
- Escucha el evento `dm:message` del socket (compartir el socket de NotificationContext o crear uno propio — preferir reutilizar el de NotificationContext pasándolo por context)
- Al recibir `dm:message`: si la ventana está abierta y no minimizada → agrega a messages, marca leído (`PATCH`); si no → incrementa unread
- **No duplicar la conexión Socket.IO**: el ChatContext consume el socket expuesto por NotificationContext

---

## Paso 6 — ChatWindowManager + ChatWindow

### `ChatWindowManager.jsx`

- Renderizado en `App.jsx` dentro del shell autenticado, fuera del `<Routes>`
- En desktop: muestra hasta 3 `<ChatWindow>` flotantes, alineadas desde bottom-right hacia la izquierda
- En mobile: no renderiza nada (el chat mobile usa rutas dedicadas)
- Lógica de cola: si hay más de 3 abiertas, las más antiguas se colapsan automáticamente

### `ChatWindow.jsx` (desktop only)

```
┌─────────────────────────┐  ← fixed, bottom-right
│ 👤 Username         _ × │  ← header: avatar + nombre + minimizar + cerrar
├─────────────────────────┤
│                         │
│   [mensajes]            │  ← lista de mensajes, scroll interno, 320px alto
│                         │
├─────────────────────────┤
│ Escribir...      Enviar │  ← input + botón
└─────────────────────────┘
  280px ancho
```

- Estado: `minimized` (solo muestra el header con badge unread)
- Estilos: usa variables CSS del tema (`--bg-card`, `--amber`, `--border`, etc.)
- Posicionamiento: `position: fixed; bottom: 0; right: Npx` donde N depende del índice en el array

---

## Paso 7 — Páginas cliente

### `/mensajes` — Inbox (Messages.jsx)

- Lista de conversaciones ordenada por fecha del último mensaje
- Cada item: avatar (inicial), nombre, preview (60 chars), timestamp relativo, badge unread
- Clic en desktop: llama `openChat(user)` del ChatContext (no navega)
- Clic en mobile: navega a `/mensajes/:userId`
- Botón "+ Nueva conversación": muestra lista de amigos para iniciar chat

### `/mensajes/:userId` — Chat mobile (DirectChat.jsx)

- Solo relevante en mobile; en desktop el ChatWindow hace este trabajo
- Header con ← volver + nombre del contacto
- Misma UI que el chat de mesas (burbujas propias a la derecha en amber)
- Al montar: `GET /api/dm/:userId` + `PATCH /api/dm/:userId/read`

### `/mensajes-admin` — Admin group chat (AdminChat.jsx)

- Requiere `isAdmin`; redirigir si no es admin
- `GET /api/admin-chat` al montar
- Socket listener `admin:message` (puede estar en el NotificationContext o manejado localmente)
- UI de chat grupal: mensajes con sender name visible para todos
- Header: "Chat Admin 🔒" con indicador de sala compartida

---

## Paso 8 — Navegación

### Sidebar.jsx

Insertar entre "Notificaciones" y "Compartite":

```js
{ id: 'mensajes', label: 'Mensajes', to: '/mensajes' }  // badge dmUnreadTotal del ChatContext
```

Al final (adminOnly):

```js
{ id: 'admin-chat', label: 'Chat Admin', to: '/mensajes-admin', adminOnly: true }
```

### BottomNav.jsx

Agregar `{ id: 'mensajes', label: 'Mensajes', to: '/mensajes' }`.

### App.jsx

```jsx
// Dentro del shell autenticado:
<ChatWindowManager />   {/* fuera de <Routes>, persiste al navegar */}

// Rutas nuevas:
<Route path="/mensajes" element={<PrivateRoute><Messages /></PrivateRoute>} />
<Route path="/mensajes/:userId" element={<PrivateRoute><DirectChat /></PrivateRoute>} />
<Route path="/mensajes-admin" element={<PrivateRoute><AdminChat /></PrivateRoute>} />
```

---

## Verificación

1. **Floating chat desktop:** Loguear como User A → ir a `/mensajes` → abrir chat con amigo B → navegar a `/mesas` → verificar que la ventana flotante sigue visible → enviar mensaje → en otra pestaña como B verificar que llega en tiempo real con toast.
2. **Mobile:** En viewport <960px → `/mensajes` → tap en conversación → verifica que navega a `/mensajes/:userId` (no abre ventana flotante).
3. **Unread badge:** Cerrar la ventana de chat → recibir mensaje como B → verificar badge en "Mensajes" del nav.
4. **Admin chat:** Loguear como admin → `/mensajes-admin` → enviar mensaje → segunda sesión admin verifica que llega en real-time → verificar que un no-admin recibe 403 en `GET /api/admin-chat`.
5. **Restricción de amistad:** `POST /api/dm/:userId` con usuario no-amigo → esperar 403.
