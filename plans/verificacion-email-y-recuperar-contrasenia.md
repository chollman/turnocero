# Plan: Verificación de email + Recuperar contraseña

## Contexto

Hoy `POST /api/auth/register` crea el usuario y devuelve un JWT inmediatamente (no se valida el email). Tampoco existe un flujo de recuperación de contraseña — si un usuario se olvida la suya, no hay forma de resetearla salvo intervención manual.

Decisiones tomadas con el usuario:

- **Servicio de email:** [Resend](https://resend.com) (API simple, free tier de 3.000/mes).
- **Gating de verificación:** **antes** del login. El usuario crea la cuenta → ingresa código de 6 dígitos → recién ahí recibe el JWT. Hasta ese momento no puede usar la app.
- **Usuarios existentes:** _grandfather_ — la migración pone `emailVerified=true` en todos los actuales. Solo nuevos registros pasan por el flujo.

Convenciones del proyecto a respetar:

- Rutas en español ([CLAUDE.md](../CLAUDE.md)), commit messages en inglés ([feedback_style](../.claude/memory/feedback_style.md)).
- CSS Modules + variables de tema ([feedback_theme_support](../.claude/memory/feedback_theme_support.md)).
- Errores del server con `{ message: '<string>' }`.
- Auth routes rate-limited (10 req / 15 min).

---

## Fase 1 — Infraestructura compartida

Lo que necesitan ambos flujos antes de tocar rutas.

### 1.1 Dependencias y env vars

**Instalar en `server/`:**

```bash
npm install resend
```

(crypto y mongoose ya están; no hace falta nada más)

**Agregar a `server/.env.example`:**

```
# Resend — para verificación de email y recuperar contraseña
RESEND_API_KEY=
# Remitente verificado en Resend (ej: "TurnoCero <hola@turnocero.com>")
# En dev podés usar "onboarding@resend.dev"
EMAIL_FROM=onboarding@resend.dev

# URL pública del frontend, usada para construir links en emails
# (verificación, recuperar contraseña). Sin trailing slash.
FRONTEND_URL=http://localhost:3000
```

**Update `server/.env`** local con valores reales. En producción (Vercel/Render): cargar `RESEND_API_KEY` desde el dashboard y setear `FRONTEND_URL=https://turnocero.com` (o la URL real).

### 1.2 Utilidad de tokens

Crear [`server/utils/authTokens.js`](../server/utils/authTokens.js):

- `generateCode()` → string de 6 dígitos (`crypto.randomInt(100000, 1000000)`). Usado para verificar email.
- `generateUrlToken()` → 32 bytes random en hex (~64 chars URL-safe). Usado para link de recuperar contraseña.
- `hashToken(token)` → SHA-256 hex. **Importante:** los tokens se guardan **hasheados** en la DB; solo el token en claro va al usuario por mail. Esto previene que un dump de DB sirva para resetear contraseñas.
- `compareToken(token, hash)` → boolean (constant-time si es posible).

### 1.3 Utilidad de envío de email

Crear [`server/utils/email.js`](../server/utils/email.js):

```js
const { Resend } = require("resend");
const logger = require("./logger");

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    logger.warn("Resend not configured; skipping email", { to, subject });
    return;
  }
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    logger.error("Email send failed", { to, subject, msg: err.message });
    throw err; // que el caller decida cómo manejar
  }
}

module.exports = { sendEmail };
```

Templates HTML inline en funciones helper (un wrapper común con header/footer + body por tipo). Mantener simple — HTML básico, no MJML; el branding de TurnoCero (color amber, logo en texto). Ejemplos:

- `verificationEmail({ username, code })` → asunto "Tu código para activar TurnoCero", muestra el código grande.
- `passwordResetEmail({ username, resetUrl })` → asunto "Recuperá tu contraseña en TurnoCero", botón con el link + nota "Si no pediste esto, ignorá este mail. El link expira en 1 hora".

### 1.4 Modelo User — campos nuevos

Agregar a [`server/models/User.js`](../server/models/User.js):

```js
emailVerified: { type: Boolean, default: false },
emailVerificationCodeHash: { type: String, default: null },
emailVerificationExpiresAt: { type: Date, default: null },
emailVerificationAttempts: { type: Number, default: 0 },

passwordResetTokenHash: { type: String, default: null },
passwordResetExpiresAt: { type: Date, default: null },
```

Excluir todos estos en `toJSON()` (igual que `password` y `bggCredentials`).

### 1.5 Migración: grandfather usuarios existentes

Script una sola vez en `server/scripts/migrate-email-verified.js`:

```js
// Marca todos los usuarios existentes como emailVerified=true.
// Solo afecta cuentas creadas antes de implementar la verificación.
const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await User.updateMany(
    { emailVerified: { $ne: true } },
    { $set: { emailVerified: true } },
  );
  console.log(`Updated ${res.modifiedCount} users`);
  await mongoose.disconnect();
})();
```

Correr una vez con `node server/scripts/migrate-email-verified.js` en local y prod después del deploy del modelo.

---

## Fase 2 — Verificación de email en registro

### 2.1 Cambios en `POST /api/auth/register`

[`server/routes/auth.js`](../server/routes/auth.js):

- Crea el usuario igual que hoy, pero:
  - `emailVerified` queda `false` (default).
  - Genera código de 6 dígitos, guarda `emailVerificationCodeHash` (hash) y `emailVerificationExpiresAt = now + 15min`.
  - **No emite JWT.** Devuelve `201 { email, message: 'Verificá tu email' }`.
- Envía email con el código vía `sendEmail`.
- Si Resend falla, igual responde 201 — loguea el error pero deja al usuario pedir un resend (mejor UX que fallar el registro entero).

### 2.2 Endpoint: `POST /api/auth/verify-email`

Body: `{ email, code }`. Rate-limited con `authLimiter`.

Lógica:

1. Busca user por email. Si no existe o ya `emailVerified=true` → 400 con mensaje genérico ("Código inválido o expirado") para no filtrar enumeración.
2. Si `emailVerificationExpiresAt < now` → 400 "Código inválido o expirado".
3. Incrementa `emailVerificationAttempts`. Si > 5 → 429 "Demasiados intentos, pedí un código nuevo".
4. `hashToken(code) === user.emailVerificationCodeHash` → success:
   - `emailVerified = true`, limpia `emailVerificationCodeHash`, `emailVerificationExpiresAt`, `emailVerificationAttempts`.
   - Genera JWT, setea cookie, responde `{ user, token }` (igual que login).
5. Si no matchea → 400 "Código inválido o expirado".

### 2.3 Endpoint: `POST /api/auth/resend-verification`

Body: `{ email }`. Rate-limited con un limiter más estricto (3 req / 15 min) para evitar abuso de mails.

- Si existe el user y `!emailVerified`: genera código nuevo, actualiza hash + expiresAt, resetea attempts, envía mail.
- En todos los casos responde 200 con mensaje genérico ("Si la cuenta existe, te enviamos un nuevo código"). No filtra existencia.

### 2.4 Login bloqueado si no está verificado

En `POST /api/auth/login`, **antes** de retornar el JWT (después de validar password), agregar:

```js
if (!user.emailVerified) {
  return res.status(403).json({
    code: "email_not_verified",
    email: user.email,
    message: "Tenés que verificar tu email antes de loguearte.",
  });
}
```

El client detecta `code === 'email_not_verified'` y redirige a la pantalla de verificación con el email pre-cargado.

### 2.5 Cleanup periódico (opcional, fase futura)

Cuentas no verificadas con `createdAt > 7 días` y `!emailVerified` podrían borrarse automáticamente. **No se implementa ahora** — solo dejar la nota acá.

### 2.6 Pantallas en el client

Nueva página: [`client/src/pages/auth/VerifyEmail.jsx`](../client/src/pages/auth/VerifyEmail.jsx), ruta `/verificar-email`.

Estado: recibe `email` por:

- `location.state` (cuando viene de Register).
- Query param `?email=foo@bar.com` (fallback si el usuario refresca o llega desde otro lado).
- `sessionStorage` (backup intermedio).

UI:

- Reusa el layout `Auth.module.css` (mismo `page`/`panel`/`showcase`).
- Heading "Verificá tu email", subtítulo "Te mandamos un código a `<email>`".
- 6 inputs separados para el código (o un único input numérico de 6 dígitos — más simple, va con eso).
- Botón "Verificar" → `POST /api/auth/verify-email` → guarda token, redirige a `/`.
- Link "Reenviar código" con cooldown visual de 30s (deshabilitado mientras corre el contador).
- Manejo de errores: mostrar mensaje del server en `errorBox`.

**Cambios en `Register.jsx`:**

- `handleSubmit` ya no llama a `auth.register()` (que loguea automáticamente). En su lugar hace `axios.post('/api/auth/register', ...)` directamente.
- En éxito: `navigate('/verificar-email', { state: { email: form.email } })`.

**Cambios en `Login.jsx`:**

- Catch del error: si `err.response?.data?.code === 'email_not_verified'`, redirigir a `/verificar-email` con el email en state. Si no, mostrar el mensaje normal.

**Cambios en `AuthContext.jsx`:**

- `register()` deja de existir como wrapper que loguea. Reemplazarlo por:
  - `requestEmailVerification(email)` (POST resend).
  - `verifyEmail(email, code)` → guarda token y user, igual que login.
- Register.jsx llama directo a `axios.post`, no al context (la cuenta existe pero no hay sesión todavía).

### 2.7 Routing

En [`App.jsx`](../client/src/App.jsx): agregar `<Route path="/verificar-email" element={<PublicRoute><VerifyEmail /></PublicRoute>} />`.

`PublicRoute` ya existe y bloquea acceso si hay user logueado.

---

## Fase 3 — Recuperar contraseña

### 3.1 Endpoint: `POST /api/auth/forgot-password`

Body: `{ email }`. Rate-limited con limiter estricto (3 req / 15 min por IP).

Lógica:

1. Busca user por email.
2. **Siempre responde 200 con mensaje genérico** ("Si existe una cuenta con ese email, te enviamos un link") — no filtra existencia.
3. Si existe el user:
   - Genera token URL (32 bytes hex).
   - Guarda `passwordResetTokenHash = hash(token)` y `passwordResetExpiresAt = now + 1h`.
   - Construye URL: `${FRONTEND_URL}/restablecer-contrasenia?token=<rawToken>&email=<email>`.
   - Envía email con el link.
4. Si Resend falla, no devuelve error (mismo mensaje genérico) — loguea internamente.

**Nota de seguridad:** generar el token también pisa cualquier token de reset previo, así un atacante que tenga un token viejo no puede usarlo después de que el usuario pida uno nuevo.

### 3.2 Endpoint: `POST /api/auth/reset-password`

Body: `{ email, token, password }`. Rate-limited con `authLimiter`.

Lógica:

1. Busca user por email.
2. Si no existe, o `passwordResetExpiresAt < now`, o el hash no matchea → 400 "El link es inválido o expiró. Pedí uno nuevo".
3. Valida nueva password con las mismas reglas del modelo (8+ chars, 1 mayúscula, 1 número). Si falla la validación del schema, el mongoose error handler ya devuelve 400 con el mensaje correcto.
4. `user.password = password` (el pre-save hook hashea), limpia `passwordResetTokenHash` y `passwordResetExpiresAt`, `await user.save()`.
5. **Opcional:** invalidar sesiones existentes. Hoy los JWT no se pueden revocar sin un token version field. **Decisión:** no agregar eso ahora — el JWT expira en 24h igual, y si el usuario quería resetear es porque no tenía la sesión activa. Solo loguear el evento.
6. Responde 200 `{ message: 'Contraseña actualizada' }`. **No** loguea automáticamente — el client redirige a `/login` con un toast de éxito.

### 3.3 Pantallas en el client

**Nueva página: [`ForgotPassword.jsx`](../client/src/pages/auth/ForgotPassword.jsx)**, ruta `/recuperar-contrasenia`.

- Form simple con input email + botón "Enviar link".
- En éxito: muestra mensaje "Si existe una cuenta con ese email, te enviamos un link" (sin redirigir). Esconde el form.
- Link "Volver al login".

**Nueva página: [`ResetPassword.jsx`](../client/src/pages/auth/ResetPassword.jsx)**, ruta `/restablecer-contrasenia`.

- Lee `?token=...&email=...` del query.
- Si falta alguno → muestra error "Link inválido" + link a `/recuperar-contrasenia`.
- Form: nueva password + confirmar (mismo `PasswordInput` que Register).
- Validación client igual a Register (8+, 1 mayúscula, 1 número, match).
- `POST /api/auth/reset-password` con `{ email, token, password }`.
- En éxito: redirige a `/login` con `sessionStorage.setItem('flashMessage', 'Contraseña actualizada. Iniciá sesión.')`.
- Error → mostrar mensaje en `errorBox`. Si es "expirado", agregar link a `/recuperar-contrasenia`.

**Cambio en `Login.jsx`:**

- Agregar link "¿Olvidaste tu contraseña?" debajo del form, lleva a `/recuperar-contrasenia`.
- Después de leer `sessionStorage.flashMessage`, mostrarlo como `successBox` (necesito un estilo nuevo verde en `Auth.module.css`, o reusar el patrón `errorBox` con clase verde — preferentemente lo segundo, usando `--green` token).

### 3.4 Routing

En [`App.jsx`](../client/src/App.jsx):

- `<Route path="/recuperar-contrasenia" element={<PublicRoute><ForgotPassword /></PublicRoute>} />`
- `<Route path="/restablecer-contrasenia" element={<PublicRoute><ResetPassword /></PublicRoute>} />`

---

## Fase 4 — Polish, edge cases y QA

### 4.1 Templates de email

Hacer 2 templates HTML simples con:

- Background `#0e1a2b` (dark navy), text amber/white.
- Logo "TurnoCero" en texto + emoji 🎲.
- Footer con "Si no esperabas este mail, ignoralo".
- Render en text/html para compatibilidad (Gmail/Outlook clipping).

Probar en mobile (Gmail iOS/Android) y desktop (Gmail web, Outlook web).

### 4.2 Mensajes de error consistentes

Glossary para usar en client y server, en español:

| Caso                         | Mensaje                                                   |
| ---------------------------- | --------------------------------------------------------- |
| Código inválido / expirado   | "Código inválido o expirado"                              |
| Demasiados intentos          | "Demasiados intentos. Pedí un código nuevo"               |
| Email no verificado en login | "Tenés que verificar tu email antes de loguearte."        |
| Link de reset inválido       | "El link es inválido o expiró. Pedí uno nuevo"            |
| Email enviado (genérico)     | "Si existe una cuenta con ese email, te enviamos un link" |

### 4.3 Tests manuales (no hay test runner en el repo)

Flow checklist:

- [ ] Registro → recibo mail con código → ingreso código → loguea OK.
- [ ] Registro → ingreso código mal 5 veces → bloqueo, pido resend, funciona.
- [ ] Registro → espero 16 min → código expirado, pido resend, funciona.
- [ ] Login antes de verificar → redirige a `/verificar-email`.
- [ ] Forgot password con email existente → mail llega, link funciona, cambio password, login con la nueva.
- [ ] Forgot password con email inexistente → mismo mensaje genérico, no se envía mail (revisar logs).
- [ ] Reset password con link expirado → error claro con link para pedir nuevo.
- [ ] Reset password con nueva password débil → validación funciona.
- [ ] Usuario existente (migrado) puede loguear sin verificar.
- [ ] Dark mode + light mode en `/verificar-email`, `/recuperar-contrasenia`, `/restablecer-contrasenia`.
- [ ] Mobile responsivo en las 3 pantallas nuevas.

### 4.4 Edge cases a considerar

- **Usuario cambia el email en `/perfil`:** _No se toca en esta iteración_. Sigue como hoy (el campo email no es editable desde el form de profile actual — verificar). Si en el futuro se permite cambiar email, se haría re-verificación (similar a una de las opciones que se descartó en la decisión inicial).
- **Race condition: dos pedidos de reset seguidos.** El segundo pisa el token del primero. Aceptable.
- **Mail provider down (Resend caído):** registro responde 201 pero sin mail. El usuario puede reintentar el resend en la pantalla de verificación. Loguear el incidente.
- **Bots haciendo signup masivo:** ya tenemos `authLimiter` (10/15min). Si en producción aparece spam real, agregar captcha (fuera de scope acá).

---

## Resumen de cambios por archivo

### Server

- ➕ `server/utils/email.js` — wrapper de Resend + templates.
- ➕ `server/utils/authTokens.js` — generar/hashear códigos y tokens.
- ➕ `server/scripts/migrate-email-verified.js` — one-shot migration.
- ✏️ `server/models/User.js` — agregar campos de verificación y reset.
- ✏️ `server/routes/auth.js` — modificar register/login; agregar verify-email, resend-verification, forgot-password, reset-password.
- ✏️ `server/.env.example` — agregar `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`.
- ✏️ `server/package.json` — dependencia `resend`.

### Client

- ➕ `client/src/pages/auth/VerifyEmail.jsx`
- ➕ `client/src/pages/auth/ForgotPassword.jsx`
- ➕ `client/src/pages/auth/ResetPassword.jsx`
- ✏️ `client/src/pages/auth/Register.jsx` — no loguea, redirige a `/verificar-email`.
- ✏️ `client/src/pages/auth/Login.jsx` — link "olvidaste contraseña", manejar `email_not_verified`, mostrar flash messages.
- ✏️ `client/src/pages/auth/Auth.module.css` — variantes `successBox`, estilos para input de código.
- ✏️ `client/src/context/AuthContext.jsx` — reemplazar `register()` por `verifyEmail()`; helper `requestEmailVerification()`.
- ✏️ `client/src/App.jsx` — 3 nuevas rutas públicas.

---

## Order of implementation

Sugerido (cada fase puede ser un commit / PR):

1. **Fase 1** completa (infra: utilidades, modelo, migración, env vars) — no toca rutas, no impacta usuarios.
2. **Fase 2** completa (verificación de email) — feature funcional end-to-end, mergeable.
3. **Fase 3** completa (recuperar contraseña) — independiente de Fase 2 a nivel código (comparten infra de Fase 1).
4. **Fase 4** (polish, QA, edge cases).

Tiempo estimado:

- Fase 1: 1–2 h.
- Fase 2: 3–4 h (backend + UI + integración).
- Fase 3: 2–3 h (más simple, mismo patrón).
- Fase 4: 1–2 h.

Total: **7–11 horas** de trabajo.
