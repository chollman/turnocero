import { useSocketListeners } from "./useSocketListeners";
import {
  applyChatNotif,
  applyCommentNotif,
  applyImageNotif,
  applyJoinRequestNotif,
  applyPlayerJoinedNotif,
  applyPlayerLeftNotif,
  applyJoinAcceptedNotif,
  applyJoinRejectedNotif,
  applySpotOpenedNotif,
  applyTableCancelledNotif,
} from "../notificationReducers";

// Listeners de notificaciones relacionadas con mesas. La supresión por
// "active table" (cuando el user está viendo la mesa en pantalla, no le
// notificamos sobre ella) se hace acá vía `activeTableRef.current`.
export function useTableNotificationListeners({
  socket,
  gated,
  activeTableRef,
  setNotifications,
  setToasts,
}) {
  useSocketListeners(
    socket,
    () => ({
      "chat:notification": gated("chat:notification", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyChatNotif({ setNotifications, setToasts, payload });
      }),
      "table:comment": gated("table:comment", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyCommentNotif({ setNotifications, setToasts, payload });
      }),
      "table:image": gated("table:image", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyImageNotif({ setNotifications, setToasts, payload });
      }),
      "join:request": gated("join:request", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyJoinRequestNotif({ setNotifications, setToasts, payload });
      }),
      "table:player-joined": gated("table:player-joined", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyPlayerJoinedNotif({ setNotifications, setToasts, payload });
      }),
      "table:player-left": gated("table:player-left", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyPlayerLeftNotif({ setNotifications, setToasts, payload });
      }),
      "join:accepted": gated("join:accepted", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applyJoinAcceptedNotif({ setNotifications, setToasts, payload });
      }),
      "join:rejected": gated("join:rejected", (payload) =>
        applyJoinRejectedNotif({ setNotifications, setToasts, payload }),
      ),
      "table:spot-opened": gated("table:spot-opened", (payload) => {
        if (activeTableRef.current === payload.tableId) return;
        applySpotOpenedNotif({ setNotifications, setToasts, payload });
      }),
      "table:cancelled": gated("table:cancelled", (payload) =>
        applyTableCancelledNotif({ setNotifications, setToasts, payload }),
      ),
    }),
    [gated, activeTableRef, setNotifications, setToasts],
  );
}
