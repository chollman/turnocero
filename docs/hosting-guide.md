# Guía: Hosting seguro con dominio propio

## ⚠️ Alerta de seguridad urgente (hacer primero)

El archivo `server/.env` puede contener credenciales reales. Si el repositorio fue público en algún momento:

1. Cambiar la contraseña del usuario en MongoDB Atlas
2. Generar un nuevo `JWT_SECRET` (invalida todas las sesiones activas)
3. Verificar que `server/.env.example` solo tenga valores placeholder
4. Confirmar que `.env` no está trackeado: `git ls-files server/.env`
5. Si las credenciales fueron commiteadas: limpiar historial con `git filter-repo`

---

## Arquitectura objetivo

```
Usuario
  │
  ▼
Cloudflare (DNS + CDN + SSL + WAF — gratis)
  ├── tudominio.com → Vercel (React/Vite — gratis)
  └── api.tudominio.com → Render.com (Express + Socket.IO — gratis)
                              │
                         MongoDB Atlas (ya configurado)
                         Cloudinary (ya configurado)
```

**Costo total mínimo: ~$10–15/año** (solo el dominio).

---

## Paso 1: Hacer el repositorio privado

GitHub → repositorio → Settings → "Change repository visibility" → **Private**

> GitHub Pages deja de funcionar con repos privados en el plan gratuito. El siguiente paso migra el frontend a Vercel, que sí soporta repos privados gratis.

---

## Paso 2: Comprar el dominio

| Opción                   | Precio aprox.      | Notas                                                   |
| ------------------------ | ------------------ | ------------------------------------------------------- |
| **Cloudflare Registrar** | ~$10–15/año (.com) | Precio at-cost, sin markups. Requiere cuenta Cloudflare |
| **Namecheap**            | ~$1–3 (1er año)    | Promociones frecuentes                                  |
| GoDaddy                  | —                  | Evitar — renovaciones caras                             |

Sugerencias: `turnocero.com`, `turnocero.com.ar`, `turnocero.app`

### Configurar Cloudflare como DNS (gratis, muy recomendado)

Aunque compres el dominio en Namecheap, apunta los nameservers a Cloudflare:

1. Crear cuenta en cloudflare.com
2. Agregar el dominio
3. En Namecheap: cambiar los nameservers por los que indica Cloudflare

**Beneficios gratuitos:** protección DDoS, WAF básico, CDN, SSL automático, analytics.

---

## Paso 3: Migrar el frontend a Vercel

### Por qué Vercel

- Soporta repos privados en plan gratuito
- Dominio personalizado con SSL automático
- Deploy automático en cada push a `master`
- Sin cold starts
- Soporte nativo para Vite/React

### Pasos en Vercel

1. Crear cuenta en vercel.com conectando tu cuenta de GitHub
2. **New Project** → importar repositorio `turnocero`
3. Configurar el proyecto:
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Agregar variable de entorno: `VITE_API_URL = https://api.tudominio.com`
5. Settings → Domains → agregar `tudominio.com` y `www.tudominio.com`

### Cambio de código necesario

En `client/vite.config.js`, cambiar el `base` para que apunte a la raíz:

```js
// Antes (GitHub Pages):
base: '/turnocero/',

// Después (dominio propio):
base: '/',
```

### GitHub Actions

El archivo `.github/workflows/deploy.yml` despliega a GitHub Pages. Con Vercel el deploy es automático via la integración de GitHub — se puede **eliminar o desactivar** ese workflow.

---

## Paso 4: Backend en Render.com

Render.com free tier tiene **cold starts de ~15 minutos** si no hay tráfico reciente.

### Opción A: Quedarse en Render.com free (costo cero)

- Configurar **UptimeRobot** (uptimerobot.com, gratis) para hacer ping a `/api/health` cada 5 minutos → elimina los cold starts
- Agregar el dominio custom: Render → Settings → Custom Domains → `api.tudominio.com`

### Opción B: Railway (~$5/mes)

