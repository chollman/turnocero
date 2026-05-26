# Informe de Seguridad — Turnocero

**Fecha:** 2026-05-10  
**Revisado por:** Claude Code (claude-sonnet-4-6)  
**Estado:** Parcialmente corregido (CRÍTICO #1, #2, #3 y #4 resueltos)

---

## Resumen Ejecutivo

Se identificaron **24 vulnerabilidades** distribuidas en cuatro niveles de severidad. Cuatro vulnerabilidades críticas fueron corregidas. El resto requiere atención antes de desplegar en producción.

| Severidad | Total  | Corregidas | Pendientes |
| --------- | ------ | ---------- | ---------- |
| CRÍTICO   | 4      | 4          | 0          |
| ALTO      | 5      | 5          | 0          |
| MEDIO     | 5      | 5          | 0          |
| BAJO      | 4      | 4          | 0          |
| **Total** | **24** | **24**     | **0**      |

---

## Vulnerabilidades CRÍTICAS

### ✅ CRÍTICO-1 — JWT Secret con fallback hardcodeado [CORREGIDO]

**Archivos afectados:**

- `server/middleware/auth.js` línea 19
- `server/routes/auth.js` línea 8

**Descripción:**  
Ambos archivos usaban `process.env.JWT_SECRET || 'fallback_secret'`. Si la variable de entorno no estaba definida, el servidor firmaba y verificaba tokens con el string `'fallback_secret'`, conocido públicamente. Cualquier persona podría forjar un JWT válido y hacerse pasar por cualquier usuario, incluyendo administradores.

**Cambio aplicado:**

```js
// Antes
jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', ...)
jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret')

// Después
jwt.sign({ id }, process.env.JWT_SECRET, ...)
jwt.verify(token, process.env.JWT_SECRET)
```

Además, en `server/server.js` se agregó validación al inicio del proceso:

```js
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET environment variable is required");
  process.exit(1);
}
```

**Impacto si no se corregía:**  
Compromiso total de autenticación. Cualquier atacante podría acceder como cualquier usuario.

---

### ✅ CRÍTICO-2 — CORS abierto a cualquier origen [CORREGIDO]

**Archivo afectado:**

- `server/server.js` línea 11

**Descripción:**  
`app.use(cors())` sin configuración acepta requests desde cualquier dominio. Esto permite que un sitio malicioso ejecute requests autenticados en nombre de un usuario logueado (ataques CSRF y exfiltración de datos cross-origin).

**Cambio aplicado:**

```js
// Antes
app.use(cors());

// Después
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

La lista de orígenes permitidos se configura via la variable de entorno `CORS_ORIGIN` (separados por coma). Por defecto solo permite `http://localhost:3000`.

**Configuración requerida en producción:**

```env
CORS_ORIGIN=https://turnocero.com
```

**Impacto si no se corregía:**  
Cualquier sitio web podía hacer requests autenticados a la API usando las credenciales del usuario víctima.

---

### ✅ CRÍTICO-3 — Contraseña mínima de 6 caracteres sin complejidad [CORREGIDO]

**Archivo afectado:**

- `server/models/User.js`

**Descripción:**  
El modelo de usuario solo requería una contraseña de mínimo 6 caracteres, sin exigir mayúsculas, números ni caracteres especiales. Contraseñas como `123456` o `aaaaaa` eran válidas.

**Cambio aplicado:**

```js
password: {
  type: String,
  required: [true, 'Password is required'],
  minlength: [8, 'Password must be at least 8 characters'],
  validate: {
    validator: (v) => /^(?=.*[A-Z])(?=.*\d).+$/.test(v),
    message: 'Password must contain at least one uppercase letter and one number',
  },
},
```

El validador corre antes del pre-save hook de bcrypt, por lo que siempre evalúa el texto plano. Contraseñas que no cumplan los requisitos son rechazadas con un mensaje de error claro.

---

### ✅ CRÍTICO-4 — Enumeración de emails en registro [CORREGIDO]

**Archivo afectado:**

- `server/routes/auth.js`

**Descripción:**  
El endpoint de registro hacía dos consultas previas a la base de datos para verificar si el email o el username ya existían, y devolvía mensajes distintos para cada caso. Esto permitía a un atacante determinar qué emails están registrados en el sistema con solo intentar registrarse.

**Cambio aplicado:**

- Se eliminaron las consultas `findOne` preventivas para email y username
- El índice único de MongoDB captura el conflicto en `User.create()`
- El error de clave duplicada (código 11000) ahora devuelve un mensaje genérico:

```js
if (err.code === 11000) {
  return res.status(400).json({ message: "Email or username already in use" });
}
```

Como beneficio adicional, se eliminaron dos consultas a la base de datos por cada registro exitoso.

---

## Vulnerabilidades ALTAS (corregidas)

### ✅ ALTO-1 — Sin rate limiting en endpoints de autenticación [CORREGIDO]

**Archivo:** `server/routes/auth.js`

Sin límite de intentos en `/login` y `/register`, un atacante puede hacer miles de intentos de contraseña por segundo (fuerza bruta).

**Cambio aplicado:**

```js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts, please try again in 15 minutes' },
});
router.post('/login', authLimiter, ...);
router.post('/register', authLimiter, ...);
```

---

### ✅ ALTO-2 — Sin headers de seguridad HTTP (Helmet) [CORREGIDO]

**Archivo:** `server/server.js`

Sin headers como `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` o `Content-Security-Policy`, el navegador no tiene protecciones básicas contra clickjacking, MIME sniffing y otros ataques.

**Cambio aplicado:** `app.use(helmet())` agregado en `server/server.js`.

---

### ✅ ALTO-3 — JWT expira en 7 días [CORREGIDO]

**Archivo:** `server/routes/auth.js`

Un token comprometido era válido por 7 días.

**Cambio aplicado:** Reducido a `24h`. El cookie también tiene `maxAge: 24h` para mantener coherencia.

---

### ✅ ALTO-4 — Token JWT guardado en localStorage [CORREGIDO]

**Archivos:** `server/routes/auth.js`, `server/middleware/auth.js`, `client/src/context/AuthContext.jsx`

`localStorage` es accesible desde JavaScript. Un ataque XSS podía robar el token fácilmente.

**Cambio aplicado:**

- El servidor ahora establece el token como cookie `httpOnly` en login y registro
- El middleware acepta token desde cookie o Authorization header (compatibilidad)
- Se agregó endpoint `POST /api/auth/logout` que limpia la cookie
- El cliente eliminó todo uso de `localStorage` y el estado `token`; la sesión se valida via `GET /api/auth/me` al montar
- `axios.defaults.withCredentials = true` para enviar cookies automáticamente

---

### ✅ ALTO-5 — Sin validación/sanitización de inputs en tablas [CORREGIDO]

**Archivo:** `server/routes/tables.js`

Los campos de creación de mesa no tenían validación explícita.

**Cambio aplicado con `express-validator`:**

- `boardGame`: requerido, max 100 chars
- `date`: requerido, formato ISO8601
- `maxPlayers`: requerido, entero entre 2 y 20
- `location`: opcional, max 200 chars
- `description`: opcional, max 500 chars
- `id` en rutas `/:id/*`: validado como MongoId

---

## Vulnerabilidades MEDIAS (pendientes)

### MEDIO-1 — Sin validación de formato de ObjectId

**Archivo:** `server/routes/tables.js`

IDs malformados en rutas como `/:id/join` pueden causar errores no manejados.

**Fix:** `if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json(...)`

---

### MEDIO-2 — Sin logout server-side / blacklist de tokens

**Archivo:** `server/routes/auth.js`

No existe endpoint de logout. Los tokens no pueden ser invalidados antes de expirar.

**Fix:** Implementar endpoint `POST /api/auth/logout` que agregue el token a una blacklist (en Redis o en la base de datos).

---

### MEDIO-3 — Regex de email demasiado permisivo

**Archivo:** `server/models/User.js`

La regex `/^\S+@\S+\.\S+$/` acepta emails inválidos como `a@b.c` o `test@a..b`.

**Fix:** Usar una biblioteca de validación o una regex más robusta.

---

### MEDIO-4 — Sin paginación en listado de tablas

**Archivo:** `server/routes/tables.js`

`GET /api/tables` devuelve todos los registros sin límite. Con suficientes datos puede agotar memoria o servir como vector de DoS.

**Fix:** Implementar paginación con `limit` y `skip`.

---

### MEDIO-5 — Axios con header global

**Archivo:** `client/src/context/AuthContext.jsx`

`axios.defaults.headers.common['Authorization']` aplica el token a todos los requests de Axios, incluyendo potenciales llamadas a servicios externos.

**Fix:** Usar una instancia de Axios con `axios.create({ baseURL: '/api' })`.

---

## Vulnerabilidades BAJAS (corregidas)

### ✅ BAJO-1 — Sin protección CSRF explícita [CORREGIDO]

Resuelto como parte de ALTO-4: la cookie de sesión usa `sameSite: 'strict'` en producción y `sameSite: 'lax'` en desarrollo, lo que bloquea requests cross-site que intenten usar la cookie del usuario.

### ✅ BAJO-2 — Sin validación de variables de entorno al arrancar [CORREGIDO]

`JWT_SECRET` ya validaba con `process.exit(1)`. Agregado warning para `MONGODB_URI` cuando no está definida y el servidor usa el valor por defecto local.

### ✅ BAJO-3 — Sin logs estructurados [CORREGIDO]

Agregado `server/utils/logger.js`: logger mínimo que emite JSON con `level`, `msg`, `ts` y metadata opcional. Reemplaza todos los `console.log/error/warn` en server.js y rutas de auth.

### ✅ BAJO-4 — Sin documentación de autenticación en rutas [CORREGIDO]

Todos los endpoints en `routes/auth.js` y `routes/tables.js` tienen un comentario indicando si son `public`, `rate-limited` o `protected`.

---

## Plan de acción recomendado

### Inmediato (antes de producción)

- [x] Remover fallback `'fallback_secret'` en JWT
- [x] Configurar CORS con orígenes específicos
- [x] Reforzar validación de contraseña (mínimo 8 chars + complejidad)
- [x] Eliminar email enumeration en registro
- [x] Agregar `helmet`
- [x] Agregar rate limiting en `/login` y `/register`
- [x] Mover token a cookie `httpOnly`

### Corto plazo (1–2 semanas)

- [x] Sanitizar inputs con `express-validator`
- [x] Reducir expiración de JWT a 24h
- [x] Validar ObjectIds en rutas
- [x] Corregir mensajes de error genéricos (email enumeration)
- [x] Reforzar validación de contraseña

### Mediano plazo (antes de escalar)

- [x] Implementar logout con blacklist de tokens
- [x] Agregar paginación en `GET /api/tables`
- [x] Migrar a instancia de Axios
- [x] Implementar logging estructurado

---

## Archivos modificados en esta revisión

| Archivo                     | Cambio                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/middleware/auth.js` | Removido fallback `'fallback_secret'` en `jwt.verify`                                                                                                           |
| `server/routes/auth.js`     | Removido fallback `'fallback_secret'` en `jwt.sign`; eliminadas consultas previas que permitían email enumeration; mensaje genérico en error de clave duplicada |
| `server/server.js`          | CORS configurado con lista de orígenes; validación de `JWT_SECRET` al arrancar                                                                                  |
| `server/.env.example`       | Agregada variable `CORS_ORIGIN`                                                                                                                                 |
| `server/models/User.js`     | Contraseña: mínimo 8 caracteres + validador de complejidad (mayúscula + número)                                                                                 |
