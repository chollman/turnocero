import axios from "axios";
import { API } from "../api/endpoints";

// Des-suscribe ESTE dispositivo de Web Push (best-effort). Se llama en el
// logout explícito para que un device compartido no siga recibiendo pushes de
// un usuario deslogueado. Vive como util suelto (no en el hook) para evitar un
// ciclo hook↔AuthContext y poder testearlo aislado.
//
// Nunca throwea: cualquier fallo (sin SW, sin suscripción, red caída) se
// traga — no debe bloquear ni romper el logout.
export async function unsubscribeThisDevice() {
  try {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      !navigator.serviceWorker?.ready
    ) {
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub;
    await sub.unsubscribe().catch(() => {});
    await axios.post(API.push.UNSUBSCRIBE, { endpoint }).catch(() => {});
  } catch {
    /* best-effort — nunca rompe el logout */
  }
}
