import { useSocketListeners } from "./useSocketListeners";
import {
  applyBggPlaySharedNotif,
  applyBggPlayAcceptedNotif,
} from "../notificationReducers";

// BG Watch — "partida compartida". Dos eventos no-aggregating: a un co-jugador
// (play-shared, con snapshot embebido) y al autor cuando se la cargan
// (play-accepted, agradecimiento). Espejo de los demás hooks de listeners.
export function useBggNotificationListeners({
  socket,
  gated,
  setNotifications,
  setToasts,
}) {
  useSocketListeners(
    socket,
    () => ({
      "bgg:play-shared": gated("bgg:play-shared", (payload) =>
        applyBggPlaySharedNotif({ setNotifications, setToasts, payload }),
      ),
      "bgg:play-accepted": gated("bgg:play-accepted", (payload) =>
        applyBggPlayAcceptedNotif({ setNotifications, setToasts, payload }),
      ),
    }),
    [gated, setNotifications, setToasts],
  );
}
