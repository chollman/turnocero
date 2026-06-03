import { Routes } from "react-router-dom";

/**
 * Presentational wrapper around <Routes>. The transition state (displayed
 * location, slide phase className, animation-end handler) is owned by
 * `usePageTransition()` and passed in via `transition`, so the app shell can
 * derive its chrome from the same `displayLocation` shown here and stay in
 * lockstep with the content during the slide.
 */
export default function PageTransition({ transition, routesKey, children }) {
  return (
    <div
      className={transition.className}
      onAnimationEnd={transition.handleAnimationEnd}
    >
      {/* `routesKey` cambia cuando el usuario cambia su `viewing` de comunidades
          → remonta la ruta actual para que re-fetchee con el nuevo scope. Es
          undefined en navegación normal, así que no afecta el slide. */}
      <Routes key={routesKey} location={transition.displayLocation}>
        {children}
      </Routes>
    </div>
  );
}
