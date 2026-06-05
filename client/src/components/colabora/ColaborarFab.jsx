import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSectionEnabled } from "../../hooks/useSectionEnabled";
import styles from "./ColaborarFab.module.css";

const HeartIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"
    />
  </svg>
);

export default function ColaborarFab({ onVisibilityChange }) {
  const isSectionEnabled = useSectionEnabled();
  const { pathname } = useLocation();
  // El slide-in entra a 1s + 0.55s de animación; tras ~10s visibles el FAB se
  // vuelve a esconder deslizándose fuera de pantalla. Se monta una sola vez en
  // AppShell.
  const [hidden, setHidden] = useState(false);
  // `hiddenSettled` va atrás de `hidden` por la duración del slide-out, así el
  // AdminViewToggle espera a que el FAB termine de salir antes de bajar.
  const [hiddenSettled, setHiddenSettled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHidden(true), 11500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hidden) return undefined;
    // Coincide con la animación slideOutLeft (0.45s) de ColaborarFab.module.css.
    const t = setTimeout(() => setHiddenSettled(true), 450);
    return () => clearTimeout(t);
  }, [hidden]);

  // Reportamos hacia arriba si el FAB sigue ocupando el spot bottom-left. En la
  // ruta /colabora o sin sección baja inmediato (no hay animación); al esconderse
  // por el timer esperamos a que termine el slide-out (hiddenSettled).
  const visible =
    isSectionEnabled("colabora") && pathname !== "/colabora" && !hiddenSettled;

  useEffect(() => {
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  if (!isSectionEnabled("colabora")) return null;
  if (pathname === "/colabora") return null;

  return (
    <Link
      to="/colabora"
      className={`${styles.fab} ${hidden ? styles.hidden : ""}`}
      aria-label="Colaborar con TurnoCero"
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <HeartIcon />
      <span>Bancanos</span>
    </Link>
  );
}
