import { useSocketListeners } from "./useSocketListeners";
import {
  applyCompartidaCommentNotif,
  applyCompartidaLikeNotif,
  applyCompartidaCommentLikeNotif,
} from "../notificationReducers";

export function useCompartidaNotificationListeners({
  socket,
  gated,
  setNotifications,
  setToasts,
}) {
  useSocketListeners(
    socket,
    () => ({
      "compartida:comment": gated("compartida:comment", (payload) =>
        applyCompartidaCommentNotif({ setNotifications, setToasts, payload }),
      ),
      "compartida:like": gated("compartida:like", (payload) =>
        applyCompartidaLikeNotif({ setNotifications, setToasts, payload }),
      ),
      "compartida:comment-like": gated("compartida:comment-like", (payload) =>
        applyCompartidaCommentLikeNotif({
          setNotifications,
          setToasts,
          payload,
        }),
      ),
    }),
    [gated, setNotifications, setToasts],
  );
}
