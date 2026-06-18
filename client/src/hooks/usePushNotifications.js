import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API } from "../api/endpoints";
import { urlBase64ToUint8Array } from "../utils/pushKey";

// Leído en tiempo de llamada (no como const de módulo) para que sea testeable
// vía vi.stubEnv. Vite reemplaza `import.meta.env.X` estáticamente igual.
const getVapidKey = () => import.meta.env.VITE_VAPID_PUBLIC_KEY;

// ¿Corre como PWA instalada (standalone)? En iOS el push SOLO funciona así.
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator?.standalone === true
  );
}

// ¿iOS / iPadOS? (incluye el iPad que se hace pasar por Mac con touch).
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Maneja la suscripción Web Push de ESTE dispositivo.
 *
 * Estados expuestos:
 *  - isSupported: el browser tiene serviceWorker + PushManager + Notification.
 *  - permission: "default" | "granted" | "denied" (Notification.permission).
 *  - isSubscribed: ya hay una PushSubscription activa en este device.
 *  - requiresStandalone: iOS en pestaña — hay que instalar la PWA primero.
 *  - busy / error.
 *
 * `subscribe()` debe llamarse desde un gesto del usuario (requisito de iOS).
 */
export default function usePushNotifications() {
  const isSupported = pushSupported();
  const requiresStandalone = isIOS() && !isStandalone();

  const [permission, setPermission] = useState(() =>
    isSupported && "Notification" in window ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Seedea el estado de suscripción al montar.
  useEffect(() => {
    let cancelled = false;
    if (!isSupported) return undefined;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(!!sub);
      } catch {
        if (!cancelled) setIsSubscribed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    const vapidKey = getVapidKey();
    if (!vapidKey) {
      setError("Falta configurar la clave VAPID.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setBusy(false);
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      await axios.post(API.push.SUBSCRIBE, sub.toJSON());
      setIsSubscribed(true);
      setBusy(false);
      return true;
    } catch (err) {
      setError(err?.message || "No se pudo activar.");
      setBusy(false);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe().catch(() => {});
        await axios.post(API.push.UNSUBSCRIBE, { endpoint }).catch(() => {});
      }
      setIsSubscribed(false);
      setBusy(false);
      return true;
    } catch (err) {
      setError(err?.message || "No se pudo desactivar.");
      setBusy(false);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    permission,
    isSubscribed,
    requiresStandalone,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}
