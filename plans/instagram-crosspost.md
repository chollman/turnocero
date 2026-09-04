# Cross-post de Compartidas a Instagram (Feed / Historias)

## Contexto

Pedido de Claudio: al crear una juntada pública con foto en Compartidas, poder
tildar una opción para que el mismo post se publique también en su Instagram
(Feed y/o Historias). Requiere que el usuario tenga una cuenta de Instagram
**Business o Creator** vinculada a una Página de Facebook — la Content
Publishing API de Meta no funciona con cuentas personales. La idea es
habilitarlo primero para Claudio (que ya tiene cuenta Business) y más adelante
anunciarlo como beneficio opcional para otros usuarios creadores de contenido.

Detalle de arquitectura completo en [CLAUDE.md](../CLAUDE.md) → sección
"Instagram cross-post (Compartidas)". Este archivo es el tracker de estado +
los pasos externos que faltan para habilitarlo en producción.

## Decisiones de arquitectura

1. **Conexión por usuario, no login OAuth** — mismo patrón que BGG
   (`bggCredentials`): un subdocumento `User.instagramCredentials` con el
   **Page Access Token** cifrado (no el token del usuario — las llamadas de
   publish usan el token de la Página), más `igUserId`/`igUsername`/`pageId`/
   `pageName` y un flag `invalid`.
2. **Publish 100% asincrónico, nunca bloquea la creación de la Compartida** —
   no hay infra de colas en este repo (solo `node-cron`), así que se usa el
   patrón cron + `withLease` ya establecido (`eventoReminders.js`) en vez del
   patrón sincrónico que usa BGG para escribir partidas.
3. **Feed e Historias de la misma Compartida son notificaciones
   independientes** (`Notification.instagramTarget` entra en la clave de
   upsert junto a `compartidaId`).
4. **`instagramCrosspost` en SiteConfig, default OFF** — mismo rol que `push`
   (interruptor maestro, sin sección de nav propia).
5. **Cifrado**: se generalizó `server/utils/encryption.js` para aceptar el
   nombre de la env var (default `BGG_CREDS_KEY`, cero riesgo para BGG),
   así este feature usa su propia `INSTAGRAM_CREDS_KEY`.

## Estado — código 100% cerrado (2026-09-02)

- [x] **Fase 1 — Conexión (servidor)**: `User.instagramCredentials`,
      `encryption.js` generalizado, `server/services/instagramService.js`
      (`exchangeLongLivedToken`, `findInstagramPage`, `fetchIgUsername`,
      `validateAccessToken`), `POST/DELETE /api/auth/instagram-connect(ion)`
      en [server/routes/auth.js](../server/routes/auth.js), SiteConfig key.
      +20 server tests.
- [x] **Fase 2 — UI de conexión**: sección "Conexión con Instagram" en
      [UserProfile.jsx](../client/src/pages/users/UserProfile.jsx) (3 estados:
      no conectado / conectado / inválido), reusa `useFacebookSdk` con un
      scope extendido (`login(scope)` ahora acepta el scope como parámetro).
      +57 client tests en el archivo.
- [x] **Fase 3 — Pipeline de publicación (servidor)**: `Compartida.instagram.
      {feed,story}`, resto de `instagramService.js` (containers/carrusel/
      historias/poll/publish/permalink/caption), `POST
      /api/compartidas/:id/instagram-post` (202 inmediato), cron
      [server/jobs/instagramPublish.js](../server/jobs/instagramPublish.js)
      (cada 2 min, registrado en `scheduler.js`), tipos de notificación
      `instagram_post_success`/`instagram_post_failed`. +49 server tests.
- [x] **Fase 4 — Toggle al crear (cliente)**: checkboxes Feed/Historias en
      [JuntadaFields.jsx](../client/src/pages/compartidas/JuntadaFields.jsx)
      (compartido entre Compartidas y BG Watch), 3er paso aislado en
      [createJuntada.js](../client/src/pages/compartidas/createJuntada.js)
      (un fallo de Instagram nunca revierte la Compartida), wiring completo
      de notificaciones en tiempo real (`useInstagramNotificationListeners`,
      `notifDomains.js`, toasts). +~150 client tests entre todos los archivos
      tocados.
- [x] **Fase 5 — Admin + badge**: toggle `instagramCrosspost` en
      [PanelAdmin.jsx](../client/src/pages/admin/PanelAdmin.jsx), badge de
      estado en
      [CompartidaCard.jsx](../client/src/pages/compartidas/CompartidaCard.jsx)
      ("Publicando…" / link "Ver en Instagram" / "No se pudo publicar" +
      botón **Reintentar**). +8 client tests.

**Verificación al cierre**: 1839/1841 tests de servidor (los 2 fallos son
preexistentes — fechas hardcodeadas en tests de BGG, no relacionados),
3072/3072 tests de cliente. `npm run lint:breakpoints` y ESLint limpios en
todos los archivos tocados.

## Lo que falta — 100% externo/manual, no código

- [ ] Agregar el producto **"Instagram Graph API"** + los permisos
      `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
      `pages_read_engagement` a la app de Facebook existente (la misma de
      `FB_APP_ID`/`FB_APP_SECRET` — no hace falta una app nueva).
- [ ] Generar `INSTAGRAM_CREDS_KEY` (64-char hex, mismo comando que
      `BGG_CREDS_KEY`) y setearlo en el `.env` de producción.
- [ ] Conectar la cuenta de Instagram Business real de Claudio desde
      `/perfil` y probar el flujo completo contra la Graph API real (Feed
      simple, carrusel 2-3 fotos, historia) — funciona sin App Review porque
      Claudio es Admin/Developer de la app de Facebook.
- [ ] Someter la app a **App Review de Meta** de los 4 permisos de arriba —
      proceso externo de días/semanas — antes de prender `instagramCrosspost`
      en `/panel-admin` para el resto de los usuarios.

## Gap de testing conocido (decisión consciente)

`client/src/hooks/useFacebookSdk.js` sigue sin test propio — ya estaba así
antes de este feature (cero cobertura, ni para el login de Facebook
existente): el módulo lee `import.meta.env.VITE_FB_APP_ID` a nivel de módulo
e inyecta un `<script>` real al DOM, lo que lo hace incómodo de testear sin
mocks frágiles de env-vars-en-import-time. Se le agregó un parámetro `scope`
opcional a `login()` sin sumar tests nuevos, seteando el mismo criterio que
ya tenía el archivo. La cobertura real de este feature vive en los tests de
`UserProfile`/`CreateCompartidaForm`/`PlayForm`, que mockean el hook completo.
