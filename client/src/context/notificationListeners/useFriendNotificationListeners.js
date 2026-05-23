import { useSocketListeners } from "./useSocketListeners";
import {
  applyFriendRequestNotif,
  applyFriendAcceptedNotif,
} from "../notificationReducers";

// Listeners de friends. friend:accepted dispara dos side-effects extra:
// refresca el user actual (la friends list cambió) y notifica a los
// "friend listeners" registrados (CompartidasContext usa esto para
// invalidar su feed).
export function useFriendNotificationListeners({
  socket,
  gated,
  setNotifications,
  setToasts,
  refreshUser,
  friendListenersRef,
}) {
  useSocketListeners(
    socket,
    () => ({
      "friend:request": gated("friend:request", (payload) =>
        applyFriendRequestNotif({ setNotifications, setToasts, payload }),
      ),
      "friend:accepted": gated("friend:accepted", (payload) =>
        applyFriendAcceptedNotif({
          setNotifications,
          setToasts,
          payload,
          onAccepted: () => {
            refreshUser().catch(() => {});
            friendListenersRef.current.forEach((fn) => fn());
          },
        }),
      ),
    }),
    [gated, setNotifications, setToasts, refreshUser, friendListenersRef],
  );
}
