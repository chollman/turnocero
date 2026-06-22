import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCommunity } from "../../context/CommunityContext";
import { useSiteConfig } from "../../context/SiteConfigContext";
import useViewingControls from "../../hooks/useViewingControls";
import Meeple from "../shared/Meeple";
import styles from "./CommunitySwitcher.module.css";

// Selector de comunidad en el shell (Sidebar — que en mobile es el drawer).
// Atajo visible para: cambiar el aspecto (skin) del sitio, elegir qué
// comunidades ver en conjunto (viewing) y saltar a "Mis Comunidades".
// Reemplaza el descubrimiento enterrado en /perfil (CommunityPrefs sigue ahí).
export default function CommunitySwitcher({ onNavigate }) {
  const { t } = useTranslation();
  const { memberships = [], skin, skinCommunity, loaded, isTenant } =
    useCommunity();
  const { isSectionEnabled } = useSiteConfig();
  const { busy, viewingSet, toggleViewing, chooseSkin } = useViewingControls();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Cerrar al clickear afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // En un subdominio de comunidad (modo tenant) el sitio es single-community:
  // no hay nada que cambiar, así que el selector no se muestra.
  if (isTenant) return null;
  // Feature apagada, contexto sin cargar, o el usuario integra una sola
  // comunidad (no hay nada que cambiar) → no se muestra el selector. El acceso
  // a "Mis Comunidades" sigue disponible desde el nav del Sidebar.
  if (!isSectionEnabled("comunidades")) return null;
  if (!loaded || memberships.length <= 1) return null;

  const activeName = skinCommunity?.name || "TurnoCero";

  const closeAndNavigate = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("layout:community.switchLabel")}
      >
        <span className={styles.eyebrow}>
          <Meeple /> {t("layout:community.header")}
        </span>
        <span className={styles.activeName}>{activeName}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.panel} role="menu">
          <p className={styles.help}>{t("layout:community.help")}</p>
          <ul className={styles.list}>
            {memberships.map((m) => {
              const id = String(m.community._id);
              const isSkin = String(skin) === id;
              return (
                <li key={id} className={styles.row}>
                  <label className={styles.viewing}>
                    <input
                      type="checkbox"
                      checked={viewingSet.has(id)}
                      disabled={busy}
                      onChange={() => toggleViewing(id)}
                    />
                    <span className={styles.cname}>{m.community.name}</span>
                  </label>
                  <button
                    type="button"
                    className={`${styles.skinBtn} ${isSkin ? styles.skinBtnActive : ""}`}
                    disabled={busy || isSkin}
                    onClick={() => chooseSkin(id)}
                    title={
                      isSkin
                        ? t("layout:community.skinActiveTip")
                        : t("layout:community.skinUseTip")
                    }
                  >
                    {isSkin
                      ? t("layout:community.skinActive")
                      : t("layout:community.skinUse")}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/comunidades"
            className={styles.allLink}
            onClick={closeAndNavigate}
            role="menuitem"
          >
            {t("layout:community.viewAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
