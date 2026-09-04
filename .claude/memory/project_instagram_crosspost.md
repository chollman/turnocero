---
name: project-instagram-crosspost
description: "Cross-post de Compartidas a Instagram (Feed/Historias) — conexión por usuario, cron async, notifs. Detalle completo en CLAUDE.md \"Instagram cross-post (Compartidas)\"."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b7b4467-1123-4b30-89db-b305d47726de
  modified: 2026-09-02T22:06:46.811Z
---

Implementado 2026-09-02, en una sola sesión larga cubriendo las 5 fases planeadas (plan original: `.claude/plans/generic-finding-cake.md`, no en `plans/` del repo — no se creó un doc persistente en el repo porque el usuario no lo pidió).

**Qué es:** opt-in por usuario — al crear una juntada pública con foto, un toggle deja tildar "también publicar en Instagram" (Feed y/o Historias). Requiere que el usuario tenga una cuenta de Instagram **Business o Creator** vinculada a una Página de Facebook (Instagram no permite publicar programáticamente en cuentas personales).

**Por qué se hizo:** pedido directo de Claudio — él tiene cuenta Business y quiere usarlo él mismo, con la idea de después anunciarlo como beneficio para otros usuarios creadores de contenido de la comunidad de boardgames.

**Arquitectura (full detail en CLAUDE.md, sección "Instagram cross-post (Compartidas)"):**
- Conexión por usuario (no login OAuth) — mismo patrón que `bggCredentials`: `User.instagramCredentials` con Page Access Token cifrado AES-256-GCM (reusa `encryption.js`, generalizado para aceptar el nombre de la env var — `INSTAGRAM_CREDS_KEY` en vez de `BGG_CREDS_KEY`).
- Publish 100% asincrónico vía cron nuevo (`jobs/instagramPublish.js`, cada 2 min, `withLease`) — el endpoint de creación solo marca `pending` y responde 202 al toque. Decisión de arquitectura confirmada por 3 agentes de research: este repo no tiene infra de colas (solo `node-cron`), y el patrón idiomático para "trabajo diferido a una API externa" es cron+lease, no el patrón sincrónico que usa BGG para escribir partidas.
- Notificaciones Feed y Historias de la MISMA compartida son independientes (`Notification.instagramTarget` entra en la clave de upsert junto a `compartidaId`) — si no, se pisarían entre sí.
- SiteConfig key nueva: `instagramCrosspost`, default OFF (como `push` — sin sección de nav propia).

**Estado al cierre de la sesión:** Fases 1-5 completas en código (conexión, toggle, cron, notifs, badge en CompartidaCard con botón "Reintentar", toggle en Panel Admin). Tests: 1839/1841 server (2 fallos preexistentes no relacionados, fechas hardcodeadas en tests de BGG), 3072/3072 client.

**Lo que falta es 100% externo/manual, no código:**
1. Crear/configurar la app de Facebook real (agregar producto "Instagram Graph API" + los 4 permisos) — reusa la MISMA app de `FB_APP_ID`/`FB_APP_SECRET` existente, no hace falta una nueva.
2. Generar `INSTAGRAM_CREDS_KEY` y setearlo en el `.env` de producción.
3. Claudio conecta SU cuenta Business real y prueba el flujo end-to-end (funciona sin App Review porque él es Admin/Developer de la app).
4. Someter la app a **App Review de Meta** (`instagram_content_publish`, `pages_show_list`, `instagram_basic`, `pages_read_engagement`) antes de prender `instagramCrosspost` para el resto de los usuarios — proceso de días/semanas, no técnico.

**Gap de testing conocido (decisión consciente, no descuido):** `useFacebookSdk.js` (el hook que carga el SDK de Facebook) sigue sin tests propios — ya estaba así antes de esta sesión (cero cobertura, ni siquiera para el login de Facebook existente) porque el módulo lee `import.meta.env.VITE_FB_APP_ID` a nivel de módulo e inyecta un `<script>` real al DOM, lo que lo hace incómodo de testear sin mocks frágiles de env-vars-en-import-time. Se agregó un parámetro `scope` opcional a `login()` sin agregar tests nuevos, siguiendo el mismo criterio que ya tenía el archivo. La cobertura real de esta feature vive en los tests de `UserProfile.jsx`/`CreateCompartidaForm.jsx`/`PlayForm.jsx` que SÍ mockean el hook completo.
