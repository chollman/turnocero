import { useSocketListeners } from "./useSocketListeners";
import { applyDmMessageNotif } from "../notificationReducers";

// Listener de direct messages. Además de actualizar el contador via reducer,
// fan-outs el mensaje a todos los DM listeners registrados — eso es lo que
// ChatContext usa para refrescar ventanas de chat abiertas en tiempo real.
export function useDmNotificationListeners({
  socket,
  gated,
  setNotifications,
  dmListenersRef,
}) {
  useSocketListeners(
    socket,
    () => ({
      "dm:message": gated("dm:message", (payload) =>
        applyDmMessageNotif({
          setNotifications,
          payload,
          onMessage: (msg) => dmListenersRef.current.forEach((fn) => fn(msg)),
        }),
      ),
    }),
    [gated, setNotifications, dmListenersRef],
  );
}
