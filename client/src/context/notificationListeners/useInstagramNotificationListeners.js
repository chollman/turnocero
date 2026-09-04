import { useSocketListeners } from "./useSocketListeners";
import {
  applyInstagramPostSuccessNotif,
  applyInstagramPostFailedNotif,
} from "../notificationReducers";

// Instagram cross-post — dos eventos no-aggregating (uno por resultado),
// emitidos por el cron jobs/instagramPublish.js. Espejo de
// useBggNotificationListeners.
export function useInstagramNotificationListeners({
  socket,
  gated,
  setNotifications,
  setToasts,
}) {
  useSocketListeners(
    socket,
    () => ({
      "instagram:post-success": gated("instagram:post-success", (payload) =>
        applyInstagramPostSuccessNotif({ setNotifications, setToasts, payload }),
      ),
      "instagram:post-failed": gated("instagram:post-failed", (payload) =>
        applyInstagramPostFailedNotif({ setNotifications, setToasts, payload }),
      ),
    }),
    [gated, setNotifications, setToasts],
  );
}
