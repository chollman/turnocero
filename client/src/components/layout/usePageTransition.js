import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import styles from "./PageTransition.module.css";

// Las pantallas de auth comparten una sola "sección" para que navegar entre
// ellas (toggle login ↔ register, ir a verificar-email, etc.) sea instantáneo,
// sin la animación de slide que se aplica al cambiar de sección.
const AUTH_SECTIONS = new Set([
  "login",
  "register",
  "verificar-email",
  "recuperar-contrasenia",
  "restablecer-contrasenia",
]);

const getSection = (pathname) => {
  const seg = pathname.split("/")[1] || "";
  return AUTH_SECTIONS.has(seg) ? "auth" : seg;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Owns the two-phase slide transition state for section changes:
 *  - Phase 'out': the previous route slides down + fades
 *  - Then the route swap happens (displayLocation is updated)
 *  - Phase 'in': the new route slides in from above + fades
 *
 * Lifted out of <PageTransition> so the app shell can derive its chrome
 * (sidebars / navbar / frame) from the SAME `displayLocation` the content is
 * showing. Gating the chrome on the live pathname instead swaps it ~200ms
 * before the content (which lags through `displayLocation` during slideOut),
 * leaving the sidebar gone while the old page is still on screen → layout jump.
 *
 * Returns `{ displayLocation, className, handleAnimationEnd }`.
 */
export default function usePageTransition() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [phase, setPhase] = useState("idle");

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return;
    const sameSection =
      getSection(location.pathname) === getSection(displayLocation.pathname);
    // Same section, o reduced-motion: el slide no se reproduce (el CSS lo anula
    // con `animation: none`), así que `onAnimationEnd` nunca dispararía y el
    // swap quedaría colgado en la página vieja → swapeamos al instante.
    if (sameSection || prefersReducedMotion()) {
      setDisplayLocation(location);
    } else {
      setPhase("out");
    }
  }, [location, displayLocation]);

  const handleAnimationEnd = (e) => {
    // Ignore animations bubbling up from child elements
    if (e.target !== e.currentTarget) return;
    if (phase === "out") {
      setDisplayLocation(location);
      setPhase("in");
    } else if (phase === "in") {
      setPhase("idle");
    }
  };

  const className =
    phase === "out" ? styles.slideOut : phase === "in" ? styles.slideIn : "";

  return { displayLocation, className, handleAnimationEnd };
}
