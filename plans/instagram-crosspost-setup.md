# Instagram cross-post — configuración pendiente (a hacer por Claudio)

El código de la feature está 100% cerrado (ver
[plans/instagram-crosspost.md](instagram-crosspost.md) para el detalle de
fases y [CLAUDE.md](../CLAUDE.md) → "Instagram cross-post (Compartidas)" para
la arquitectura). Todo lo que queda es configuración externa en Meta/Facebook
Developers y en el hosting — nada de esto es código, y nada de esto lo puede
hacer Claude por vos (requiere tu login de Facebook, tu tarjeta/identidad para
verificación de negocio si aplica, y decisiones de producto tuyas).

Seguí los pasos en orden. Los pasos 1-5 alcanzan para que **vos** uses la
feature ya mismo. El paso 6 (App Review) es el único requisito para
habilitarla al resto de los usuarios.

---

## Paso 1: Agregar el producto "Instagram Graph API" a tu app de Facebook

La feature reusa la MISMA app de Facebook que ya tenés configurada para el
login (`FB_APP_ID`/`FB_APP_SECRET`) — no hace falta crear una app nueva.

1. Andá a [developers.facebook.com/apps](https://developers.facebook.com/apps)
   y abrí tu app existente.
2. En el panel izquierdo, **Agregar producto** (Add Product) → buscá
   **"Instagram"** → agregá **"Instagram Graph API"** (o "Instagram API
   setup with Facebook Login" si Meta te lo muestra así — es el mismo
   producto, la nomenclatura de Meta cambia de tanto en tanto).
3. Andá a **App Review → Permisos y funciones** (Permissions and Features) y
   buscá/solicitá acceso (Request Advanced Access) para estos 4 permisos:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`

   **No hace falta esperar la aprobación todavía** — en modo Development,
   estos permisos ya funcionan automáticamente para cualquier usuario que
   tenga rol Administrador/Desarrollador/Tester de la app (ver Paso 4). La
   aprobación de Meta (Paso 6) solo hace falta para que usuarios SIN esos
   roles puedan conectar su cuenta.

---

## Paso 2: Vincular tu Instagram Business con tu Página de Facebook

Instagram Content Publishing **solo funciona con cuentas Business o
Creator** — nunca con cuentas personales.

1. En la app de Instagram (celular): **Configuración → Cuenta → Cambiar a
   cuenta profesional** (si tu cuenta ya es Business/Creator, saltá este
   paso).
2. Confirmá que esa cuenta de Instagram está vinculada a una **Página de
   Facebook** que administrás: en Facebook, andá a tu Página →
   **Configuración → Instagram** → "Conectar cuenta" (si no está ya
   conectada).

---

## Paso 3: Generar `INSTAGRAM_CREDS_KEY`

Es la clave que cifra el token guardado de cada usuario (mismo mecanismo que
`BGG_CREDS_KEY`, ya la tenés configurada para BGG).

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiá el resultado (64 caracteres hex) y agregalo como variable de entorno
`INSTAGRAM_CREDS_KEY` en:

- El `.env` de tu server en producción (Render, Railway, o donde esté
  deployado el backend).
- Tu `server/.env` local, si querés probarlo en desarrollo.

**Nunca compartas este valor ni lo commitees** — rotarlo invalida las
conexiones de Instagram ya guardadas (los usuarios tendrían que reconectar).

---

## Paso 4: Confirmar tu rol en la app de Facebook

Para que la conexión funcione con TU cuenta sin esperar el App Review:

1. En [developers.facebook.com/apps/TU_APP/roles/roles](https://developers.facebook.com/apps/) →
   **Roles → Roles de la app**.
2. Confirmá que tu usuario de Facebook (el que usás para loguearte en la
   app) figura como **Administrador** o **Desarrollador**. Si no, agregate.

---

## Paso 5: Conectar tu cuenta y probar el flujo completo

Con el deploy corriendo con `INSTAGRAM_CREDS_KEY` seteada:

1. Como admin, prendé la sección desde `/panel-admin` (buscá **"Cross-post a
   Instagram"**, grupo "Integraciones") — solo para vos, no hace falta
   esperar el App Review para tu propia cuenta gracias al Paso 4.
2. Andá a `/perfil` → sección **"Conexión con Instagram"** → **"Conectar con
   Instagram"**. Se abre un popup de Facebook pidiendo los 4 permisos del
   Paso 1 — aceptalos todos.
3. Verificá que la sección muestra tu `@usuario` de Instagram y el nombre de
   tu Página.
4. Creá una juntada pública con 1 a 3 fotos, tildá **Feed** y/o
   **Historias**, publicá.
5. Esperá hasta 2 minutos (el cron `instagramPublish` corre cada 2 min) y
   revisá:
   - La campanita de notificaciones — te avisa si se publicó o si falló.
   - Tu Instagram real — el post debería aparecer.
   - Si algo falla, la tarjeta de la Compartida muestra "No se pudo publicar
     en Instagram" con un botón **Reintentar**.

**Si algo no funciona**, los logs del server tienen el prefijo
`[instagramPublish]` — ahí vas a ver el error real de la Graph API de Meta
(token inválido, permiso faltante, cuenta sin vincular, etc.).

---

## Paso 6: Someter la app a App Review de Meta (para habilitarlo a otros usuarios)

Esto es lo único que falta para que CUALQUIER usuario de Turnocero (no solo
vos) pueda conectar su Instagram. Es un trámite externo con Meta, no técnico,
que puede tardar de días a semanas.

1. En tu app → **App Review → Permisos y funciones**, para cada uno de los
   4 permisos del Paso 1, hacé click en **"Solicitar acceso avanzado"**
   (Request Advanced Access).
2. Meta te va a pedir, por cada permiso:
   - **Un screencast** mostrando el flujo real de la feature usándolo: entrar
     a `/perfil`, conectar Instagram, crear una juntada, tildar Feed/Historias,
     y mostrar que efectivamente se publica en Instagram.
   - **Una descripción del caso de uso** (en inglés) — algo como: "Turnocero
     is a community platform for board gamers. Users can optionally
     cross-post their own public game-night posts to their own connected
     Instagram Business account."
   - Puede pedir **verificación de negocio** (Business Verification) —
     puede requerir datos/documentación de vos o del proyecto según cómo
     esté configurada la app.
3. Confirmá que la app tiene publicadas y linkeadas una **Política de
   Privacidad** y **Términos de Servicio** (Meta lo exige para pasar a modo
   Live) — si Turnocero no las tiene todavía, es un prerrequisito de este
   paso, no de la feature en sí.
4. Metés la solicitud y esperás. Si Meta rechaza y pide ajustes, es normal —
   se corrige lo que pidan y se vuelve a enviar.

---

## Paso 7: Habilitar la sección para todos

Una vez aprobado el App Review:

1. `/panel-admin` → prender **"Cross-post a Instagram"** para todos los
   usuarios (ya no hace falta el rol de admin/dev en la app de Facebook).
2. Opcional: anunciarlo en Noticias para que los usuarios con cuenta
   Business/Creator sepan que pueden conectarla.
