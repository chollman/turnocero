import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

const PARAM = "readNotif";

/**
 * Clickear una notificación push del sistema operativo (PWA cerrada/en
 * background) navega vía el `notificationclick` del service worker
 * (client.navigate / clients.openWindow — ver sw.js), que apenas puede armar
 * la URL de destino con `?readNotif=<notifId>`: no tiene el JWT del usuario
 * para pegarle a la API directamente.
 *
 * Este hook completa el otro lado: al bootear/enfocar con ese query param
 * presente, marca esa notif puntual como leída (markReadByNotifId) y limpia
 * el param de la URL. Espera a que termine de resolver el auth boot (`user`
 * asentado) para no perder el evento si el cold-start todavía no autenticó.
 */
export default function usePushNotifRead() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { markReadByNotifId } = useNotifications();
  const handledRef = useRef(new Set());

  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(location.search);
    const notifId = params.get(PARAM);
    if (!notifId || handledRef.current.has(notifId)) return;
    handledRef.current.add(notifId);
    markReadByNotifId(notifId);
    params.delete(PARAM);
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [
    loading,
    user,
    location.search,
    location.pathname,
    navigate,
    markReadByNotifId,
  ]);
}
