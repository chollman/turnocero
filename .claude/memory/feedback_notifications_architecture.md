---
name: notifications-architecture
description: NotificationContext está splitteado en reducers puros + 9 hooks de listeners por dominio — saber qué tocar dónde
metadata:
  type: feedback
---

**Desde 2026-05-22 (P1.1, commits `082041e` + `730f7e0`).** `NotificationContext.jsx` pasó de 1157 → 386 líneas (-67%). La lógica vive ahora en 3 capas separadas: contexto, reducers puros, listeners por dominio.

**Why:** Antes era un monolito con 23+ `socket.on(...)` inline y 30-50 líneas de ifs/maps por listener. Cambiar el comportamiento de eventos requería navegar todo el archivo y los tests solo cubrían end-to-end con el provider montado. El split dio reducers unit-testeables sin React + hooks unit-testeables sin el socket completo, manteniendo el contrato externo intacto.
**How to apply:** Cuando agregues un nuevo tipo de notificación o cambies el handler de uno existente, identificar qué capa tocar:

## Las 3 capas

### 1. `client/src/context/NotificationContext.jsx` (386 líneas)
**Solo orquestación.** State local (`notifications`, `toasts`, refs), memoization del `value`, helpers de `markRead*`/`setActive*`/`addToast`/`removeToast`, y montaje de los 9 hooks de listeners. **No agregues lógica de business aquí** — va a la capa correspondiente.

### 2. `client/src/context/notificationReducers.js` (783 líneas, 43 unit tests)
**Funciones puras.** Una por listener:
- `applyChatNotif`, `applyCommentNotif`, `applyImageNotif`, `applyJoinRequest`, `applyJoinAccepted`, `applyJoinRejected`, `applySpotOpened`, `applyTableCancelled`
- `applyFriendRequest`, `applyFriendAccepted`
- `applyDmMessage`, `applyAdminMessageNotif`
- `applyTorneoNotif` (parametrizado: cubre los 6 tipos via EVENT_TO_TYPE map)
- `applyCompartidaComment`, `applyCompartidaLike`
- `applyNoticiaPublished`
- `applyEventoNotif` (discriminador via `payload.type`)

Cada reducer recibe `{ setNotifications, setToasts, payload, ...callbacks }` — **sin acceso a state externo**, todo via setters. Helpers internos `upsertAggregating` (chat/comment/image — server pushea `count`, update en lugar) y `replaceResource` (count=1, reemplaza por resource) unifican patrones.

**Contratos críticos testeados** (no romper):
- `count` se **SETEA con el valor del payload**, NUNCA se incrementa ([[notifications-contract]] + [[optimistic-vs-socket]]).
- Dedup por `notifId` / resource key.
- `markRead*` resetea `count: 0`.
- Mapeo del payload corto del server (`type: "confirmed"`) al enum largo (`evento_confirmed`).

### 3. `client/src/context/notificationListeners/` (10 archivos, 11 smoke tests)
**Hooks por dominio.** Cada uno registra los `socket.on` correspondientes y delega al reducer:
- `useNotificationSocket` — lifecycle del socket (connect on user, disconnect on logout/unmount). Expone el socket via `useState`.
- `useSocketListeners` — helper interno factory (on/off map) reutilizado por los 9 hooks de dominio.
- `useTableNotificationListeners` — 8 eventos de mesas; suppression via `activeTableRef`.
- `useFriendNotificationListeners` — `friend:request`, `friend:accepted` (refreshUser + fanout a `friendListenersRef`).
- `useDmNotificationListeners` — `dm:message` con fanout a `dmListenersRef` (consumido por `ChatContext`).
- `useAdminChatNotificationListeners` — `admin:message` con `adminChatActiveRef`.
- `useTorneoNotificationListeners` — 6 eventos parametrizados.
- `useCompartidaNotificationListeners` — `compartida:comment`, `compartida:like`.
- `useNoticiaNotificationListeners` — `noticia:published` (solo toast).
- `useEventoNotificationListeners` — `evento:notification` con discriminator.
- `useSiteConfigSocketListener` — `site-config:updated`.

**Listeners registrados ANTES de `await` o emits** (ver [[socket-handler-race]]).

## Reglas para nuevos tipos de notif

1. Agregar el tipo a `server/models/Notification.js#NOTIFICATION_TYPES`.
2. Emit en el route handler vía `emitNotificationReq(...)` ([[notifications-contract]]).
3. Crear `applyMiNuevoTipo` en `notificationReducers.js` siguiendo el patrón de `upsertAggregating` o `replaceResource`.
4. Si es un evento nuevo, agregar `useMiNuevoListener.js` en `notificationListeners/`; si es del mismo dominio que un hook existente, extender ese.
5. Montar el hook en `NotificationContext.jsx`.
6. Tests:
   - Unit del reducer en `notificationReducers.test.js` (regresión de `count`, dedup, markRead reset).
   - Smoke test en `listeners.test.jsx` (registra `socket.on`, cleanup llama `socket.off`).
   - Integration en `NotificationContext.test.jsx` (el archivo E2E de 1036 líneas — agregar caso).

## Mocks de test

El socket mock necesita `off: vi.fn()` (cada hook llama `socket.off` en cleanup). Los handlers se preservan en el map post-off para que tests que disparan eventos post-unmount verifiquen el cleanup interno (Sets de listeners, refs).
