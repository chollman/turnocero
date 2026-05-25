# Plan: Integración BGG API — Username en perfiles + página de colección

## Contexto

Se habilitó acceso a la API de BoardGameGeek (BGG XML API 2). El objetivo es:

1. Permitir que cada usuario guarde su username de BGG en su perfil de Turnocero.
2. Mostrar ese username en el perfil público con un link a una nueva página.
3. Esa página carga la colección y las partidas del usuario directamente desde la API de BGG.

**Restricción crítica:** BGG no soporta CORS — todos los llamados a la API deben hacerse desde el backend Express. El frontend nunca llama a BGG directamente.

---

## Archivos críticos

| Archivo                                        | Cambio                                           |
| ---------------------------------------------- | ------------------------------------------------ |
| `server/models/User.js`                        | Agregar campo `bggUsername`                      |
| `server/routes/auth.js`                        | Aceptar `bggUsername` en `PUT /api/auth/profile` |
| `server/routes/users.js`                       | Incluir `bggUsername` en `GET /api/users/:id`    |
| `server/routes/bgg.js`                         | **Nuevo** — proxy + parser BGG                   |
| `server/server.js`                             | Registrar nueva ruta `/api/bgg`                  |
| `server/.env.example`                          | Documentar `BGG_API_KEY`                         |
| `client/src/pages/users/UserProfile.jsx`       | Campo BGG en formulario de edición               |
| `client/src/pages/users/UserProfilePublic.jsx` | Mostrar BGG username como link                   |
| `client/src/pages/bgg/BggProfile.jsx`          | **Nuevo** — página de colección BGG              |
| `client/src/App.jsx`                           | Registrar ruta `/perfil-bgg/:bggUsername`        |

---

## Pasos de implementación

### 1 — Instalar parser XML en el servidor

```bash
cd server && npm install fast-xml-parser
```

`fast-xml-parser` es ligero y no tiene WASM deps. Se usa solo en el backend.

---

### 2 — Modelo User (`server/models/User.js`)

Agregar después del campo `celular` (línea 69):

```js
bggUsername: {
  type: String,
  default: '',
  maxlength: [50, 'BGG username cannot exceed 50 characters'],
  trim: true,
},
```

---

### 3 — Ruta de perfil (`server/routes/auth.js`)

En `PUT /api/auth/profile` (línea 101), agregar `bggUsername` a la desestructuración y al bloque de asignación:

```js
const {
  displayName,
  nombre,
  apellido,
  direccion,
  telegram,
  celular,
  bggUsername,
} = req.body;
// ...
if (bggUsername !== undefined) user.bggUsername = bggUsername;
```

---

### 4 — Ruta pública de usuarios (`server/routes/users.js`)

Verificar que `GET /api/users/:id` incluya `bggUsername` en el select/return. Si hay un `.select()` explícito, agregar el campo ahí.

---

### 5 — Variable de entorno (`server/.env.example`)

Agregar al final:

```
# BoardGameGeek API Key (registrar en boardgamegeek.com/applications)
BGG_API_KEY=
```

---

### 6 — Proxy BGG (`server/routes/bgg.js`) — nuevo archivo

Responsabilidades:

- Llama a `https://boardgamegeek.com/xmlapi2/collection?username=X&own=1&stats=1` para colecciones
- Llama a `https://boardgamegeek.com/xmlapi2/plays?username=X` para partidas
- Agrega header `Authorization: Bearer <BGG_API_KEY>` en cada request
- Parsea XML → JSON con `fast-xml-parser`
- Maneja HTTP 202 (BGG encola requests grandes): reintenta 1 vez después de 2 segundos
- Cache en memoria simple (Map) con TTL de 5 minutos por username+endpoint
- Rutas expuestas:
  - `GET /api/bgg/coleccion/:bggUsername` → devuelve array de juegos con: `{ id, name, thumbnail, image, yearPublished, userRating, bggRating, numPlays, owned }`
  - `GET /api/bgg/partidas/:bggUsername` → devuelve array de partidas con: `{ id, date, gameName, gameId, quantity, duration, location }`

---

### 7 — Registrar ruta en `server/server.js`

Agregar después de la línea 98 (noticias):

```js
app.use("/api/bgg", require("./routes/bgg"));
```

---

### 8 — Formulario de perfil propio (`client/src/pages/users/UserProfile.jsx`)

- Agregar `bggUsername: ''` al estado inicial del form (línea 19–28)
- Inicializar desde `user.bggUsername` en el `useEffect` (línea 46–59)
- Agregar campo en la sección "Contacto" (debajo de Celular), con prefijo visual "BGG":
  ```jsx
  <div className={styles.field}>
    <label className={styles.label}>Usuario en BGG</label>
    <div className={styles.inputPrefix}>
      <span className={styles.prefix}>BGG</span>
      <input
        name="bggUsername"
        value={form.bggUsername}
        onChange={handleChange}
        placeholder="tu_usuario_bgg"
        maxLength={50}
      />
    </div>
  </div>
  ```
- Incluir `bggUsername: form.bggUsername` en el objeto que se pasa a `updateProfile()` (línea 140–151)

---

### 9 — Perfil público (`client/src/pages/users/UserProfilePublic.jsx`)

- En la sección CONTACTO (línea 222–256), agregar después de `celular`:
  ```jsx
  {
    profile.bggUsername && (
      <div className={styles.infoRow}>
        <span className={styles.infoIcon}>🎲</span>
        <div className={styles.infoText}>
          <span className={styles.infoLabel}>BGG</span>
          <Link
            to={`/perfil-bgg/${profile.bggUsername}`}
            className={styles.infoLink}
          >
            {profile.bggUsername}
          </Link>
        </div>
      </div>
    );
  }
  ```
- Importar `Link` de `react-router-dom`
- Agregar `profile.bggUsername ? 'BGG' : null` a `contactParts` para el subtítulo del hero

---

### 10 — Nueva página BGG (`client/src/pages/bgg/BggProfile.jsx`)

Página accesible en `/perfil-bgg/:bggUsername`. Funcionalidad:

- **Header:** nombre del usuario BGG + link externo a su perfil en boardgamegeek.com
- **Tabs:** "Colección" y "Partidas"
- **Tab Colección:**
  - Llama a `GET /api/bgg/coleccion/:bggUsername`
  - Grilla de juegos con thumbnail, nombre, año, calificación del usuario vs promedio BGG, cantidad de veces jugado
  - Estado de carga, error, vacío
- **Tab Partidas:**
  - Llama a `GET /api/bgg/partidas/:bggUsername`
  - Lista de partidas recientes: fecha, nombre del juego, duración, ubicación
- Sin autenticación requerida (ruta pública)
- CSS Module: `BggProfile.module.css` con el tema dark amber del proyecto (usar variables CSS globales)

---

### 11 — Registrar ruta en `client/src/App.jsx`

```jsx
import BggProfile from "./pages/bgg/BggProfile";
// ...
<Route path="/perfil-bgg/:bggUsername" element={<BggProfile />} />;
```

---

## Verificación

1. Guardar un `bggUsername` en "Mi perfil" → verificar que se persiste y aparece en el perfil público
2. Hacer click en el link BGG del perfil público → navega a `/perfil-bgg/:username`
3. La página carga la colección desde BGG correctamente
4. Probar con un usuario BGG real (ej: `Skeletor`) para ver datos reales
5. Probar con username inexistente → error amigable
6. Verificar que el servidor no expone `BGG_API_KEY` al frontend (buscar en Network tab)
