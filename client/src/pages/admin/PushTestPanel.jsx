import { useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import { useNotifications } from "../../context/NotificationContext";
import { getErrorMessage } from "../../utils/getErrorMessage";
import usePushNotifications from "../../hooks/usePushNotifications";
import styles from "./PanelAdmin.module.css";

// Diagnóstico de Web Push para el panel admin: un botón que se autoenvía una
// push de prueba a todos los dispositivos suscriptos del admin. Sirve para
// confirmar que la entrega al sistema operativo funciona sin esperar a que
// ocurra un evento real. El backend marca el payload con `test: true`, así el
// service worker la muestra aunque la app esté en foco.
export default function PushTestPanel() {
  const { addToast } = useNotifications();
  const {
    isSupported,
    isSubscribed,
    permission,
    requiresStandalone,
    subscribe,
    busy: subBusy,
  } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  const sendTest = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(API.push.TEST);
      if (data.sent > 0) {
        addToast({
          type: "success",
          title: "Push de prueba enviada",
          message:
            data.sent === 1
              ? "Enviada a 1 dispositivo. Fijate que llegue la notificación."
              : `Enviada a ${data.sent} dispositivos. Fijate que llegue la notificación.`,
        });
      } else {
        addToast({
          type: "error",
          title: "Sin dispositivos suscriptos",
          message:
            "No tenés ningún dispositivo con las push activadas. Activalas y volvé a probar.",
        });
      }
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: getErrorMessage(err, "No pudimos enviar la push de prueba."),
      });
    } finally {
      setBusy(false);
    }
  };

  // Ofrecemos activar acá solo si tiene sentido en este device: soportado, no
  // suscripto, permiso no denegado y no requiere instalar la PWA (iOS en tab).
  const showActivate =
    isSupported &&
    !isSubscribed &&
    permission !== "denied" &&
    !requiresStandalone;

  return (
    <div className={styles.group}>
      <h2 className={styles.groupTitle}>Probar notificaciones push</h2>
      <p className={styles.sub}>
        Enviate una push de prueba a todos tus dispositivos suscriptos (este y
        cualquier otro donde hayas activado las notificaciones). Sirve para
        verificar que la entrega al sistema operativo funciona, sin esperar a que
        ocurra un evento real.
      </p>

      {showActivate && (
        <p className={styles.pushHint}>
          Este dispositivo todavía no está suscripto.{" "}
          <button
            type="button"
            className={styles.pushLink}
            onClick={subscribe}
            disabled={subBusy}
          >
            Activar acá
          </button>{" "}
          (o desde tu perfil) para que la prueba llegue a esta pantalla.
        </p>
      )}

      <div className={styles.pushActions}>
        <button
          type="button"
          className={styles.pushBtn}
          onClick={sendTest}
          disabled={busy}
        >
          {busy ? "Enviando…" : "Enviar push de prueba"}
        </button>
      </div>
    </div>
  );
}
