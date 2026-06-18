// Convierte la VAPID public key (base64url, como la genera `web-push
// generate-vapid-keys`) al `Uint8Array` que `pushManager.subscribe` espera en
// `applicationServerKey`. Pasar el string crudo tira `InvalidAccessError` al
// suscribir — por eso esto es una función pura testeada aparte.
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
