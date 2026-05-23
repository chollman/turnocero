import { useSocketListeners } from "./useSocketListeners";
import { applyNoticiaPublishedNotif } from "../notificationReducers";

// Noticias broadcast a todos los users — solo toast, no persiste en
// /notificaciones (el reducer no toca setNotifications).
export function useNoticiaNotificationListeners({ socket, gated, setToasts }) {
  useSocketListeners(
    socket,
    () => ({
      "noticia:published": gated("noticia:published", (payload) =>
        applyNoticiaPublishedNotif({ setToasts, payload }),
      ),
    }),
    [gated, setToasts],
  );
}
