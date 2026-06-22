import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import { useNotifications } from "../../context/NotificationContext";
import usePushNotifications from "../../hooks/usePushNotifications";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import styles from "./PushPrompt.module.css";

// Banner proactivo (dismissible) que invita a activar las notificaciones push.
// Aparece recién a partir de la 2da sesión, solo si el push está soportado y el
// permiso aún no se decidió, y respeta el toggle admin `push`. Nunca pide el
// permiso por su cuenta: siempre detrás del click en "Activar" (gesto del
// usuario, requisito de iOS). Tras descartar, no reaparece por 14 días.
const REPROMPT_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_SESSIONS = 2;

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PUSH_PROMPT);
    if (!raw) return { dismissedAt: null, sessionCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      dismissedAt: parsed?.dismissedAt ?? null,
      sessionCount: parsed?.sessionCount ?? 0,
    };
  } catch {
    return { dismissedAt: null, sessionCount: 0 };
  }
}

function writeState(next) {
  try {
    localStorage.setItem(STORAGE_KEYS.PUSH_PROMPT, JSON.stringify(next));
  } catch {
    /* modo privado / storage lleno — no es crítico */
  }
}

export default function PushPrompt() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isSectionEnabled } = useSiteConfig();
  const { addToast } = useNotifications();
  const push = usePushNotifications();
  const pushEnabled = isSectionEnabled("push");

  const [persistedEligible, setPersistedEligible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const bumped = useRef(false);

  // Cuenta una sesión al montar y decide la elegibilidad por estado persistido
  // (sessionCount + último dismiss). El ref evita el doble-efecto de StrictMode
  // en dev. Date.now() acá es válido: corre en un efecto, no en el render.
  useEffect(() => {
    if (bumped.current) return;
    bumped.current = true;
    const s = readState();
    const sessionCount = s.sessionCount + 1;
    writeState({ ...s, sessionCount });
    const notRecentlyDismissed =
      !s.dismissedAt || Date.now() - s.dismissedAt > REPROMPT_MS;
    setPersistedEligible(sessionCount >= MIN_SESSIONS && notRecentlyDismissed);
  }, []);

  const canActivate =
    push.isSupported && push.permission === "default" && !push.isSubscribed;
  const showInstall = push.requiresStandalone; // iOS en pestaña: hay que instalar

  const eligible =
    !!user &&
    pushEnabled &&
    !hidden &&
    persistedEligible &&
    (canActivate || showInstall);

  if (!eligible) return null;

  const dismiss = () => {
    const s = readState();
    writeState({ ...s, dismissedAt: Date.now() });
    setHidden(true);
  };

  const activate = async () => {
    const ok = await push.subscribe();
    if (ok) {
      addToast({
        type: "success",
        title: t("shared:pushPrompt.successTitle"),
        message: t("shared:pushPrompt.successMessage"),
      });
      setHidden(true);
    } else {
      addToast({
        type: "error",
        title: t("shared:pushPrompt.errorTitle"),
        message: t("shared:pushPrompt.errorMessage"),
      });
    }
  };

  return (
    <div
      className={styles.prompt}
      role="dialog"
      aria-label={t("shared:pushPrompt.aria")}
    >
      <div className={styles.head}>
        <div className={styles.icon} aria-hidden="true">
          🔔
        </div>
        <div className={styles.body}>
          <strong className={styles.title}>
            {t("shared:pushPrompt.title")}
          </strong>
          <p className={styles.text}>
            {showInstall
              ? t("shared:pushPrompt.installText")
              : t("shared:pushPrompt.text")}
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        {!showInstall && (
          <button
            type="button"
            className={styles.primary}
            disabled={push.busy}
            onClick={activate}
          >
            {push.busy
              ? t("shared:pushPrompt.activating")
              : t("shared:pushPrompt.activate")}
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={dismiss}>
          {showInstall
            ? t("shared:pushPrompt.understood")
            : t("shared:pushPrompt.notNow")}
        </button>
      </div>
    </div>
  );
}
