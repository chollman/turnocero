import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { STORAGE_KEYS } from "../utils/storageKeys";

const KEY = STORAGE_KEYS.LAST_ROUTE;

const AUTH_PREFIXES = [
  "/login",
  "/register",
  "/verificar-email",
  "/recuperar-contrasenia",
  "/restablecer-contrasenia",
];

// ¿Corre como PWA instalada (standalone) y no como pestaña normal del browser?
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator?.standalone === true
  );
}

const isAuthish = (path) => AUTH_PREFIXES.some((p) => path.startsWith(p));

/**
 * En la PWA instalada (display-mode standalone), al refrescar o reabrir, el SO
 * puede recargar el `start_url` ("/") y perder el deep-link en el que estaba el
 * usuario. Este hook:
 *
 *  1. Persiste la ruta actual en localStorage en cada navegación.
 *  2. En el arranque, si la app cayó en "/" (standalone) y hay una ruta
 *     profunda guardada, la restaura con `replace`.
 *
 * Es no-op en el browser normal y cuando la URL se preserva sola (arranca en la
 * ruta profunda, no en "/"). La ruta guardada al boot se captura ANTES de que
 * el efecto de persistencia la pise.
 */
export default function usePwaRouteRestore() {
  const location = useLocation();
  const navigate = useNavigate();
  const [savedOnBoot] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(KEY)
        : null;
    } catch {
      return null;
    }
  });
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (
      isStandalone() &&
      location.pathname === "/" &&
      savedOnBoot &&
      savedOnBoot !== "/" &&
      !isAuthish(savedOnBoot)
    ) {
      navigate(savedOnBoot, { replace: true });
    }
    // Solo en el arranque (una vez). `savedOnBoot`/navigate son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (isAuthish(location.pathname)) return;
    try {
      localStorage.setItem(KEY, location.pathname + location.search);
    } catch {
      /* storage lleno / modo privado — no es crítico */
    }
  }, [location]);
}
