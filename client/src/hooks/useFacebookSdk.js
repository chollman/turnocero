import { useEffect, useRef, useState } from "react";

// Carga el SDK JS de Facebook una sola vez y expone un `login()` que resuelve
// con el access token (o lanza si el usuario cancela / no otorga email).
//
// No usamos una dependencia npm para esto: el SDK oficial se carga por script
// y el flujo es chico. `VITE_FB_APP_ID` controla si está habilitado.
const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || "";
const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const GRAPH_VERSION = "v19.0";

let sdkPromise = null;

function loadSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("No window"));
      return;
    }
    if (window.FB) {
      resolve(window.FB);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: FB_APP_ID,
        cookie: false,
        xfbml: false,
        version: GRAPH_VERSION,
      });
      resolve(window.FB);
    };
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("No se pudo cargar Facebook"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function useFacebookSdk() {
  const enabled = !!FB_APP_ID;
  const [ready, setReady] = useState(false);
  const fbRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadSdk()
      .then((FB) => {
        if (cancelled) return;
        fbRef.current = FB;
        setReady(true);
      })
      .catch(() => {
        /* el botón queda deshabilitado vía `ready` */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Resuelve con el accessToken; rechaza si el usuario cancela o no da permiso.
  const login = () =>
    new Promise((resolve, reject) => {
      const FB = fbRef.current;
      if (!FB) {
        reject(new Error("Facebook no está listo"));
        return;
      }
      FB.login(
        (response) => {
          const token = response?.authResponse?.accessToken;
          if (response?.status === "connected" && token) {
            resolve(token);
          } else {
            reject(new Error("Login con Facebook cancelado"));
          }
        },
        { scope: "email" },
      );
    });

  return { enabled, ready, login };
}
