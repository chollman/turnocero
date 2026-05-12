# Plan: Social Features para Turnocero

## Context

El objetivo es enriquecer la experiencia dentro de cada mesa con contenido tipo red social. Las funciones nuevas son independientes del chat en vivo y apuntan a que cualquier usuario logueado pueda interactuar con las mesas (reacciones, comentarios) mientras que las imágenes y las valoraciones quedan restringidas a los participantes. Se implementan en fases secuenciales.

---

## Roadmap completo (5 fases, una por vez)

| Fase | Feature | Complejidad | Estado |
|------|---------|-------------|--------|
| 1 | **Reacciones con emojis** (❤️ 🎲 🔥 👍 😄) | Baja | ✅ Completada |
| 2 | **Comentarios** (add/edit/delete) | Media | ✅ Completada |
| 3 | **Imágenes vía Cloudinary** | Alta | ✅ Completada |
| 4 | **Seguir mesa sin unirse** + notificación si se abre un lugar | Media | ✅ Completada |
| 5 | **Valoración post-partida** | Media | Pendiente |

---

## Fase 1 — Reacciones con emojis ✅

### Modelo (server)

**Archivo:** `server/models/Table.js`

Campo agregado:
```js
reactions: [
  {
    user:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, enum: ['❤️','🎲','🔥','👍','😄'], required: true }
  }
]
```
Regla: un usuario puede tener **una sola reacción** por mesa (pero puede cambiarla). Si vuelve a postear la misma, la elimina (toggle).

### API (server)

`POST /api/tables/:id/react` — cualquier usuario logueado (`protect`)
- Body: `{ emoji: '🎲' }`
- Toggle/reemplazar según el estado actual del usuario

### Frontend (client)

- **TableDetail.jsx** — barra completa con 5 botones emoji, conteos, estado activo en amber
- **TableCard.jsx** — versión compacta interactiva en modo grilla
- Ambos con actualización optimista + revert en error

---

## Fase 2 — Comentarios

### Modelo nuevo

**Archivo nuevo:** `server/models/Comment.js`
```js
{ table, author (ref User), content (max 500, required), editedAt (Date), timestamps }
```

### API
- `GET /api/tables/:id/comments` — todos los logueados; orden cronológico; populate author.username
- `POST /api/tables/:id/comments` — todos los logueados; validar content no vacío
- `PUT /api/tables/:id/comments/:commentId` — solo author; actualiza content + editedAt
- `DELETE /api/tables/:id/comments/:commentId` — author o host de la mesa

**Archivo:** `server/routes/comments.js` (nuevo), montado en `server/server.js`

### Frontend
Nueva sección "Comentarios" debajo del panel de detalles en **TableDetail.jsx** (no en el chat).
- Lista de comentarios con avatar/username, timestamp, badge "editado"
- Input para nuevo comentario (textarea + botón Comentar)
- Botones editar/eliminar solo si es el autor o el host
- Inline editing: click editar → input reemplaza el texto

---

## Fase 3 — Imágenes vía Cloudinary

### Dependencias nuevas (server)
```bash
npm install multer cloudinary multer-storage-cloudinary
```

### Variables de entorno (server/.env)
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Modelo
Agregar al schema de `Table.js`:
```js
images: [
  {
    url:       String,
    publicId:  String,  // para poder eliminar de Cloudinary
    uploader:  { type: ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }
]
```
Límite: 10 imágenes por mesa.

### API
- `POST /api/tables/:id/images` — solo miembros (host o players); multipart/form-data; subir a Cloudinary
- `DELETE /api/tables/:id/images/:imageId` — uploader o host; eliminar de Cloudinary con publicId

### Frontend
Galería de imágenes en **TableDetail.jsx**, debajo de los comentarios.
- Grid de thumbnails con lightbox simple al hacer click
- Botón "Agregar foto" solo para miembros (input file hidden, acepta jpg/png/webp, max 5MB)
- Botón eliminar en cada imagen (solo uploader o host)

---

## Fase 4 — Seguir mesa (sin unirse)

### Modelo
Agregar a `Table.js`:
```js
followers: [{ type: ObjectId, ref: 'User' }]
```

### API
`POST /api/tables/:id/follow` — toggle; cualquier usuario logueado que no sea miembro ya.

Trigger: cuando un jugador abandona la mesa (en el endpoint `/leave`), emitir socket `table:spot-opened` a cada follower.

### Frontend
- Botón "Seguir" / "Siguiendo" en **TableCard.jsx** y **TableDetail.jsx** para non-members
- Toast cuando se abre un lugar: "¡Se liberó un lugar en [Mesa]! 🎲 Sumate ahora"

---

## Fase 5 — Valoración post-partida

### Modelo nuevo
**Archivo nuevo:** `server/models/Rating.js`
```js
{ table, rater (ref User), score (1-5, required), comment (max 300), timestamps }
```
Una valoración por user por mesa. Solo disponible si `table.date < Date.now()` y el user fue participante.

### API
- `GET /api/tables/:id/ratings` — miembros; promedio + lista
- `POST /api/tables/:id/ratings` — solo ex-participantes; solo después de la fecha

### Frontend
Sección "¿Cómo estuvo la sesión?" aparece en **TableDetail.jsx** solo si la fecha ya pasó y el user es miembro. Estrellas interactivas (1-5) + textarea opcional.

---

## Archivos críticos a modificar por fase

| Fase | Server | Client |
|------|--------|--------|
| 1 ✅ | `server/models/Table.js`, `server/routes/tables.js` | `client/src/pages/TableDetail.jsx`, `client/src/components/TableCard.jsx`, `TableDetail.module.css`, `TableCard.module.css` |
| 2 | `server/models/Comment.js` (nuevo), `server/routes/comments.js` (nuevo), `server/server.js` | `TableDetail.jsx`, nuevo bloque CSS en `TableDetail.module.css` |
| 3 | `server/models/Table.js`, `server/routes/tables.js` o nuevo `images.js`, `server/server.js` | `TableDetail.jsx`, `TableDetail.module.css` |
| 4 | `server/models/Table.js`, `server/routes/tables.js`, `server/routes/messages.js` (socket emit) | `TableCard.jsx`, `TableDetail.jsx`, `NotificationContext.jsx` |
| 5 | `server/models/Rating.js` (nuevo), `server/routes/ratings.js` (nuevo), `server/server.js` | `TableDetail.jsx`, `TableDetail.module.css` |

---

## Verificación por fase

- **Fase 1 ✅:** Abrir TableDetail como user logueado → clickear emojis → verificar toggle y conteos. Verificar en TableCard que los botones aparecen en modo grilla.
- **Fase 2:** Agregar comentario → editar inline → eliminar como autor y como host.
- **Fase 3:** Subir imagen como miembro → verifica que aparece en galería → eliminar → verifica en Cloudinary dashboard que se eliminó.
- **Fase 4:** Seguir mesa full → un player abandona → verificar toast al follower.
- **Fase 5:** Mesa con fecha pasada → verificar que aparece sección de rating solo para ex-participantes.
