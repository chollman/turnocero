import { useSocketListeners } from "./useSocketListeners";
import { applyEventoNotif } from "../notificationReducers";

// Eventos usa un único socket event con discriminator `type` en payload.
// La supresión por "active evento" la hace el reducer leyendo
// `activeEventoRef.current` via la closure `isActive`.
export function useEventoNotificationListeners({
  socket,
  gated,
  activeEventoRef,
  setNotifications,
  setToasts,
}) {
  useSocketListeners(
    socket,
    () => ({
      "evento:notification": gated("evento:notification", (payload) =>
        applyEventoNotif({
          setNotifications,
          setToasts,
          payload,
          isActive: (eventoId) => activeEventoRef.current === eventoId,
        }),
      ),
    }),
    [gated, activeEventoRef, setNotifications, setToasts],
  );
}
