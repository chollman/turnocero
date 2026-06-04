---
name: feedback_notifications_tenant_scoping
description: En modo tenant (subdominio de comunidad) las notifs de contenido se acotan a esa comunidad; las personales (dm/amistad/admin-chat) se ven siempre
metadata:
  node_type: memory
  type: feedback
  originSessionId: e4c1efe1-758f-434c-91c0-8b40b9b821f2
---

Desde 2026-06-04: las notificaciones se scopean por comunidad en modo tenant (subdominio). Antes `GET /api/notifications` filtraba solo por `recipient` → en un subdominio se filtraban notifs de contenido de OTRAS comunidades (con deep-links que apuntaban afuera del tenant).

**Why:** el subdominio debe comportarse "como si las demás comunidades no existieran" (igual que el read-scoping de contenido). Pero las notifs persona-a-persona NO pertenecen a ninguna comunidad, así que se ven siempre (decisión del owner: "contenido al tenant, personales siempre").

**How to apply:**

- Tipos PERSONALES (siempre visibles, no se filtran por comunidad): `dm`, `friend_request`, `friend_accepted`, `admin_chat`. Definidos en `routes/notifications.js` (`PERSONAL_TYPES`) y en `client/src/context/notificationReducers.js` (`PERSONAL_EVENTS` = `friend:request`/`friend:accepted`/`dm:message`; `admin:message` no pasa por `gated`).
- El modelo `Notification` tiene un campo `community` (String, distinto de `communityId` que es el SUJETO de los tipos `community_*`). Es la comunidad del CONTENIDO, para el scoping.
- Se resuelve y persiste centralizado en `utils/saveNotification.js#resolveContentCommunity`: usa `fields.community` si vino, si no `communityId`, si no lookup lean por id-field (`tableId`→Table, `torneoId`→Torneo, `eventoId`→Evento, `compartidaId`→Compartida, `mathtradeId`→MathTrade) vía `mongoose.model(name)` perezoso. Personales → null. Auto-sana notifs legacy en el próximo evento aggregating.
- `emitNotification` mete `community: notif.community ?? null` en el payload del socket. Eventos directos fuera del helper (ej. `noticia:published` en `routes/noticias.js`) deben agregar `community` a mano.
- `GET /api/notifications`: si `req.tenant` (lo setea el middleware global `resolveTenant`), filtra `$or: [{ community: tenant }, { type: PERSONAL_TYPES }]`. Notifs de contenido legacy sin community quedan ocultas en el subdominio.
- Realtime: choke point en `gated` de `NotificationContext` — en modo tenant droppea eventos de contenido cuya `payload.community` != tenant; personales pasan. Lee tenant de `CommunityContext` vía `tenantIdRef`.

Al agregar un nuevo tipo/evento de notif: si es de contenido scopeado, asegurate de que el id-field esté en `resolveContentCommunity` (o pasá `community` explícito); si es personal, agregalo a `PERSONAL_TYPES` + `PERSONAL_EVENTS`. Ver [[project_community_subdomains]] y [[feedback_notifications_architecture]].

Noticias (caso especial): NO genera notif persistida — `noticia:published` es solo un toast realtime. La lista `GET /api/noticias` está bien scopeada (communityFilter). El toast antes era un `io.emit` broadcast a TODOS (leak a no-miembros). FIX (2026-06-04): ahora se emite DIRIGIDO a los miembros de la comunidad vía `communityService.memberIds(communityId, { exclude: autor })` → `io.to(rooms).emit(...)`; lleva `community` para el filtro por subdominio del cliente. Pendiente menor aún abierto: `GET /api/noticias/:id` (detalle) no está scopeado por comunidad/tenant (deep-link cross-comunidad sigue resolviendo, igual que compartidas/eventos).
