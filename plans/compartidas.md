# Plan: Pantalla de Juntadas

## Context
El usuario quiere una nueva sección social donde los usuarios compartan fotos y relatos de sus partidas. Es un feed estilo Facebook/Instagram: las publicaciones muestran fotos grandes e inline con comentarios debajo, sin página de detalle separada. La sección complementa las Mesas (organización) con contenido social post-evento.

---

## Decisiones de diseño confirmadas
- **Feed**: Posts públicos de toda la comunidad + posts `friends` si son amigos + propios (cualquier privacidad)
- **Layout**: Tarjetas inline, foto grande, comentarios desplegables debajo (no hay `/juntadas/:id`)
- **Like**: Simple ❤️ toggle con contador
- **Privacidad**: `public` | `friends` | `private`

## Sugerencias innovadoras incluidas
1. **"Compartir desde Mesa"** — botón en `TableDetail` que navega a `/juntadas/nueva?mesa=:id` con la mesa pre-vinculada
2. **Mesa mini-card con CTA** — si la mesa vinculada sigue abierta, muestra "Unirse →" directo en el post
3. **"Juntada destacada"** — el post con más likes de las últimas 24h aparece destacado al tope del feed con un badge "🔥 Juntada del día"

---

## Backend

### 1. Nuevo modelo `server/models/Juntada.js`
```js
{
  author:       ObjectId ref User (required, indexed)
  title:        String (optional, max 100, trim)
  body:         String (optional, max 2000, trim)
  images:       [{ url, publicId, createdAt }]  // max 3
  linkedTable:  ObjectId ref Table (optional)
  privacy:      enum ['public','friends','private'], default 'public'
  likes:        [ObjectId ref User]
  timestamps
}
```

### 2. Nuevo modelo `server/models/JuntadaComment.js`
```js
{
  juntada:  ObjectId ref Juntada (required, indexed)
  author:   ObjectId ref User (required)
  content:  String (required, max 500)
  editedAt: Date (default null)
  timestamps
}
```

### 3. Nuevo route `server/routes/juntadas.js`
Todos los endpoints usan `protect` middleware.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/juntadas` | Feed paginado con filtro de privacidad |
| POST | `/api/juntadas` | Crear post (sin imágenes aún) |
| PUT  | `/api/juntadas/:id` | Editar (solo autor) |
| DELETE | `/api/juntadas/:id` | Eliminar + borrar imágenes de Cloudinary |
| POST | `/api/juntadas/:id/like` | Toggle like |
| POST | `/api/juntadas/:id/images` | Subir imagen (multer + cloudinary, max 3) |
| DELETE | `/api/juntadas/:id/images/:imgId` | Eliminar imagen |
| GET  | `/api/juntadas/:id/comments` | Listar comentarios |
| POST | `/api/juntadas/:id/comments` | Agregar comentario |
| PUT  | `/api/juntadas/:id/comments/:cid` | Editar comentario (solo autor) |
| DELETE | `/api/juntadas/:id/comments/:cid` | Eliminar comentario (autor del comentario o autor del post) |

**Filtro de privacidad en GET /api/juntadas:**
```js
const friendIds = req.user.friends; // ya está en el modelo User
const filter = {
  $or: [
    { privacy: 'public' },
    { privacy: 'friends', author: { $in: friendIds } },
    { author: req.user._id },
  ]
};
```

**"Juntada destacada"** (en el mismo endpoint, campo `featured`):
```js
const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
const featured = await Juntada.findOne({ ...filter, createdAt: { $gte: since24h } })
  .sort({ 'likes.length': -1 }).populate('author linkedTable');
