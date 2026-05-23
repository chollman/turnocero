import { useSocketListeners } from "./useSocketListeners";
import { applyTorneoNotif } from "../notificationReducers";

// 6 eventos de torneo mapeados a 6 tipos de notif. El reducer es
// parametrizado por `type` para que un único cuerpo maneje toda la matrix.
const EVENT_TO_TYPE = {
  "torneo:registration-accepted": "tournament_accepted",
  "torneo:registration-rejected": "tournament_rejected",
  "torneo:advanced": "tournament_advanced",
  "torneo:eliminated": "tournament_eliminated",
  "torneo:started": "tournament_started",
  "torneo:finished": "tournament_finished",
};

export function useTorneoNotificationListeners({
  socket,
  gated,
  setNotifications,
  setToasts,
}) {
  useSocketListeners(
    socket,
    () => {
      const dispatchTorneo = (type) => (payload) =>
        applyTorneoNotif({ setNotifications, setToasts, payload, type });
      const handlers = {};
      for (const [event, type] of Object.entries(EVENT_TO_TYPE)) {
        handlers[event] = gated(event, dispatchTorneo(type));
      }
      return handlers;
    },
    [gated, setNotifications, setToasts],
  );
}
