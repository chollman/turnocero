# Plan de implementación

## Objetivo

Crear el archivo `docs/hosting-guide.md` en el repositorio con la guía completa de hosting.

---

# Guía: Hosting seguro con dominio propio para Turnocero

## Alerta de seguridad urgente (hacer primero)

El archivo `server/.env` contiene credenciales reales visibles en el repo:

- `MONGODB_URI` con usuario y contraseña en texto plano
- `JWT_SECRET` con valor real

**Si el repo fue público en algún momento, estas credenciales están comprometidas. Acciones inmediatas:**

1. Cambiar la contraseña del usuario de MongoDB Atlas
2. Generar un nuevo `JWT_SECRET` (invalida todas las sesiones activas)
3. Verificar en `server/.env.example` que solo tenga valores placeholder (actualmente tiene la URI real)
4. Agregar `.env` a `.gitignore` y verificar que no esté trackeado con `git ls-files server/.env`

---

## Paso 1: Hacer el repositorio privado

1. GitHub → repositorio → Settings → "Change repository visibility" → Private
2. **Impacto:** GitHub Pages **deja de funcionar** en repos privados con plan gratuito → hay que migrar el frontend

---

## Paso 2: Comprar el dominio

**Recomendación:** Namecheap o Cloudflare Registrar

- **Cloudflare Registrar** (registrar.cloudflare.com): precio at-cost (~$10-15/año para .com, ~$3-5/año para .com.ar), sin markups. Requiere cuenta Cloudflare
- **Namecheap**: similar, con frecuentes promociones para el primer año (~$1-3)
- **Evitar:** GoDaddy (renovaciones caras), Google Domains (cerrado, migrado a Squarespace)

**Sugerencias de dominio para una app argentina de mesa:** turnocero.com, turnocero.com.ar, turnocero.app

### Configurar Cloudflare como DNS (gratis, muy recomendado)

Aunque compres en Namecheap, usa los nameservers de Cloudflare:

- Crea cuenta en cloudflare.com
- Agrega tu dominio
- Cambia los nameservers en Namecheap apuntando a los de Cloudflare
- **Beneficios gratuitos:** DDoS protection, WAF básico, caché CDN, SSL automático, analytics

---

## Paso 3: Migrar el frontend (GitHub Pages → Vercel)

GitHub Pages con repo privado requiere plan Team ($4/mes). La alternativa gratuita es **Vercel**.

### Por qué Vercel

- Soporta repos privados en plan gratuito
- Dominio personalizado con SSL automático
- Deploy automático en cada push a `master`
- Sin cold starts (siempre activo)
- Excelente soporte para Vite/React

### Pasos

1. Crear cuenta en vercel.com con tu cuenta de GitHub
2. "New Project" → importar repositorio `turnocero`
3. Configurar:
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Agregar variable de entorno: `VITE_API_URL = https://api.tudominio.com`
5. En Settings → Domains → agregar `tudominio.com` y `www.tudominio.com`

### Cambio de código necesario en `client/vite.config.js`

```js
// Cambiar:
base: '/turnocero/',
// Por:
base: '/',
```

Esto es necesario porque en dominio propio la app está en la raíz, no en un subdirectorio.

### Actualizar el workflow de GitHub Actions

El archivo `.github/workflows/deploy.yml` actualmente despliega a GitHub Pages. Con Vercel, el deploy es automático via la integración de GitHub — **se puede eliminar o desactivar el workflow**.

---

## Paso 4: Backend en Render.com (mantener y mejorar)

Render.com free tier funciona pero tiene **15 minutos de cold start** cuando no hay tráfico. Para una app de organización de mesas esto puede ser molesto (primer usuario del día espera mucho).

### Opción A: Quedarse en Render.com free (mínimo costo)

- Configurar UptimeRobot (uptimerobot.com, gratis) para hacer ping a `/api/health` cada 5 minutos → evita el cold start
- Agregar el dominio custom `api.tudominio.com` en Render → Settings → Custom Domains

### Opción B: Migrar a Railway (~$5/mes, recomendada si hay presupuesto)

- Sin cold starts
- Mejor performance
- Plan Hobby: $5/mes con $5 de crédito incluido (puede ser ~$0 con uso moderado)
- Deploy desde GitHub igual que Render

