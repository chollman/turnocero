# Plan: Acceso público a secciones de solo lectura

## Contexto

Actualmente **todas** las rutas del sitio están detrás de `PrivateRoute`, redirigiendo a `/login` si no hay sesión. El objetivo es permitir que visitantes no registrados puedan navegar y leer contenido (mesas, perfiles, juntadas) sin necesidad de iniciar sesión. Solo se requiere autenticación cuando la acción involucra comunicación con el backend en nombre de un usuario (unirse, chatear, comentar, etc.).

**Decisiones del usuario:**
- Navegación para guests: Navbar simple con logo + botones Login/Registrar
- Mesas privadas: ocultas completamente para no logueados
- Juntadas: públicas
- Acción sin login: mostrar un modal "Iniciá sesión para continuar"

---

## Rutas y su nuevo estado

| Ruta | Antes | Después |
|------|-------|---------|
| `/` Dashboard | PrivateRoute | **Pública** |
| `/tables/:id` TableDetail | PrivateRoute | **Pública** |
| `/users` UsersList | PrivateRoute | **Pública** |
| `/users/:id` UserProfilePublic | PrivateRoute | **Pública** |
| `/juntadas` Juntadas | PrivateRoute | **Pública** |
| `/juntadas/:id` JuntadaPost | PrivateRoute | **Pública** |
| `/create` CreateTable | PrivateRoute | Sin cambios |
| `/tables/:id/edit` EditTable | PrivateRoute | Sin cambios |
| `/notifications` Notifications | PrivateRoute | Sin cambios |
| `/perfil` UserProfile | PrivateRoute | Sin cambios |
| `/me` MeFeed | PrivateRoute | Sin cambios |
| `/database` DatabaseViewer | PrivateRoute | Sin cambios |

---

## Cambios en el Backend

### 1. `server/middleware/auth.js`
Agregar el middleware `optionalAuth` (exportar junto con `protect` y `requireAdmin`):
```js
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (_) { /* anon */ }
  }
  next();
};
```

### 2. `server/routes/tables.js`
Cambiar de `protect` a `optionalAuth` en:
- `GET /api/tables/` — filtrar `privacy: 'private'` si `!req.user`
- `GET /api/tables/top-games` — sin cambio de lógica, solo permite anon
- `GET /api/tables/:id` — si mesa es privada y `!req.user`, responder 403

`GET /api/tables/mine` y todos los POST/PUT/DELETE permanecen con `protect`.

### 3. `server/routes/users.js`
Cambiar de `protect` a `optionalAuth` en:
- `GET /api/users/` — sin cambio de lógica (no devuelve datos sensibles)
- `GET /api/users/:id` — si `!req.user`, los campos de relación (amistad) serán `null`

### 4. `server/routes/juntadas.js`
Cambiar de `protect` a `optionalAuth` en:
- `GET /api/juntadas/` 
- `GET /api/juntadas/:id`

Los POST/DELETE de juntadas permanecen protegidos.

---

## Cambios en el Frontend

### 5. `client/src/components/GuestNavbar.jsx` *(nuevo)*
Componente simple: logo a la izquierda, botones "Iniciá sesión" y "Registrate" a la derecha. Mismo estilo visual que `Navbar.jsx` (mismos CSS variables). No usa `useAuth` ni `useNotifications`.

### 6. `client/src/App.jsx`
- Reemplazar `{user && <Sidebar />}` → `{user ? <Sidebar /> : null}` (Sidebar solo para logueados)
- Reemplazar `{user && <Navbar />}` → `{user ? <Navbar /> : <GuestNavbar />}`
- Reemplazar `{user && <BottomNav />}` → `{user ? <BottomNav /> : null}`
- Quitar `PrivateRoute` de las 6 rutas públicas listadas arriba

### 7. `client/src/components/LoginPromptModal.jsx` *(nuevo)*
Modal reutilizable. Props: `isOpen`, `onClose`, `message` (ej: "Iniciá sesión para unirte a esta mesa"). Botones: "Iniciá sesión" (`/login`) y "Cancelar". Usar variables CSS del proyecto.

### 8. `client/src/pages/Dashboard.jsx`
- Axios call a `GET /api/tables` sin requerir token (ya funciona con `optionalAuth` en el backend)
- Si el usuario no está logueado, el botón "Nueva Mesa" no aparece (o dispara el modal)
- `TableCard` debe manejar el caso `user = null` (ver punto 9)

### 9. `client/src/components/TableCard.jsx`
- Si `!user`, los botones de acción (unirse, seguir, cancelar) muestran el `LoginPromptModal` en lugar de ejecutar la acción

### 10. `client/src/pages/TableDetail.jsx`
- Hacer el `GET /api/tables/:id` sin requerir auth (el backend lo maneja)
- Si el backend devuelve 403 (mesa privada), mostrar pantalla "Esta mesa es privada"
- Para usuarios no logueados, ocultar/deshabilitar:
  - Botón "Unirse" → dispara modal
  - Input de chat → reemplazar por texto "Iniciá sesión para chatear"
  - Formulario de comentarios → reemplazar por texto "Iniciá sesión para comentar"
  - Botones de emoji reacción → disparan modal
  - Botón "Seguir" → dispara modal

### 11. `client/src/pages/UsersList.jsx`
- Hacer el `GET /api/users` sin requerir auth
- Sin cambios funcionales de UI (es solo lectura de lista)

### 12. `client/src/pages/UserProfilePublic.jsx`
- Hacer el `GET /api/users/:id` sin requerir auth
- Si `!user`, ocultar botones de amistad/mensaje y disparar modal si el visitante intenta acceder

### 13. `client/src/pages/Juntadas.jsx` y `JuntadaPost.jsx`
- Hacer el fetch sin requerir auth
- Ocultar o deshabilitar formularios de interacción (comentarios, likes) para no logueados → disparan modal

---

## Verificación

1. Abrir el sitio en una ventana privada (sin sesión)
2. Verificar que `/` carga el Dashboard con mesas públicas
3. Verificar que las mesas privadas no aparecen en la lista
4. Hacer click en una mesa → ver el detalle
5. Intentar unirse o comentar → aparece el modal
6. Navegar a `/users` y `/users/:id` → funcionan sin sesión
7. Navegar a `/juntadas` y `/juntadas/:id` → funcionan sin sesión
8. Intentar acceder a `/create` o `/perfil` → redirige a `/login`
9. Con sesión iniciada, verificar que todo funciona igual que antes
