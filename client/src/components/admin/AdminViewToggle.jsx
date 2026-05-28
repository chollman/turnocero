import { useAuth } from "../../context/AuthContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import styles from "./AdminViewToggle.module.css";

export default function AdminViewToggle() {
  const { isActuallyAdmin, viewAsUser, setViewAsUser } = useAuth();
  const { isSectionEnabled } = useSiteConfig();

  if (!isActuallyAdmin) return null;

  const label = viewAsUser ? "Volver a vista admin" : "Ver como usuario";
  // El FAB "Bancanos" comparte spot bottom-left. Si está visible, subimos
  // este toggle para que no se monten uno sobre otro.
  const stacked = isSectionEnabled("colabora");

  return (
    <button
      className={`${styles.fab} ${viewAsUser ? styles.fabActive : ""} ${stacked ? styles.fabStacked : ""}`}
      onClick={() => setViewAsUser(!viewAsUser)}
      aria-label={label}
      title={label}
      type="button"
    >
      {viewAsUser ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
