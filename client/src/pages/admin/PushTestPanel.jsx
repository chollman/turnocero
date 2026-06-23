import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          title: t("admin:pushTest.sentTitle"),
          message:
            data.sent === 1
              ? t("admin:pushTest.sentOne")
              : t("admin:pushTest.sentMany", { count: data.sent }),
        });
      } else {
        addToast({
          type: "error",
          title: t("admin:pushTest.noDevicesTitle"),
          message: t("admin:pushTest.noDevicesMessage"),
        });
      }
    } catch (err) {
      addToast({
        type: "error",
        title: t("admin:errorToast"),
        message: getErrorMessage(err, t("admin:pushTest.errorSend")),
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
      <h2 className={styles.groupTitle}>{t("admin:pushTest.title")}</h2>
      <p className={styles.sub}>{t("admin:pushTest.intro")}</p>

      {showActivate && (
        <p className={styles.pushHint}>
          {t("admin:pushTest.notSubscribed")}{" "}
          <button
            type="button"
            className={styles.pushLink}
            onClick={subscribe}
            disabled={subBusy}
          >
            {t("admin:pushTest.activateHere")}
          </button>
          {t("admin:pushTest.activateHint")}
        </p>
      )}

      <div className={styles.pushActions}>
        <button
          type="button"
          className={styles.pushBtn}
          onClick={sendTest}
          disabled={busy}
        >
          {busy ? t("admin:pushTest.sending") : t("admin:pushTest.send")}
        </button>
      </div>
    </div>
  );
}
