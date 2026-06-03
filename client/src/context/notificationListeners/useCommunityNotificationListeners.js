import { useSocketListeners } from "./useSocketListeners";
import {
  applyCommunityJoinRequestNotif,
  applyCommunityJoinResolvedNotif,
} from "../notificationReducers";

// Listeners de comunidades:
//  - `community:join-request` (a subadmins/admins): notif + toast agregables.
//  - `community:join-resolved` (al solicitante): notif + toast, y side-effect
//    crítico → recargar las memberships del CommunityContext para que el
//    selector de comunidad y /perfil reflejen el cambio SIN recargar la página.
//
// Nota: `gated` filtra por `EVENT_SECTION` (ambos eventos → "comunidades"); si
// la sección está OFF para el usuario (y no es admin), el evento se descarta.
// El reload igual queda cubierto: el server no emite si la sección está OFF.
export function useCommunityNotificationListeners({
  socket,
  gated,
  setNotifications,
  setToasts,
  reloadCommunity,
}) {
  useSocketListeners(
    socket,
    () => ({
      "community:join-request": gated("community:join-request", (payload) =>
        applyCommunityJoinRequestNotif({ setNotifications, setToasts, payload }),
      ),
      "community:join-resolved": gated("community:join-resolved", (payload) =>
        applyCommunityJoinResolvedNotif({
          setNotifications,
          setToasts,
          payload,
          onResolved: () => reloadCommunity?.(),
        }),
      ),
    }),
    [gated, setNotifications, setToasts, reloadCommunity],
  );
}