### Opción C: Fly.io (gratis con límites generosos)

- 3 VMs gratis (256MB RAM cada una)
- Sin cold starts
- Más complejo de configurar (requiere CLI y Dockerfile)

### Variables de entorno a actualizar en Render (o Railway)

```
MONGODB_URI=<nueva URI con password rotado>
JWT_SECRET=<nuevo secret generado>
CORS_ORIGIN=https://tudominio.com,https://www.tudominio.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Paso 5: Configurar DNS en Cloudflare

| Tipo  | Nombre     | Destino                 | Proxy                                                           |
| ----- | ---------- | ----------------------- | --------------------------------------------------------------- |
| CNAME | `@` (raíz) | `cname.vercel-dns.com`  | ON (naranja)                                                    |
| CNAME | `www`      | `cname.vercel-dns.com`  | ON (naranja)                                                    |
| CNAME | `api`      | `<tu-app>.onrender.com` | **OFF** (gris) ← importante: Render requiere proxy OFF para SSL |

> El registro raíz (@) requiere "CNAME Flattening" que Cloudflare hace automáticamente.

---

## Paso 6: Hardening de seguridad adicional

El servidor ya usa Helmet.js (bueno). Verificar/agregar:

### En `server/server.js` (verificar que estén)

- `helmet()` — ya está
- Rate limiting en rutas de auth (`/api/auth/login`, `/api/auth/register`) — verificar si está, si no agregar `express-rate-limit`
- CORS configurado con `CORS_ORIGIN` desde env — ya está

### En Cloudflare (gratis)

- SSL/TLS → modo "Full (strict)"
- Security → WAF → activar reglas managed gratuitas
- Speed → Minification activado
- Page Rules: redirect www → no-www (o viceversa, elegir uno)

### Secretos y credenciales

- Nunca commitear `.env` → está en `.gitignore`? Verificar
- Rotar MongoDB password y JWT_SECRET ahora
- Usar secrets de GitHub para el workflow de CI si se mantiene
- Variables de entorno solo en el dashboard de Render/Railway/Vercel

---

## Resumen de arquitectura final

```
Usuario
  │
  ▼
Cloudflare (DNS + CDN + SSL + WAF)
  ├── tudominio.com → Vercel (React/Vite, estático)
  └── api.tudominio.com → Render.com (Express + Socket.IO)
                              │
                         MongoDB Atlas (ya configurado)
                         Cloudinary (ya configurado)
```

---

## Checklist de implementación

- [ ] Rotar MongoDB password en Atlas
- [ ] Generar nuevo JWT_SECRET
- [ ] Verificar que `server/.env` no esté trackeado por git
- [ ] Limpiar historial de git si las credenciales fueron commiteadas (git filter-repo)
- [ ] Hacer el repo privado en GitHub
- [ ] Comprar dominio
- [ ] Crear cuenta Cloudflare y configurar nameservers
- [ ] Crear cuenta Vercel, importar proyecto, configurar dominio
- [ ] Cambiar `base: '/turnocero/'` → `base: '/'` en vite.config.js
- [ ] Desactivar/eliminar el GitHub Actions workflow de Pages
- [ ] Actualizar variables de entorno en Render (CORS_ORIGIN con nuevo dominio)
- [ ] Agregar dominio custom `api.tudominio.com` en Render
- [ ] Configurar UptimeRobot para evitar cold starts (si se queda en free)
- [ ] Configurar DNS records en Cloudflare
- [ ] Verificar SSL en ambos dominios

---

## Costo estimado total

| Servicio             | Costo                    |
| -------------------- | ------------------------ |
| Dominio .com         | ~$10-15/año              |
| Cloudflare DNS/CDN   | Gratis                   |
| Vercel (frontend)    | Gratis                   |
| Render.com (backend) | Gratis (con cold starts) |
| MongoDB Atlas        | Gratis (tier M0)         |
| Cloudinary           | Gratis (tier gratuito)   |
| **Total mínimo**     | **~$10-15/año**          |

Si se quiere evitar cold starts: Railway ~$5/mes (~$60/año adicionales).