- Sin cold starts
- Mejor performance general
- Plan Hobby: $5/mes con $5 de crédito incluido (puede ser ~$0 con uso moderado)
- Deploy desde GitHub igual que Render

### Opción C: Fly.io (gratis con límites generosos)

- 3 VMs gratis (256 MB RAM c/u), sin cold starts
- Setup más complejo (requiere CLI + Dockerfile)

### Variables de entorno a actualizar en el backend

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

| Tipo  | Nombre     | Destino                 | Proxy          |
| ----- | ---------- | ----------------------- | -------------- |
| CNAME | `@` (raíz) | `cname.vercel-dns.com`  | ON (naranja)   |
| CNAME | `www`      | `cname.vercel-dns.com`  | ON (naranja)   |
| CNAME | `api`      | `<tu-app>.onrender.com` | **OFF** (gris) |

> El proxy de Cloudflare debe estar **apagado** para el subdominio `api` porque Render maneja su propio SSL. Para el frontend en Vercel, déjalo encendido para aprovechar el CDN.

El registro `@` (raíz) requiere CNAME Flattening, que Cloudflare aplica automáticamente.

---

## Paso 6: Hardening de seguridad

El servidor ya usa **Helmet.js** para headers de seguridad. Verificar adicionalmente:

### En Cloudflare (gratis)

- SSL/TLS → modo **Full (strict)**
- Security → WAF → activar reglas managed gratuitas
- Speed → Minification activado
- Redirect: forzar `www` → sin `www` (o viceversa, elegir uno con una Page Rule)

### En el servidor Express

- **Rate limiting** en rutas de auth — si no está implementado, agregar `express-rate-limit` en `/api/auth/login` y `/api/auth/register`
- CORS ya está configurado desde variable de entorno (`CORS_ORIGIN`) — correcto

### Secretos

- Variables de entorno solo en los dashboards de Render/Railway/Vercel — nunca en el repo
- Para el workflow de GitHub Actions: usar **GitHub Secrets** (Settings → Secrets and variables → Actions)

---

## Checklist de implementación

### Seguridad (hacer antes de hacer el repo privado)

- [ ] Rotar password del usuario en MongoDB Atlas
- [ ] Generar nuevo `JWT_SECRET`
- [ ] Verificar que `server/.env` no está trackeado por git
- [ ] Limpiar historial de git si las credenciales fueron commiteadas

### Repo e infraestructura

- [ ] Hacer el repo privado en GitHub
- [ ] Comprar dominio
- [ ] Crear cuenta Cloudflare y configurar nameservers

### Frontend

- [ ] Crear cuenta Vercel e importar el proyecto
- [ ] Cambiar `base: '/turnocero/'` → `base: '/'` en `client/vite.config.js`
- [ ] Configurar variable de entorno `VITE_API_URL` en Vercel
- [ ] Agregar dominio en Vercel
- [ ] Desactivar/eliminar el GitHub Actions workflow de Pages

### Backend

- [ ] Actualizar variables de entorno en Render (especialmente `CORS_ORIGIN`)
- [ ] Agregar dominio custom `api.tudominio.com` en Render
- [ ] Configurar UptimeRobot para evitar cold starts (si se queda en free)

### DNS y seguridad final

- [ ] Configurar registros DNS en Cloudflare (tabla del Paso 5)
- [ ] Activar SSL Full (strict) en Cloudflare
- [ ] Verificar HTTPS en ambos dominios (`tudominio.com` y `api.tudominio.com`)

---

## Costo estimado total

| Servicio               | Costo                    |
| ---------------------- | ------------------------ |
| Dominio .com           | ~$10–15/año              |
| Cloudflare DNS/CDN/WAF | Gratis                   |
| Vercel (frontend)      | Gratis                   |
| Render.com (backend)   | Gratis (con cold starts) |
| MongoDB Atlas          | Gratis (tier M0)         |
| Cloudinary             | Gratis (tier gratuito)   |
| **Total mínimo**       | **~$10–15/año**          |

Para eliminar cold starts: Railway ~$5/mes (~$60/año adicionales).
