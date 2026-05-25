import { useEffect, useState } from "react";
import { Routes, useLocation } from "react-router-dom";
import styles from "./PageTransition.module.css";

const getSection = (pathname) => pathname.split("/")[1] || "";

/**
 * Wraps <Routes> and animates section changes as a two-phase slide:
 *  - Phase 'out': the previous route slides down + fades
 *  - Then the route swap happens (displayLocation is updated)
 *  - Phase 'in': the new route slides in from above + fades
 *
 * Navigations within the same section (e.g. /mesas → /mesas/:id) swap
 * instantly with no animation.
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [phase, setPhase] = useState("idle");

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return;
    const sameSection =
      getSection(location.pathname) === getSection(displayLocation.pathname);
    if (sameSection) {
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

  return (
    <div className={className} onAnimationEnd={handleAnimationEnd}>
      <Routes location={displayLocation}>{children}</Routes>
    </div>
  );
}
