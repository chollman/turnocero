import { useSocketListeners } from "./useSocketListeners";
import { applyAdminMessageNotif } from "../notificationReducers";

// Listener de admin chat. No usamos `gated` — admin chat no es una sección
// del SiteConfig (siempre disponible para admins). La supresión por
// "active admin chat" se hace dentro del reducer vía `isActive()`.
export function useAdminChatNotificationListeners({
  socket,
  setNotifications,
  adminChatActiveRef,
}) {
  useSocketListeners(
    socket,
    () => ({
      "admin:message": (payload) =>
        applyAdminMessageNotif({
          setNotifications,
          payload,
          isActive: () => adminChatActiveRef.current,
        }),
    }),
    [setNotifications, adminChatActiveRef],
  );
}
