# Guía de despliegue — Turnocero

Esta guía te lleva paso a paso para poner Turnocero online usando tres servicios gratuitos:

| Pieza         | Servicio      | Para qué                             |
| ------------- | ------------- | ------------------------------------ |
| Base de datos | MongoDB Atlas | Guarda usuarios y mesas en la nube   |
| Backend (API) | Render        | Corre el servidor Express en la nube |
| Frontend      | GitHub Pages  | Sirve la app React estática          |

Al terminar la app estará disponible en `https://chollman.github.io/turnocero/` y cada vez que hagas push a `master` se actualizará automáticamente.

---

## Fase 1 — Renombrar el repositorio en GitHub

El nombre del repo determina la URL de GitHub Pages. Necesitás que sea `turnocero`.

1. Abrí tu repo en GitHub: [github.com/chollman/table-creator](https://github.com/chollman/table-creator)
2. Click en **Settings** (pestaña arriba a la derecha del repo).
3. Al inicio de la página, en el campo **Repository name**, borrá `table-creator` y escribí `turnocero`.
4. Click en **Rename**.
5. GitHub te redirige al nuevo URL: `github.com/chollman/turnocero`.

> Después de renombrar, actualizá la URL remota en tu máquina local:
>
> ```bash
> git remote set-url origin https://github.com/chollman/turnocero.git
> ```

---

## Fase 2 — Crear la base de datos en MongoDB Atlas

### 2.1 Crear cuenta

1. Abrí [cloud.mongodb.com](https://cloud.mongodb.com) en tu navegador.
2. Click en **Try Free** y registrate (podés usar Google).

### 2.2 Crear un cluster gratuito

1. Después de loguearte, click en **"Build a Database"**.
2. Elegí el plan **M0 Free** (es el de arriba a la derecha con "Free forever").
3. Elegí cualquier proveedor de nube (AWS, Google, Azure) y cualquier región cercana.
4. En el campo **Cluster Name** podés dejarlo como `Cluster0` o escribir `turnocero`.
5. Click en **Create Deployment**.

### 2.3 Configurar seguridad

En la pantalla **"Security Quickstart"** que aparece:

**Crear usuario de base de datos:**

1. En el campo **Username** escribí algo como `turnocero-user`.
2. En **Password** click en **Autogenerate Secure Password** y copiá la contraseña (guardala, la necesitás más adelante).
3. Click en **Create User**.

**Permitir conexiones desde cualquier IP:**

1. Más abajo, en la sección **"Where would you like to connect from?"**, click en **"My Local Environment"**.
2. En el campo **IP Address** escribí `0.0.0.0/0`.
3. En **Description** escribí `Allow all` (esto es necesario porque Render usa IPs dinámicas).
4. Click en **Add Entry**.
5. Click en **Finish and Close** → luego en **Go to Overview**.

### 2.4 Obtener el connection string

1. En la página principal del cluster, click en **Connect**.
2. Elegí **Drivers**.
3. En el paso 3, copiá el connection string. Se ve así:
   ```
   mongodb+srv://turnocero-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Reemplazá `<password>` con la contraseña que copiaste antes.
5. Guardá este string completo — lo usás en la Fase 3.

---

## Fase 3 — Deployar el backend en Render

### 3.1 Crear cuenta

1. Abrí [render.com](https://render.com) en tu navegador.
2. Click en **Get Started** y registrate usando tu cuenta de GitHub (recomendado, así conecta directo).

### 3.2 Crear el Web Service

1. En el dashboard de Render, click en **New +** → **Web Service**.
2. En **"Connect a repository"**, buscá `turnocero` y click en **Connect**.
3. Completá el formulario:

   | Campo              | Valor                             |
   | ------------------ | --------------------------------- |
   | **Name**           | `turnocero-api`                   |
   | **Region**         | Cualquiera (elegí la más cercana) |
   | **Branch**         | `master`                          |
   | **Root Directory** | `server`                          |
   | **Runtime**        | `Node`                            |
   | **Build Command**  | `npm install`                     |
   | **Start Command**  | `node server.js`                  |
   | **Instance Type**  | `Free`                            |

### 3.3 Agregar variables de entorno

1. Antes de crear el servicio, click en **"Advanced"** (está abajo del formulario).
2. En la sección **Environment Variables**, click en **Add Environment Variable** tres veces y completá:

   | Key           | Value                                                                      |
   | ------------- | -------------------------------------------------------------------------- |
   | `MONGODB_URI` | el connection string de Atlas de la Fase 2                                 |
   | `JWT_SECRET`  | una cadena larga y aleatoria, por ejemplo: `turnocero_jwt_secret_2024_xyz` |
   | `PORT`        | `4000`                                                                     |

3. Click en **Create Web Service**.

### 3.4 Esperar el deploy y copiar la URL

1. Render va a mostrar los logs en tiempo real. Esperá hasta ver:
   ```
   ✅ Connected to MongoDB
   🎲 Turnocero server running on port 4000
   ```
2. Arriba del todo verás la URL de tu servicio, algo como: `https://turnocero-api.onrender.com`
3. **Copiá esa URL** — la necesitás en la Fase 4.

> **Verificación:** Abrí en el navegador `https://turnocero-api.onrender.com/api/health`. Deberías ver: `{"status":"ok","message":"Turnocero API is running"}`

> **Nota:** El plan gratuito de Render pone el servicio a dormir después de 15 minutos sin uso. La primera request después de eso tarda ~30 segundos. Es normal para un proyecto personal.

---

## Fase 4 — Configurar el repositorio en GitHub

### 4.1 Agregar el secret VITE_API_URL

El workflow de GitHub Actions necesita saber la URL del backend para incluirla en el build del frontend.

1. Abrí tu repo en GitHub: `github.com/chollman/turnocero`
2. Click en **Settings**.
3. En el menú de la izquierda, click en **Secrets and variables** → **Actions**.
4. Click en **New repository secret**.
5. Completá:
   - **Name:** `VITE_API_URL`
   - **Secret:** la URL de Render de la Fase 3 (ej: `https://turnocero-api.onrender.com`)
6. Click en **Add secret**.

### 4.2 Activar GitHub Pages

1. En la misma sección **Settings** del repo, click en **Pages** en el menú izquierdo.
2. En **Source**, seleccioná **GitHub Actions** (no "Deploy from a branch").
3. Click en **Save**.

---

## Fase 5 — Hacer el primer deploy

### 5.1 Subir los cambios del código

En tu terminal, desde la raíz del proyecto:

```bash
git add .
git commit -m "Add GitHub Actions deployment workflow"
git push origin master
```

### 5.2 Ver el deploy en tiempo real

1. Abrí tu repo en GitHub.
2. Click en la pestaña **Actions**.
3. Vas a ver un workflow corriendo llamado **"Deploy to GitHub Pages"**. Click en él.
4. Podés ver los logs de cada paso. Tarda entre 1 y 2 minutos.
5. Cuando termine, todos los pasos van a mostrar un tilde verde ✓.

### 5.3 Verificar que funciona

1. Abrí `https://chollman.github.io/turnocero/` en tu navegador.
2. Deberías ver la pantalla de login de Turnocero.
3. Registrate con un usuario nuevo y verificá que podés:
   - Crear una mesa
   - Ver el dashboard
   - Cerrar sesión y volver a loguearte

---

## Flujo de trabajo de ahora en adelante

Cada vez que querés publicar cambios:

```bash
git add .
git commit -m "descripción del cambio"
git push origin master
```

GitHub Actions va a detectar el push, buildear la app y deployarla automáticamente. En 1-2 minutos los cambios están online.

---

## Resumen de URLs finales

| Qué            | URL                                           |
| -------------- | --------------------------------------------- |
| App (frontend) | https://chollman.github.io/turnocero/         |
| API (backend)  | https://turnocero-api.onrender.com            |
| Health check   | https://turnocero-api.onrender.com/api/health |
| Repo GitHub    | https://github.com/chollman/turnocero         |