// Devuelve en la respuesta junto con el feed paginado
```

### 4. Registrar en `server/server.js`
```js
app.use('/api/juntadas', require('./routes/juntadas'));
```

**Reusar:** `server/config/multer.js` y `server/config/cloudinary.js` (idéntico al flujo de imágenes de mesas).

---

## Frontend

### Archivos nuevos
| Archivo | Descripción |
|---------|-------------|
| `client/src/pages/Juntadas.jsx` | Página principal del feed |
| `client/src/pages/Juntadas.module.css` | Estilos de la página |
| `client/src/components/JuntadaCard.jsx` | Tarjeta de post (foto, like, comentarios inline) |
| `client/src/components/JuntadaCard.module.css` | Estilos de la tarjeta |
| `client/src/components/CreateJuntadaForm.jsx` | Form de creación (colapsable en el tope del feed) |
| `client/src/components/CreateJuntadaForm.module.css` | Estilos del form |

### `Juntadas.jsx` — estructura de la página
```
<div className={styles.page}>
  <div className={styles.inner}>
    <div className={styles.feedHeader}>
      <h1>Juntadas</h1>
      <button onClick={toggleCreateForm}>+ Nueva Juntada</button>
    </div>
    {showCreate && <CreateJuntadaForm onCreated={prependPost} />}
    {featured && <JuntadaCard post={featured} featured />}
    {posts.map(p => <JuntadaCard key={p._id} post={p} />)}
    <LoadMore / Spinner />
  </div>
</div>
```

### `JuntadaCard.jsx` — anatomía del post
1. **Header**: Avatar + nombre + fecha relativa + badge de privacidad + menú (editar/eliminar, solo autor)
2. **Título** (si existe)
3. **Cuerpo** (si existe, con "Ver más" si > 3 líneas)
4. **Fotos**: 1 foto → ancho completo; 2 fotos → grid 2 columnas; 3 fotos → 1 grande + 2 pequeñas (estilo Instagram)
5. **Mesa vinculada** (si existe): mini-card con `GameTile` + nombre del juego + fecha + asientos + botón "Unirse →" si está abierta, o "Ver mesa →" siempre
6. **Footer de acciones**: `❤️ N likes · 💬 N comentarios`
7. **Sección de comentarios** (colapsable al hacer click en "N comentarios"):
   - Lista de comentarios (avatar + autor + texto + tiempo + editar/eliminar)
   - Input inline para agregar comentario

### `CreateJuntadaForm.jsx`
- Campos: título (input), cuerpo (textarea), selector de privacidad (3 botones), picker de mesa (dropdown con las mesas del usuario), upload de hasta 3 fotos con previews locales
- **Submit**: POST `/api/juntadas` → por cada imagen: POST `/api/juntadas/:id/images` → `onCreated(newPost)`

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `client/src/App.jsx` | Agregar `import Juntadas` + `<Route path="/juntadas" element={<PrivateRoute><Juntadas /></PrivateRoute>} />` |
| `client/src/components/Sidebar.jsx` | Nuevo item `{ id: 'juntadas', label: 'Juntadas', icon: '◈', to: '/juntadas' }` |
| `client/src/components/BottomNav.jsx` | Nuevo item con icono SVG para `/juntadas` |
| `client/src/pages/TableDetail.jsx` | Agregar botón "Compartir juntada" que navega a `/juntadas?mesa=:id` |

---

## Flujo de upload de imágenes (reusar patrón existente)
1. Usuario selecciona archivos → previews locales con `URL.createObjectURL`
2. On submit: `POST /api/juntadas` (crea el post vacío de imágenes) → recibe `_id`
3. Para cada imagen: `POST /api/juntadas/:id/images` con `FormData` (igual que `TableDetail.handleImageUpload`)
4. Update estado local con el post completo

---

## Verificación
1. Crear una juntada con título, texto y 3 fotos → verificar que aparece en el feed
2. Verificar filtro de privacidad: post `private` solo visible para el propio autor
3. Verificar post `friends` visible para un amigo pero no para un desconocido
4. Like toggle: click → +1; click de nuevo → -1
5. Agregar, editar y eliminar comentario
6. Vincular una mesa: verificar que la mini-card aparece y el link navega a `/tables/:id`
7. Verificar "Juntada destacada" aparece solo si hay posts en las últimas 24h
8. Botón "Compartir juntada" en TableDetail pre-llena el linkedTable en el form
9. Sidebar y BottomNav muestran el nuevo ítem y la ruta activa se resalta
