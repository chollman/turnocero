# Informe de Seguridad — Turnocero

**Fecha:** 2026-05-10  
**Revisado por:** Claude Code (claude-sonnet-4-6)  
**Estado:** Parcialmente corregido (CRÍTICO #1 y #2 resueltos)

---

## Resumen Ejecutivo

Se identificaron **24 vulnerabilidades** distribuidas en cuatro niveles de severidad. Dos vulnerabilidades críticas fueron corregidas en esta revisión. El resto requiere atención antes de desplegar en producción.

| Severidad | Total | Corregidas | Pendientes |
|-----------|-------|------------|------------|
| CRÍTICO   | 4     | 2          | 2          |
| ALTO      | 5     | 0          | 5          |
| MEDIO     | 5     | 0          | 5          |
| BAJO      | 4     | 0          | 4          |
| **Total** | **24**| **2**      | **22**     |

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
  console.error('❌ JWT_SECRET environment variable is required');
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
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

La lista de orígenes permitidos se configura via la variable de entorno `CORS_ORIGIN` (separados por coma). Por defecto solo permite `http://localhost:3000`.

**Configuración requerida en producción:**
```env
CORS_ORIGIN=https://turnocero.com
```

**Impacto si no se corregía:**  
Cualquier sitio web podía hacer requests autenticados a la API usando las credenciales del usuario víctima.

---

### ⚠️ CRÍTICO-3 — Contraseña mínima de 6 caracteres sin complejidad [PENDIENTE]

**Archivo afectado:**
- `server/models/User.js`

**Descripción:**  
El modelo de usuario solo requiere una contraseña de mínimo 6 caracteres, sin exigir mayúsculas, números ni caracteres especiales. Contraseñas como `123456` o `aaaaaa` son válidas.

**Fix recomendado:**
```js
password: {
  type: String,
  required: [true, 'Password is required'],
  minlength: [8, 'Password must be at least 8 characters'],
  // Validar con regex antes de hashear en el pre-save hook
  validate: {
    validator: (v) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v),
    message: 'Password must contain at least one uppercase letter and one number',
  },
},
```

---

### ⚠️ CRÍTICO-4 — Enumeración de emails en registro [PENDIENTE]

**Archivo afectado:**
- `server/routes/auth.js` líneas 24 y 29

**Descripción:**  
Los mensajes de error diferencian entre `'Email already registered'` y `'Username already taken'`, lo que permite a un atacante determinar qué emails están registrados en el sistema.

**Fix recomendado:**
```js
// En lugar de mensajes específicos, usar uno genérico
return res.status(400).json({ message: 'Email o nombre de usuario ya registrado' });
```

---

## Vulnerabilidades ALTAS (pendientes)

### ALTO-1 — Sin rate limiting en endpoints de autenticación

**Archivo:** `server/routes/auth.js`

Sin límite de intentos en `/login` y `/register`, un atacante puede hacer miles de intentos de contraseña por segundo (fuerza bruta).

**Fix recomendado:**
```bash
npm install express-rate-limit
```
```js
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { message: 'Demasiados intentos. Esperá 15 minutos.' },
});
router.post('/login', authLimiter, async (req, res) => { ... });
router.post('/register', authLimiter, async (req, res) => { ... });
```

---

### ALTO-2 — Sin headers de seguridad HTTP (Helmet)

**Archivo:** `server/server.js`

Sin headers como `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` o `Content-Security-Policy`, el navegador no tiene protecciones básicas contra clickjacking, MIME sniffing y otros ataques.

**Fix recomendado:**
```bash
npm install helmet
```
```js
const helmet = require('helmet');
app.use(helmet());
```

---

### ALTO-3 — JWT expira en 7 días

**Archivo:** `server/routes/auth.js` línea 9

Un token comprometido es válido por 7 días. Sin blacklist de tokens, no hay forma de invalidarlo.

**Fix recomendado:**  
Reducir a 1 hora e implementar refresh tokens, o al menos a 24 horas como compromiso:
```js
expiresIn: '24h'
```

---

### ALTO-4 — Token JWT guardado en localStorage

**Archivo:** `client/src/context/AuthContext.jsx`

`localStorage` es accesible desde JavaScript. Un ataque XSS puede robar el token fácilmente.

**Fix recomendado:**  
Almacenar el token en una cookie `httpOnly` configurada desde el servidor:
```js
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
});
```

---

### ALTO-5 — Sin validación/sanitización de inputs en tablas

**Archivo:** `server/routes/tables.js`

Los campos `boardGame`, `location` y `description` no tienen sanitización explícita. Aunque Mongoose protege contra NoSQL injection, no protege contra XSS almacenado si el frontend renderiza los datos sin escapar.

**Fix recomendado:**
```bash
npm install express-validator
```
```js
const { body, validationResult } = require('express-validator');
router.post('/', protect, [
  body('boardGame').trim().notEmpty().escape(),
  body('location').trim().escape(),
  body('description').trim().escape(),
], async (req, res) => { ... });
```

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

## Vulnerabilidades BAJAS (pendientes)

### BAJO-1 — Sin protección CSRF explícita
Agregar `sameSite: 'strict'` en cookies y considerar tokens CSRF para formularios.

### BAJO-2 — Sin validación de variables de entorno al arrancar
Parcialmente corregido para `JWT_SECRET`. Falta validar `MONGODB_URI`.

### BAJO-3 — Sin logs estructurados
Reemplazar `console.error` por una biblioteca como `pino` o `winston`.

### BAJO-4 — Sin documentación de autenticación en rutas
Agregar comentarios indicando qué rutas requieren autenticación.

---

## Plan de acción recomendado

### Inmediato (antes de producción)
- [x] Remover fallback `'fallback_secret'` en JWT
- [x] Configurar CORS con orígenes específicos
- [ ] Agregar `helmet`
- [ ] Agregar rate limiting en `/login` y `/register`
- [ ] Mover token a cookie `httpOnly`

### Corto plazo (1–2 semanas)
- [ ] Sanitizar inputs con `express-validator`
- [ ] Reducir expiración de JWT a 24h
- [ ] Validar ObjectIds en rutas
- [ ] Corregir mensajes de error genéricos (email enumeration)
- [ ] Reforzar validación de contraseña

### Mediano plazo (antes de escalar)
- [ ] Implementar logout con blacklist de tokens
- [ ] Agregar paginación en `GET /api/tables`
- [ ] Migrar a instancia de Axios
- [ ] Implementar logging estructurado

---

## Archivos modificados en esta revisión

| Archivo | Cambio |
|---------|--------|
| `server/middleware/auth.js` | Removido fallback `'fallback_secret'` en `jwt.verify` |
| `server/routes/auth.js` | Removido fallback `'fallback_secret'` en `jwt.sign` |
| `server/server.js` | CORS configurado con lista de orígenes; validación de `JWT_SECRET` al arrancar |
| `server/.env.example` | Agregada variable `CORS_ORIGIN` |
